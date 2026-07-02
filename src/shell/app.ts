import {
  createCliRenderer,
  StyledText,
  TextRenderable,
  type CliRenderer,
  type KeyEvent as OpenTuiKeyEvent,
} from "@opentui/core";
import { mapKeyToCommand } from "../engine/input_intent";
import { applyCommand, createSession, type SessionState } from "../engine/session_state";
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
    content: new StyledText([chunk("tuiper — type the text below", slate.chrome)]),
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
    content: new StyledText([
      chunk("Ctrl-C to quit · Backspace to correct", slate.chrome),
    ]),
    position: "absolute",
    top: Math.max(SURFACE_TOP + 1, renderer.height - 1),
    left: 0,
  });
  for (const r of [header, surface, footer]) renderer.root.add(r);

  function surfaceHeight(): number {
    return Math.max(1, renderer.height - SURFACE_TOP - FOOTER_RESERVE);
  }

  function draw(): void {
    surface.content = buildSurface(state, renderer.width, surfaceHeight());
  }

  renderer.keyInput.on("keypress", (e: OpenTuiKeyEvent) => {
    const cmd = mapKeyToCommand(e, state);
    if (cmd.kind === "quit") {
      cleanup(renderer);
      return;
    }
    const next = applyCommand(state, cmd);
    if (next !== state) {
      state = next;
      draw();
      renderer.requestRender();
    }
  });

  // --- paste: separate event; discard so it never registers as typed input ---
  renderer.keyInput.on("paste", () => {
    /* rejected — pasted bursts must not fake a run */
  });

  renderer.on("resize", () => {
    footer.top = Math.max(SURFACE_TOP + 1, renderer.height - 1);
    draw();
    renderer.requestRender();
  });

  // Event-driven redraw: the surface only changes on a keypress or resize, so
  // there is no per-frame work until the animation slices (race strip) land.
  draw();
  renderer.start();
  return renderer;
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

export function cleanup(renderer: CliRenderer): void {
  try {
    renderer.stop();
  } catch {}
  try {
    (renderer as unknown as { destroy?: () => void }).destroy?.();
  } catch {}
  process.exit(0);
}
