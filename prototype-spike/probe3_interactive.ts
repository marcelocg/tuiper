// PROTOTYPE SPIKE — throwaway. Interactive TTY probe for unknowns #1 (live
// timing), #3 (100ms loop / flicker), #4 (paste discard), #5 (resize), and a
// visual re-check of #2 (per-cell truecolor). RUN IN A REAL TERMINAL:
//   bun prototype-spike/probe3_interactive.ts
// Type to see per-key deltas; paste to see it discarded; resize the window;
// watch the race glyph animate at 10fps. Press q or Ctrl-C to quit.
import {
  createCliRenderer, TextRenderable, StyledText, RGBA, hsvToRgb, type KeyEvent,
} from "@opentui/core";

const renderer = await createCliRenderer({
  targetFps: 10,               // #3: 100ms frame cadence
  useKittyKeyboard: {},        // #1: enables release events + Ctrl-Backspace disambiguation
  exitOnCtrlC: false,          // we handle quit ourselves
});

// --- state ---
let lastTs: number | null = null;
const log: string[] = [];
let pasteNote = "";
let sizeNote = `size ${renderer.width}x${renderer.height}`;
let frame = 0;

function push(s: string) { log.unshift(s); log.length = Math.min(log.length, 8); }

// helper: build a StyledText where each char has its own fg+bg (per-cell truecolor)
function heatBar(width: number): StyledText {
  const chunks = [];
  for (let i = 0; i < width; i++) {
    const heat = i / (width - 1);                 // 0..1
    const bg = hsvToRgb((1 - heat) * 0.33, 0.9, 0.9); // green->red gradient
    chunks.push({ __isChunk: true as const, text: " ", fg: RGBA.fromInts(0, 0, 0, 255), bg });
  }
  return new StyledText(chunks);
}

const header = new TextRenderable(renderer, { content: "", top: 0, left: 0 });
const keysView = new TextRenderable(renderer, { content: "", top: 2, left: 0 });
const raceView = new TextRenderable(renderer, { content: "", top: 12, left: 0 });
const heatView = new TextRenderable(renderer, { content: heatBar(40), top: 14, left: 0 });
const footer = new TextRenderable(renderer, { content: "type / paste / resize — q or Ctrl-C to quit", top: 16, left: 0 });
for (const r of [header, keysView, raceView, heatView, footer]) renderer.root.add(r);

// --- #1 live per-keystroke timing + discrimination ---
renderer.keyInput.on("keypress", (e: KeyEvent) => {
  const t = performance.now();                    // stamp on receipt
  const delta = lastTs == null ? 0 : (t - lastTs);
  lastTs = t;
  if (e.eventType === "release") return;          // ignore kitty release for typing
  if (e.name === "q" || (e.ctrl && e.name === "c")) { cleanup(); return; }
  const mods = [e.ctrl && "ctrl", e.meta && "meta", e.option && "opt", e.shift && "shift"].filter(Boolean).join("+");
  push(`${(delta).toFixed(1).padStart(7)}ms  name=${JSON.stringify(e.name).padEnd(12)} ${mods.padEnd(14)} type=${e.eventType} src=${e.source}`);
});

// --- #4 paste: separate event -> discard ---
renderer.keyInput.on("paste", (e) => {
  pasteNote = `PASTE DISCARDED at ${new Date().toISOString().slice(11, 19)} (${e.bytes.length} bytes) — never entered typing buffer`;
});

// --- #5 resize ---
renderer.on("resize", (cols: number, rows: number) => {
  sizeNote = `RESIZE -> ${cols}x${rows}`;
  heatView.content = heatBar(Math.min(40, cols));
});

// --- #3 100ms frame loop, animate race glyph, redraw ---
renderer.setFrameCallback(async (_dt: number) => {
  frame++;
  header.content = `UNKNOWN #1/#3/#4/#5 live probe   frame=${frame}   ${sizeNote}   ${pasteNote}`;
  keysView.content = log.length ? log.join("\n") : "(press keys — Backspace, Esc, Tab, Ctrl-U, Ctrl-C, ?, Ctrl/Alt-Backspace)";
  const lane = 30, pos = frame % lane;
  raceView.content = "race[10fps] |" + "-".repeat(pos) + "#" + "-".repeat(lane - pos - 1) + "|";
});

function cleanup() {
  try { renderer.stop(); } catch {}
  try { (renderer as any).destroy?.(); } catch {}
  process.exit(0);
}
process.on("SIGINT", cleanup);

renderer.start();
