import {
  createCliRenderer,
  TextRenderable,
  type CliRenderer,
  type KeyEvent as OpenTuiKeyEvent,
} from "@opentui/core";
import { mapKeyToCommand } from "../engine/input_intent";
import {
  applyCommand,
  createSession,
  finish,
  sessionStatus,
  shouldFinish,
  DEFAULT_DURATION_SECONDS,
  type SessionState,
} from "../engine/session_state";
import { visualLineStartIndex } from "../engine/typing_view";
import { buildResult } from "../engine/session_result";
import {
  composeFrame,
  isScrollableOverlay,
  overlayScrollMax,
  type Overlay,
  type ViewState,
} from "../engine/frame";
import { preferredSpeedBand, randomExcerptIndex } from "../engine/speed_band";
import { excerptsForLocale, type Excerpt } from "../corpus/corpus";
import { SessionStore } from "../storage/session_store";
import { FileStorage } from "../storage/file_storage";
import { buildStoredSession } from "../storage/session_record";
import { SettingsStore } from "../storage/settings_store";
import { FileSettingsStorage } from "../storage/settings_file_storage";
import { nextTheme } from "../engine/theme";
import { prefersTruecolor } from "../engine/terminal";
import { localeFromEnv, nextLocale, type Locale } from "../engine/locale";
import { stringsFor, type UIStrings } from "../engine/strings";
import { paint, paletteFor, type Palette } from "./theme";
import type { Row } from "../engine/view_row";
import { SURFACE_TOP, footerTop, overlayHeight } from "../engine/layout";

// Thin OpenTUI shell above the engine seam: it translates real key events into
// engine commands, applies them, and renders engine view data to the terminal.
// All correctness-critical logic lives below the seam (pure, unit-tested).
// The shell owns exactly two impure jobs: stamping `performance.now()` on each
// key/tick, and driving the 100ms countdown/auto-finish loop.

/** 24-bit color support; otherwise the heat map snaps to the 256-color cube. */
const TRUECOLOR = prefersTruecolor(process.env);

/** Category filter cycle for the `c` hotkey (PRD keymap). */
const CATEGORIES = ["random", "scifi", "fantasy", "biography"] as const;

function nextCategory(current: string): string {
  const i = CATEGORIES.indexOf(current as (typeof CATEGORIES)[number]);
  return CATEGORIES[(i + 1) % CATEGORIES.length]!;
}

