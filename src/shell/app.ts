import {
  createCliRenderer,
  StyledText,
  TextRenderable,
  type CliRenderer,
  type KeyEvent as OpenTuiKeyEvent,
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
import { cellToChunk, chunk, heatCellToChunk, slate, type Chunk } from "./theme";

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

  // Corpus + adaptive selection (#5). Locale is fixed to English until the
  // locale-switch slice lands; the store feeds the speed band and receives
  // finished runs.
  const store = new SessionStore(new FileStorage());
  const excerpts: readonly Excerpt[] = excerptsForLocale("en");
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
      header.content = buildHeader(state, now);
      surface.content = buildProfilePanel(store, renderer.width, surfaceHeight());
      raceStrip.content = "";
      footer.content = buildFooter(state, category, overlay);
      return;
    }
    header.content = buildHeader(state, now);
    surface.content =
      sessionStatus(state) === "finished"
        ? buildResultsPanel(state, now, renderer.width, surfaceHeight())
        : buildSurface(state, renderer.width, surfaceHeight());
    // Anchor the race strip to the blank row just under the surface.
    raceStrip.top = SURFACE_TOP + surfaceHeight() + 1;
    raceStrip.content =
      sessionStatus(state) === "active" ? buildRaceStrip(state, now, renderer.width) : "";
    footer.content = buildFooter(state, category, overlay);
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
function buildHeader(state: SessionState, now: number): StyledText {
  const status = sessionStatus(state);
  if (status === "finished") {
    return new StyledText([
      chunk(`Time! ${state.durationSeconds}s drill complete — `, slate.correct),
      chunk("Ctrl-C to quit", slate.chrome),
    ]);
  }
  const secs = remainingSeconds(state, now);
  const label = status === "active" ? "typing" : "ready";
  return new StyledText([
    chunk(`${secs}s`, secs <= 5 ? slate.wrong : slate.chrome),
    chunk(`  ·  ${label}`, slate.chrome),
  ]);
}

/** Per-lane glyph color: the user chases the fast marker, ahead of the slow one. */
const RACE_GLYPH_COLOR = {
  slow: slate.pending,
  you: slate.correct,
  fast: slate.wrong,
} as const;

/**
 * The live race strip: three labeled lanes (Slow 60 / You / Fast 140) with a
 * glyph advancing on each 100ms tick. The user's live WPM drives their marker,
 * computed from the same metrics the results panel uses so the chase matches the
 * final number.
 */
function buildRaceStrip(state: SessionState, now: number, width: number): StyledText {
  const elapsed = elapsedMs(state, now);
  const userWpm = calculateMetrics({
    typedEvents: state.events,
    correctCharacters: correctCharacters(state),
    elapsedMs: elapsed,
    targetText: state.target,
  }).wpm;
  const trackWidth = Math.max(1, width - LABEL_WIDTH - 1);
  const lanes = raceLanes(
    { elapsedMs: elapsed, durationSeconds: state.durationSeconds, userWpm },
    trackWidth,
  );

  const chunks: Chunk[] = [];
  lanes.forEach((lane, i) => {
    chunks.push(chunk(`${lane.label.padEnd(LABEL_WIDTH)} `, slate.chrome));
    if (lane.glyphIndex > 0) chunks.push(chunk(TRACK_FILL.repeat(lane.glyphIndex), slate.chrome));
    chunks.push(chunk(lane.track[lane.glyphIndex]!, RACE_GLYPH_COLOR[lane.id]));
    const trailing = lane.track.length - lane.glyphIndex - 1;
    if (trailing > 0) chunks.push(chunk(TRACK_FILL.repeat(trailing), slate.chrome));
    if (i < lanes.length - 1) chunks.push(chunk("\n"));
  });
  return new StyledText(chunks);
}

/** Render the current session onto the typing surface as a StyledText grid. */
function buildSurface(state: SessionState, width: number, height: number): StyledText {
  const lines = wordWrap(computeCells(state), width);
  const win = visibleWindow(lines.length, cursorRow(lines), height);
  const chunks: Chunk[] = [];
  for (let r = win.start; r < win.end; r++) {
    for (const cell of lines[r]!) chunks.push(cellToChunk(cell));
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
): StyledText {
  const result = buildResult(state, now);
  // Accumulate rows (each a chunk list), then join with newlines once — the row
  // count is the single source of truth for the remaining heat-map budget, so
  // no hand-kept line math can drift out of sync with what is emitted.
  const rows: Chunk[][] = [];

  for (const line of formatResultPanel(result)) rows.push([chunk(line, slate.correct)]);

  const slowPairs = formatSlowPairs(result.digraphs.rankedPairs);
  if (slowPairs.length > 0) {
    rows.push([], [chunk("Slowest pairs", slate.chrome)]);
    for (const line of slowPairs) rows.push([chunk(line, slate.wrong)]);
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
      rows.push(heatLines[r]!.map((cell) => heatCellToChunk(cell, TRUECOLOR)));
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
function buildProfilePanel(store: SessionStore, width: number, height: number): StyledText {
  const chartWidth = Math.max(1, width);
  // Split the surface height between the two metric charts, reserving rows for
  // the title, the two stat headlines, and spacers (~5 chrome rows).
  const chartHeight = Math.max(1, Math.floor((height - 5) / 2));
  const lines = formatProfile(buildProfile(store.all()), chartWidth, chartHeight);
  // Never overflow the surface into the footer — window to the visible height
  // (from the top), matching how the typing/results panels clamp their content.
  const win = visibleWindow(lines.length, 0, height);
  const visible = lines.slice(win.start, win.end);

  const chunks: Chunk[] = [];
  visible.forEach((line, i) => {
    // Braille chart rows carry the trend color; text rows are chrome.
    const color = /[⠀-⣿]/.test(line) ? slate.correct : slate.chrome;
    chunks.push(chunk(line, color));
    if (i < visible.length - 1) chunks.push(chunk("\n"));
  });
  return new StyledText(chunks);
}

/** Persistent hint bar: duration + category + controls. */
function buildFooter(state: SessionState, category: string, overlay: "profile" | null): StyledText {
  if (overlay === "profile") {
    return new StyledText([chunk("Profile · any key to close · Ctrl-C quit", slate.chrome)]);
  }
  // The duration hint only applies before a run starts (ready); mid-run it is
  // locked and post-run it is a settled fact.
  const gate = sessionStatus(state) === "ready" ? " · 1/2/3 duration" : "";
  return new StyledText([
    chunk(
      `Duration ${state.durationSeconds}s · Category ${category}${gate} · ` +
        `Tab next · c category · p profile · Bksp char · Ctrl-Bksp word · Ctrl-U line · Ctrl-C quit`,
      slate.chrome,
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
