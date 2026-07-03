import {
  createCliRenderer,
  StyledText,
  TextRenderable,
  type CliRenderer,
  type KeyEvent as OpenTuiKeyEvent,
  type RGBA,
} from "@opentui/core";
import { mapKeyToCommand } from "../engine/input_intent";
import {
  applyCommand,
  correctCharacters,
  createSession,
  elapsedMs,
  finish,
  remainingSeconds,
  sessionStatus,
  shouldFinish,
  DEFAULT_DURATION_SECONDS,
  type SessionState,
} from "../engine/session_state";
import {
  computeCells,
  cursorRow,
  visibleWindow,
  visualLineStartIndex,
  wordWrap,
} from "../engine/typing_view";
import { computeHeatCells, formatSlowPairs } from "../engine/heatmap_view";
import { LABEL_WIDTH, TRACK_FILL, raceLanes } from "../engine/race_view";
import { calculateMetrics } from "../engine/metrics";
import { buildResult } from "../engine/session_result";
import { formatResultPanel } from "../engine/results_view";
import { buildProfile } from "../engine/profile";
import { formatProfile } from "../engine/profile_view";
import { preferredSpeedBand, randomExcerptIndex } from "../engine/speed_band";
import { excerptsForLocale, type Excerpt } from "../corpus/corpus";
import { SessionStore } from "../storage/session_store";
import { FileStorage } from "../storage/file_storage";
import { buildStoredSession } from "../storage/session_record";
import { SettingsStore } from "../storage/settings_store";
import { FileSettingsStorage } from "../storage/settings_file_storage";
import { nextTheme } from "../engine/theme";
import { localeFromEnv, nextLocale, type Locale } from "../engine/locale";
import { stringsFor, type UIStrings } from "../engine/strings";
import {
  cellToChunk,
  chunk,
  heatCellToChunk,
  paletteFor,
  type Chunk,
  type Palette,
} from "./theme";

// Thin OpenTUI shell above the engine seam: it translates real key events into
// engine commands, applies them, and renders engine view data to the terminal.
// All correctness-critical logic lives below the seam (pure, unit-tested).
// The shell owns exactly two impure jobs: stamping `performance.now()` on each
// key/tick, and driving the 100ms countdown/auto-finish loop.

const SURFACE_TOP = 2;
const FOOTER_RESERVE = 2; // blank line + footer
const RACE_STRIP_ROWS = 4; // blank spacer + three race lanes, reserved always

/** 24-bit color support; otherwise the heat map snaps to the 256-color cube. */
const TRUECOLOR = /^(truecolor|24bit)$/i.test(process.env.COLORTERM ?? "");

/** Category filter cycle for the `c` hotkey (PRD keymap). */
const CATEGORIES = ["random", "scifi", "fantasy", "biography"] as const;