/** Signed scroll step a key requests within a scrollable overlay (0 = none). */
function scrollDelta(key: OpenTuiKeyEvent, page: number): number {
  switch (key.name) {
    case "up":
      return -1;
    case "down":
      return 1;
    case "pageup":
      return -page;
    case "pagedown":
      return page;
    default:
      if (key.sequence === "k") return -1;
      if (key.sequence === "j") return 1;
      return 0;
  }
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

export async function runApp(): Promise<CliRenderer> {
  const renderer = await createCliRenderer({
    targetFps: 10, // ~100ms tick (frank_type cadence)
    useKittyKeyboard: {}, // disambiguates Backspace family; emits release events
    exitOnCtrlC: false, // we handle quit ourselves
  });

  // Corpus + adaptive selection (#5). The active locale filters the corpus and
  // picks the UI-string table; the store feeds the speed band and finished runs.
  const store = new SessionStore(new FileStorage());
  // Persisted preferences (theme + locale; duration/category later). Loaded once
  // at boot; the active palette drives every screen and `t` swaps it. Locale is
  // seeded from $LANG on first run (no persisted choice), then `l` swaps and
  // persists it (#11).
  const settings = new SettingsStore(new FileSettingsStorage());
  const loaded = settings.load();
  let palette: Palette = paletteFor(loaded.theme);
  let locale: Locale = loaded.locale ?? localeFromEnv(process.env.LANG);
  let strings: UIStrings = stringsFor(locale);
  let excerpts: readonly Excerpt[] = excerptsForLocale(locale);
  let category = "random";
  let currentIndex: number | null = null; // null → nothing to exclude yet
  let saved = false;
  // Shell-owned overlays (profile trends, help, sources) over the session — they
  // pause nothing; the session is untouched. Only Ctrl-C quits from an overlay;
  // any other key closes profile/help, while sources scrolls (Esc/q close it).
  let overlay: Overlay | null = null;
  let overlayScroll = 0; // top visible line of the active scrollable overlay
  // The speed band only changes when a finished run is saved, so read it from
  // history once here and refresh it after each save — not on every excerpt
  // load, which would re-read (and re-compact) sessions.json on the render path.
  let band = preferredSpeedBand(store.all());

  let state: SessionState = createSession(
    excerpts[0]?.normalized_text ?? "",
    DEFAULT_DURATION_SECONDS,
  );

  /** Pick a fresh excerpt for the current category, banded by recent history. */
  function loadExcerpt(): void {
    currentIndex = randomExcerptIndex(excerpts, {
      category,
      except: currentIndex,
      speedBand: band,
    });
    state = createSession(
      excerpts[currentIndex]?.normalized_text ?? "",
      state.durationSeconds,
    );
    saved = false;
  }

  /** Persist a finished run once, stamping wall-clock timestamps. */
  function persistIfFinished(now: number): void {
    if (sessionStatus(state) !== "finished" || saved) return;
    const excerpt = currentIndex === null ? undefined : excerpts[currentIndex];
    if (!excerpt) return;
    saved = true;
    const result = buildResult(state, now);
    const finishedMs = Date.now();
    try {
      store.save(
        buildStoredSession(result, excerpt, {
          startedAt: new Date(finishedMs - result.elapsedMs).toISOString(),
          finishedAt: new Date(finishedMs).toISOString(),
        }),
      );
      band = preferredSpeedBand(store.all()); // refresh band from new history
    } catch {
      // History write failures must not crash an active session.
    }
  }

  loadExcerpt(); // initial banded pick

  const header = new TextRenderable(renderer, {
    content: "",
    position: "absolute",
    top: 0,
    left: 0,
  });
  const surface = new TextRenderable(renderer, {
    content: "",
    position: "absolute",
    top: SURFACE_TOP,
    left: 0,
    wrapMode: "none", // we wrap in the engine; keep layout fixed
  });
  // Live race strip: three pace-setter lanes under the typing surface, drawn
  // only during an active run and cleared otherwise. It sits in a reserved band
  // just above the footer so the surface never reflows when the race appears.
  const raceStrip = new TextRenderable(renderer, {
    content: "",
    position: "absolute",
    top: SURFACE_TOP + 1,
    left: 0,
    wrapMode: "none",
  });
  const footer = new TextRenderable(renderer, {
    content: "",
    position: "absolute",
    top: footerTop(renderer.height),
    left: 0,
  });
  for (const r of [header, surface, raceStrip, footer]) renderer.root.add(r);

  /**
   * Snapshot the shell's mutable state as the pure ViewState composeFrame needs.
   * `history` is read only while the profile overlay is up, keeping `store.all()`'s
   * compaction cost off the typing/results/race render path.
   */
  function viewState(now: number): ViewState {
    return {
      state,
      now,
      overlay,
      overlayScroll,
      category,
      locale,
      strings,
      excerpts,
      history: overlay === "profile" ? store.all() : [],
      themeName: palette.name,
      width: renderer.width,
      height: renderer.height,
    };
  }

  /** Paint one pane onto its renderable; a blank pane clears it. */
  function apply(renderable: TextRenderable, rows: readonly Row[]): void {
    renderable.content = rows.length === 0 ? "" : paint(rows, palette, TRUECOLOR);
  }

  function draw(now: number): void {
    const frame = composeFrame(viewState(now));
    apply(header, frame.header);
    apply(surface, frame.surface);
    raceStrip.top = frame.raceStripTop;
    apply(raceStrip, frame.raceStrip);
    apply(footer, frame.footer);
  }

  renderer.keyInput.on("keypress", (e: OpenTuiKeyEvent) => {
    const now = performance.now(); // stamp on receipt (input is per-keystroke)
    // While an overlay is up, keys don't reach the session. Ctrl-C still quits
    // the app; every other key stays inside the overlay (`q` here closes it, it
    // does not quit — see the sources/help close hints).
    if (overlay) {
      // Ignore kitty release/repeat events — only a fresh press acts, so holding
      // the key that opened the overlay can't immediately close it.
      if (e.eventType === "release" || e.eventType === "repeat") return;
      if (e.ctrl && !e.meta && !e.option && e.name === "c") {
        cleanup(renderer);
        return;
      }
      // Help and sources scroll: nav keys move the viewport (and are consumed even
      // when the content fits, so they never close it); Esc/q/any other key closes.
      // Profile is a fixed layout — any key closes it.
      if (isScrollableOverlay(overlay)) {
        const delta = scrollDelta(e, Math.max(1, overlayHeight(renderer.height) - 1));
        if (delta !== 0) {
          overlayScroll = clamp(overlayScroll + delta, 0, overlayScrollMax(viewState(now)));
          draw(now);
          renderer.requestRender();
          return;
        }
      }
      overlay = null;
      overlayScroll = 0;
      draw(now);
      renderer.requestRender();
      return;
    }
    const cmd = mapKeyToCommand(e, state);
    if (cmd.kind === "quit") {
      cleanup(renderer);
      return;
    }
    if (cmd.kind === "openProfile" || cmd.kind === "openHelp" || cmd.kind === "openSources") {
      overlay =
        cmd.kind === "openProfile" ? "profile" : cmd.kind === "openHelp" ? "help" : "sources";
      overlayScroll = 0;
      draw(now);
      renderer.requestRender();
      return;
    }
    // Theme toggle is a shell concern: swap the active palette, redraw every
    // screen in it, and persist the choice (a write failure never interrupts).
    if (cmd.kind === "toggleTheme") {
      palette = paletteFor(nextTheme(palette.name));
      settings.save({ theme: palette.name, locale });
      draw(now);
      renderer.requestRender();
      return;
    }
    // Locale toggle is a shell concern (#11): swap the string table, re-filter
    // the corpus to the new locale, load a fresh excerpt from it (the old index
    // is meaningless against a different corpus), and persist. Ready/Finished
    // only — mid-run `l` is typed input, so replacing the session here is safe.
    if (cmd.kind === "toggleLocale") {
      locale = nextLocale(locale);
      strings = stringsFor(locale);
      excerpts = excerptsForLocale(locale);
      currentIndex = null; // nothing to exclude across a corpus swap
      loadExcerpt();
      settings.save({ theme: palette.name, locale });
      draw(now);
      renderer.requestRender();
      return;
    }
    // Excerpt selection replaces the whole session (impure: corpus + rng), so
    // the shell owns it rather than the engine.
    if (cmd.kind === "nextExcerpt" || cmd.kind === "cycleCategory") {
      if (cmd.kind === "cycleCategory") category = nextCategory(category);
      loadExcerpt();
      draw(now);
      renderer.requestRender();
      return;
    }
    // Delete-to-line-start needs the terminal width to find the visual line
    // start — the one deletion count the pure mapper can't resolve. Fill it in
    // here (the shell owns width), then let the engine apply the count.
    const resolved =
      cmd.kind === "deleteToLineStart"
        ? {
            ...cmd,
            toIndex: visualLineStartIndex(
              state.target,
              state.input.length,
              renderer.width,
            ),
          }
        : cmd;
    const next = applyCommand(state, resolved, now);
    if (next !== state) {
      state = next;
      draw(now);
      renderer.requestRender();
    }
  });

  // --- paste: separate event; discard so it never registers as typed input ---
  renderer.keyInput.on("paste", () => {
    /* rejected — pasted bursts must not fake a run */
  });

  renderer.on("resize", () => {
    footer.top = footerTop(renderer.height);
    draw(performance.now());
    renderer.requestRender();
  });

  // 100ms tick: drive the live countdown and auto-finish at zero. Only an
  // active run needs per-frame work — ready/finished are static until a key.
  renderer.setFrameCallback(async () => {
    if (sessionStatus(state) !== "active") return;
    const now = performance.now();
    if (shouldFinish(state, now)) {
      state = finish(state, now);
      persistIfFinished(now); // append the finished run to local history
    }
    draw(now);
    renderer.requestRender();
  });

  draw(performance.now());
  renderer.start();
  return renderer;
}
export function cleanup(renderer: CliRenderer): void {
  try {
    renderer.stop();
  } catch {}
  try {
    (renderer as unknown as { destroy?: () => void }).destroy?.();
  } catch {}
  process.exit(0);
}
