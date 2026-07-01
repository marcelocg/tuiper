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
  createSession,
  finish,
  remainingSeconds,
  sessionStatus,
  shouldFinish,
  type SessionState,
} from "../engine/session_state";
import {
  computeCells,
  cursorRow,
  visibleWindow,
  wordWrap,
} from "../engine/typing_view";
import { cellToChunk, chunk, slate, type Chunk } from "./theme";

// Thin OpenTUI shell above the engine seam: it translates real key events into
// engine commands, applies them, and renders engine view data to the terminal.
// All correctness-critical logic lives below the seam (pure, unit-tested).
// The shell owns exactly two impure jobs: stamping `performance.now()` on each
// key/tick, and driving the 100ms countdown/auto-finish loop.

const EXCERPT =
  "It is a truth universally acknowledged, that a single man in possession " +
  "of a good fortune, must be in want of a wife.";

const SURFACE_TOP = 2;
const FOOTER_RESERVE = 2; // blank line + footer

export async function runApp(): Promise<CliRenderer> {
  const renderer = await createCliRenderer({
    targetFps: 10, // ~100ms tick (frank_type cadence)
    useKittyKeyboard: {}, // disambiguates Backspace family; emits release events
    exitOnCtrlC: false, // we handle quit ourselves
  });

  let state: SessionState = createSession(EXCERPT);

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
  const footer = new TextRenderable(renderer, {
    content: "",
    position: "absolute",
    top: Math.max(SURFACE_TOP + 1, renderer.height - 1),
    left: 0,
  });
  for (const r of [header, surface, footer]) renderer.root.add(r);

  function surfaceHeight(): number {
    return Math.max(1, renderer.height - SURFACE_TOP - FOOTER_RESERVE);
  }

  function draw(now: number): void {
    header.content = buildHeader(state, now);
    surface.content = buildSurface(state, renderer.width, surfaceHeight());
    footer.content = buildFooter(state);
  }

  renderer.keyInput.on("keypress", (e: OpenTuiKeyEvent) => {
    const now = performance.now(); // stamp on receipt (input is per-keystroke)
    const cmd = mapKeyToCommand(e, state);
    if (cmd.kind === "quit") {
      cleanup(renderer);
      return;
    }
    const next = applyCommand(state, cmd, now);
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
    if (shouldFinish(state, now)) state = finish(state, now);
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

/** Persistent hint bar: duration + controls. */
function buildFooter(state: SessionState): StyledText {
  // The duration hint only applies before a run starts (ready); mid-run it is
  // locked and post-run it is a settled fact.
  const gate = sessionStatus(state) === "ready" ? " · 1/2/3 duration" : "";
  return new StyledText([
    chunk(
      `Duration ${state.durationSeconds}s${gate} · Backspace correct · Ctrl-C quit`,
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
