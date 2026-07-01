// PROTOTYPE SPIKE — throwaway. Unknown #2: per-cell 24-bit truecolor.
// Headless proof: create a native OptimizedBuffer, write 3 adjacent cells each
// with a DISTINCT fg+bg RGBA, then read the raw fg/bg arrays back to confirm
// every cell holds its own independent 24-bit color. Also exercises hsvToRgb
// (heat-map interpolation) and ansi256IndexToRgb (256-color fallback).
import { OptimizedBuffer, RGBA, hsvToRgb, ansi256IndexToRgb } from "@opentui/core";

const buf = OptimizedBuffer.create(8, 1, "wcwidth");

const cells = [
  { x: 0, ch: "A", fg: RGBA.fromInts(255, 0, 0, 255),   bg: RGBA.fromInts(10, 20, 30, 255) },
  { x: 1, ch: "B", fg: RGBA.fromInts(0, 255, 0, 255),   bg: RGBA.fromInts(40, 50, 60, 255) },
  { x: 2, ch: "C", fg: RGBA.fromInts(0, 0, 255, 255),   bg: RGBA.fromInts(70, 80, 90, 255) },
];
for (const c of cells) buf.setCell(c.x, 0, c.ch, c.fg, c.bg);

const { fg, bg } = buf.buffers; // raw arrays, 4 channels per cell (r,g,b,a in 0..255)
function readInts(arr: ArrayLike<number>, x: number) {
  const o = x * 4;
  return [0, 1, 2].map(i => Math.round(arr[o + i]));
}

let ok = true;
for (const c of cells) {
  const gotFg = readInts(fg, c.x);
  const gotBg = readInts(bg, c.x);
  const wantFg = c.fg.toInts().slice(0, 3);
  const wantBg = c.bg.toInts().slice(0, 3);
  const match = JSON.stringify(gotFg) === JSON.stringify(wantFg) && JSON.stringify(gotBg) === JSON.stringify(wantBg);
  ok = ok && match;
  console.log(`cell '${c.ch}' fg=${gotFg} bg=${gotBg}  ${match ? "GREEN (distinct 24-bit)" : "RED mismatch"}`);
}

const heat = hsvToRgb(0.0, 0.85, 1.0); // red end of heat scale
console.log("hsvToRgb heat sample ->", heat.toInts(), "(heat-map interpolation available)");
console.log("ansi256IndexToRgb(196) ->", ansi256IndexToRgb(196), "(256-color fallback path available)");
console.log(`\nUNKNOWN #2: per-cell truecolor ${ok ? "GREEN" : "RED"} — each cell holds independent fg+bg RGBA.`);
