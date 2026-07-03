import { RGBA } from "@opentui/core";
import type { CharCell } from "../engine/typing_view";

// Minimal Slate palette for the walking skeleton. The full two-theme system
// (Slate / Rush, runtime-switchable, persisted) is a later slice.
export const slate = {
  pending: RGBA.fromInts(92, 99, 112, 255),
  correct: RGBA.fromInts(126, 200, 130, 255),
  wrong: RGBA.fromInts(232, 96, 96, 255),
  cursorBg: RGBA.fromInts(200, 206, 216, 255),
  cursorFg: RGBA.fromInts(22, 24, 30, 255),
  chrome: RGBA.fromInts(140, 148, 162, 255),
  /** Legible foreground for a character sitting on a hot heat-map background. */
  heatFg: RGBA.fromInts(244, 244, 248, 255),
};

export interface Chunk {
  readonly __isChunk: true;
  readonly text: string;
  readonly fg?: RGBA;
  readonly bg?: RGBA;
}

/** Build a styled terminal chunk, centralizing OpenTUI's chunk shape. */
export function chunk(text: string, fg?: RGBA, bg?: RGBA): Chunk {
  return { __isChunk: true, text, fg, bg };
}

/** Map a laid-out CharCell to a colored terminal chunk. */
export function cellToChunk(cell: CharCell): Chunk {
  if (cell.cursor) {
    return chunk(cell.char, slate.cursorFg, slate.cursorBg);
  }
  const fg =
    cell.status === "correct"
      ? slate.correct
      : cell.status === "wrong"
        ? slate.wrong
        : slate.pending;
  return chunk(cell.char, fg);
}

// --- digraph heat map --------------------------------------------------------

/** The 6-value channel steps of the ansi-256 color cube (indices 16–231). */
const CUBE_STEPS: readonly number[] = [0, 95, 135, 175, 215, 255];

/** Snap one channel (0–255) to the nearest ansi-256 color-cube step. */
function snapToCube(channel: number): number {
  let best = CUBE_STEPS[0]!;
  for (const step of CUBE_STEPS) {
    if (Math.abs(step - channel) < Math.abs(best - channel)) best = step;
  }
  return best;
}

/** HSV (h in degrees 0–360, s/v 0–1) → 0–255 RGB triple. */
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

/**
 * Heat (0–1) → cell background: a warm gradient from amber (cool) to deep red
 * (hot). Heat 0 means no background (`undefined`). When `truecolor` is false the
 * color snaps to the nearest ansi-256 color-cube color (PRD's 256-color
 * fallback via nearest-index mapping).
 */
export function heatToBg(heat: number, truecolor = true): RGBA | undefined {
  if (heat <= 0) return undefined;
  const h = Math.max(0, Math.min(heat, 1));
  const hue = 45 - 45 * h; // amber(45°) → red(0°)
  let [r, g, b] = hsvToRgb(hue, 0.85, 0.4 + 0.25 * h);
  if (!truecolor) {
    r = snapToCube(r);
    g = snapToCube(g);
    b = snapToCube(b);
  }
  return RGBA.fromInts(r, g, b, 255);
}

/** Map a heat-map replay cell to a chunk with a heat-interpolated background. */
export function heatCellToChunk(cell: CharCell, truecolor = true): Chunk {
  const bg = heatToBg(cell.heat ?? 0, truecolor);
  return chunk(cell.char, bg ? slate.heatFg : slate.pending, bg);
}
