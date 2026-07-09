import { RGBA, StyledText } from "@opentui/core";
import type { CharCell } from "../engine/typing_view";
import type { ThemeName } from "../engine/theme";
import type { Role, Row, Span } from "../engine/view_row";

// The two color themes (Slate / Rush), each mapping frank_type's CSS-variable
// roles to terminal colors. A Palette is the shell-side realization of a
// ThemeName: the engine decides which theme is active, this module supplies its
// colors. The heat-map gradient is theme-independent (a warm ramp), but the
// legible foreground drawn over a hot cell (`heatFg`) comes from the palette.

export interface Palette {
  readonly name: ThemeName;
  /** Not-yet-typed text (also the fg over a cold heat-map cell). */
  readonly pending: RGBA;
  readonly correct: RGBA;
  readonly wrong: RGBA;
  readonly cursorBg: RGBA;
  readonly cursorFg: RGBA;
  /** Muted UI text: header/footer, labels, race track. */
  readonly chrome: RGBA;
  /** Legible foreground for a character sitting on a hot heat-map background. */
  readonly heatFg: RGBA;
}

/** Slate — the cool blue-grey theme (frank_type's default). */
export const slate: Palette = {
  name: "slate",
  pending: RGBA.fromInts(92, 99, 112, 255),
  correct: RGBA.fromInts(126, 200, 130, 255),
  wrong: RGBA.fromInts(232, 96, 96, 255),
  cursorBg: RGBA.fromInts(200, 206, 216, 255),
  cursorFg: RGBA.fromInts(22, 24, 30, 255),
  chrome: RGBA.fromInts(140, 148, 162, 255),
  heatFg: RGBA.fromInts(244, 244, 248, 255),
};

/** Rush — the warm high-energy theme (amber/orange accents). */
export const rush: Palette = {
  name: "rush",
  pending: RGBA.fromInts(120, 108, 96, 255),
  correct: RGBA.fromInts(164, 206, 88, 255),
  wrong: RGBA.fromInts(240, 88, 56, 255),
  cursorBg: RGBA.fromInts(236, 222, 204, 255),
  cursorFg: RGBA.fromInts(30, 22, 16, 255),
  chrome: RGBA.fromInts(198, 158, 116, 255),
  heatFg: RGBA.fromInts(250, 246, 238, 255),
};

const PALETTES: Record<ThemeName, Palette> = { slate, rush };

/** The palette for a theme name. */
export function paletteFor(name: ThemeName): Palette {
  return PALETTES[name];
}

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

/** Map a laid-out CharCell to a colored terminal chunk in the given palette. */
export function cellToChunk(cell: CharCell, palette: Palette): Chunk {
  if (cell.cursor) {
    return chunk(cell.char, palette.cursorFg, palette.cursorBg);
  }
  const fg =
    cell.status === "correct"
      ? palette.correct
      : cell.status === "wrong"
        ? palette.wrong
        : palette.pending;
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
export function heatCellToChunk(cell: CharCell, palette: Palette, truecolor = true): Chunk {
  const bg = heatToBg(cell.heat ?? 0, truecolor);
  return chunk(cell.char, bg ? palette.heatFg : palette.pending, bg);
}

// --- Paint: the view seam's adapter (Styled Rows -> terminal) ----------------

/** Resolve a discrete Role to its palette foreground. `title` reuses `correct`
 *  (byte-for-byte with the old shell) but stays a distinct role so a theme can
 *  diverge later. */
function roleFg(role: Exclude<Role, "cursor">, palette: Palette): RGBA {
  switch (role) {
    case "correct":
    case "title":
      return palette.correct;
    case "wrong":
      return palette.wrong;
    case "pending":
      return palette.pending;
    case "chrome":
      return palette.chrome;
  }
}

/** Map one Span to a colored chunk: heat spans interpolate a background; the
 *  cursor is a fg/bg block; every other role is a plain foreground. */
function spanToChunk(s: Span, palette: Palette, truecolor: boolean): Chunk {
  if ("heat" in s) {
    const bg = heatToBg(s.heat, truecolor);
    return chunk(s.text, bg ? palette.heatFg : palette.pending, bg);
  }
  if (s.role === "cursor") return chunk(s.text, palette.cursorFg, palette.cursorBg);
  return chunk(s.text, roleFg(s.role, palette));
}

/** Flatten Rows to chunks in the active palette, a newline chunk between rows
 *  (never trailing). The assertable core of `paint`. */
export function rowsToChunks(rows: readonly Row[], palette: Palette, truecolor = true): Chunk[] {
  const chunks: Chunk[] = [];
  rows.forEach((row, i) => {
    for (const s of row) chunks.push(spanToChunk(s, palette, truecolor));
    if (i < rows.length - 1) chunks.push(chunk("\n"));
  });
  return chunks;
}

/** The Paint adapter: Styled Rows -> OpenTUI StyledText. The one place terminal
 *  color is realized; kept assembly-only (layout is `windowClip`, below the seam). */
export function paint(rows: readonly Row[], palette: Palette, truecolor = true): StyledText {
  return new StyledText(rowsToChunks(rows, palette, truecolor));
}