function nextCategory(current: string): string {
  const i = CATEGORIES.indexOf(current as (typeof CATEGORIES)[number]);
  return CATEGORIES[(i + 1) % CATEGORIES.length]!;
}

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
  // Profile is a shell-owned overlay (history trends) over the session — it
  // pauses nothing; the session is untouched. Any key but Ctrl-C closes it.
  let overlay: "profile" | null = null;
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
    top: Math.max(SURFACE_TOP + 1, renderer.height - 1),
    left: 0,
  });
  for (const r of [header, surface, raceStrip, footer]) renderer.root.add(r);

  function surfaceHeight(): number {
    return Math.max(1, renderer.height - SURFACE_TOP - FOOTER_RESERVE - RACE_STRIP_ROWS);
  }

  function draw(now: number): void {
    if (overlay === "profile") {
      header.content = buildHeader(state, now, palette, strings);
      surface.content = buildProfilePanel(store, renderer.width, surfaceHeight(), palette, strings);
      raceStrip.content = "";
      footer.content = buildFooter(state, category, overlay, palette, locale, strings);
      return;
    }
    header.content = buildHeader(state, now, palette, strings);
    surface.content =
      sessionStatus(state) === "finished"
        ? buildResultsPanel(state, now, renderer.width, surfaceHeight(), palette, strings)
        : buildSurface(state, renderer.width, surfaceHeight(), palette);
    // Anchor the race strip to the blank row just under the surface.
    raceStrip.top = SURFACE_TOP + surfaceHeight() + 1;
    raceStrip.content =
      sessionStatus(state) === "active"
        ? buildRaceStrip(state, now, renderer.width, palette, strings)
        : "";
    footer.content = buildFooter(state, category, overlay, palette, locale, strings);
  }

  renderer.keyInput.on("keypress", (e: OpenTuiKeyEvent) => {
    const now = performance.now(); // stamp on receipt (input is per-keystroke)
    // While the profile overlay is up, keys don't reach the session: Ctrl-C
    // quits, any other key dismisses the overlay back to the run.
    if (overlay) {
      if (mapKeyToCommand(e, state).kind === "quit") {
        cleanup(renderer);
        return;
      }
      // Ignore kitty release/repeat events — only a fresh press dismisses, so
      // holding the key that opened the overlay can't immediately close it.
      if (e.eventType === "release" || e.eventType === "repeat") return;
      overlay = null;
      draw(now);
      renderer.requestRender();
      return;
    }
    const cmd = mapKeyToCommand(e, state);
    if (cmd.kind === "quit") {
      cleanup(renderer);
      return;
    }
    if (cmd.kind === "openProfile") {
      overlay = "profile";
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
    footer.top = Math.max(SURFACE_TOP + 1, renderer.height - 1);
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

/** Countdown / status line above the typing surface. */
function buildHeader(
  state: SessionState,
  now: number,
  palette: Palette,
  strings: UIStrings,
): StyledText {
  const status = sessionStatus(state);
  if (status === "finished") {
    return new StyledText([
      chunk(strings.header.done(state.durationSeconds), palette.correct),
      chunk(strings.header.quitHint, palette.chrome),
    ]);
  }
  const secs = remainingSeconds(state, now);
  const label = status === "active" ? strings.header.typing : strings.header.ready;
  return new StyledText([
    chunk(`${secs}s`, secs <= 5 ? palette.wrong : palette.chrome),
    chunk(`  ·  ${label}`, palette.chrome),
  ]);
}

/** Per-lane glyph color: the user chases the fast marker, ahead of the slow one. */
function raceGlyphColor(palette: Palette): Record<"slow" | "you" | "fast", RGBA> {
  return { slow: palette.pending, you: palette.correct, fast: palette.wrong };
}

/**
 * The live race strip: three labeled lanes (Slow 60 / You / Fast 140) with a
 * glyph advancing on each 100ms tick. The user's live WPM drives their marker,
 * computed from the same metrics the results panel uses so the chase matches the
 * final number.
 */
function buildRaceStrip(
  state: SessionState,
  now: number,
  width: number,
  palette: Palette,
  strings: UIStrings,
): StyledText {
  const elapsed = elapsedMs(state, now);
  const userWpm = calculateMetrics({
    typedEvents: state.events,
    correctCharacters: correctCharacters(state),
    elapsedMs: elapsed,
    targetText: state.target,
  }).wpm;
  // Localized lane labels vary in width (e.g. "Fast" vs "Rápido"), so pad every
  // lane to the widest label in the active locale — the track starts aligned.
  const labelWidth = Math.max(
    LABEL_WIDTH,
    ...Object.values(strings.race).map((label) => label.length),
  );
  const trackWidth = Math.max(1, width - labelWidth - 1);
  const lanes = raceLanes(
    { elapsedMs: elapsed, durationSeconds: state.durationSeconds, userWpm },
    trackWidth,
  );

  const glyphColor = raceGlyphColor(palette);
  const chunks: Chunk[] = [];
  lanes.forEach((lane, i) => {
    chunks.push(chunk(`${strings.race[lane.id].padEnd(labelWidth)} `, palette.chrome));
    if (lane.glyphIndex > 0) chunks.push(chunk(TRACK_FILL.repeat(lane.glyphIndex), palette.chrome));
    chunks.push(chunk(lane.track[lane.glyphIndex]!, glyphColor[lane.id]));
    const trailing = lane.track.length - lane.glyphIndex - 1;
    if (trailing > 0) chunks.push(chunk(TRACK_FILL.repeat(trailing), palette.chrome));
    if (i < lanes.length - 1) chunks.push(chunk("\n"));
  });
  return new StyledText(chunks);
}

/** Render the current session onto the typing surface as a StyledText grid. */
function buildSurface(state: SessionState, width: number, height: number, palette: Palette): StyledText {
  const lines = wordWrap(computeCells(state), width);
  const win = visibleWindow(lines.length, cursorRow(lines), height);
  const chunks: Chunk[] = [];
  for (let r = win.start; r < win.end; r++) {
    for (const cell of lines[r]!) chunks.push(cellToChunk(cell, palette));
    if (r < win.end - 1) chunks.push(chunk("\n"));
  }
  return new StyledText(chunks);
}

/**
 * Post-run panel: the five headline metrics, the ranked slow-pairs list, then
 * the excerpt replayed as a digraph heat map (per-cell backgrounds). The heat
 * map appears only here — never during a run (PRD story 23).
 */
function buildResultsPanel(
  state: SessionState,
  now: number,
  width: number,
  height: number,
  palette: Palette,
  strings: UIStrings,
): StyledText {
  const result = buildResult(state, now);
  // Accumulate rows (each a chunk list), then join with newlines once — the row
  // count is the single source of truth for the remaining heat-map budget, so
  // no hand-kept line math can drift out of sync with what is emitted.
  const rows: Chunk[][] = [];

  for (const line of formatResultPanel(result, strings.results)) {
    rows.push([chunk(line, palette.correct)]);
  }

  const slowPairs = formatSlowPairs(result.digraphs.rankedPairs);
  if (slowPairs.length > 0) {
    rows.push([], [chunk(strings.results.slowestPairs, palette.chrome)]);
    for (const line of slowPairs) rows.push([chunk(line, palette.wrong)]);
  }

  // Heat-map replay of the excerpt, wrapped to width and windowed to whatever
  // height remains under the metrics + slow-pairs block (cursor is always 0 —
  // this is a static replay, so the top of the excerpt stays anchored).
  const heatLines = wordWrap(computeHeatCells(state.target, result.digraphs.samples), width);
  const remaining = height - rows.length - 1; // -1 for the blank spacer row
  if (remaining >= 1 && heatLines.length > 0) {
    rows.push([]); // blank spacer above the heat map
    const win = visibleWindow(heatLines.length, 0, remaining);
    for (let r = win.start; r < win.end; r++) {
      rows.push(heatLines[r]!.map((cell) => heatCellToChunk(cell, palette, TRUECOLOR)));
    }
  }

  const chunks: Chunk[] = [];
  rows.forEach((row, i) => {
    chunks.push(...row);
    if (i < rows.length - 1) chunks.push(chunk("\n"));
  });
  return new StyledText(chunks);
}

/**
 * The profile overlay: history trends read from local storage. Braille WPM and
 * accuracy charts plus best/avg/recent headline stats, laid out to the surface
 * width/height. Read once per open/resize (never per-tick), so `store.all()`'s
 * compaction cost stays off the render loop.
 */
function buildProfilePanel(
  store: SessionStore,
  width: number,
  height: number,
  palette: Palette,
  strings: UIStrings,
): StyledText {
  const chartWidth = Math.max(1, width);
  // Split the surface height between the two metric charts, reserving rows for
  // the title, the two stat headlines, and spacers (~5 chrome rows).
  const chartHeight = Math.max(1, Math.floor((height - 5) / 2));
  const lines = formatProfile(buildProfile(store.all()), chartWidth, chartHeight, strings.profile);
  // Never overflow the surface into the footer — window to the visible height
  // (from the top), matching how the typing/results panels clamp their content.
  const win = visibleWindow(lines.length, 0, height);
  const visible = lines.slice(win.start, win.end);

  const chunks: Chunk[] = [];
  visible.forEach((line, i) => {
    // Braille chart rows carry the trend color; text rows are chrome.
    const color = /[⠀-⣿]/.test(line) ? palette.correct : palette.chrome;
    chunks.push(chunk(line, color));
    if (i < visible.length - 1) chunks.push(chunk("\n"));
  });
  return new StyledText(chunks);
}

/** Persistent hint bar: duration + category + theme + locale + controls. */
function buildFooter(
  state: SessionState,
  category: string,
  overlay: "profile" | null,
  palette: Palette,
  locale: Locale,
  strings: UIStrings,
): StyledText {
  if (overlay === "profile") {
    return new StyledText([chunk(strings.profile.closeHint, palette.chrome)]);
  }
  const f = strings.footer;
  // The duration hint only applies before a run starts (ready); mid-run it is
  // locked and post-run it is a settled fact.
  const gate = sessionStatus(state) === "ready" ? ` · ${f.durationHint}` : "";
  // Category shows its localized display name; theme/locale show their stable
  // identifiers (slate/rush, en/pt-BR) so the active choice is unambiguous.
  const categoryLabel = strings.categories[category] ?? category;
  return new StyledText([
    chunk(
      `${f.duration} ${state.durationSeconds}s · ${f.category} ${categoryLabel} · ` +
        `${f.theme} ${palette.name} · ${f.locale} ${locale}${gate} · ${f.hints}`,
      palette.chrome,
    ),
  ]);
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
