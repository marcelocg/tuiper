// Pure braille line-chart renderer: a numeric series → an array of text lines.
// Hand-rolled (no chart dep, per the PRD) so the profile's WPM/accuracy trends
// draw with terminal-native primitives. Each Unicode braille cell (U+2800…28FF)
// packs a 2-wide × 4-tall dot matrix, so a `width`×`height` chart plots onto
// 2·width dot-columns and 4·height dot-rows — eight times the resolution of the
// character grid. Stays free of OpenTUI so the chart can be asserted as strings.

/** The empty braille cell — a blank canvas tile. */
export const BRAILLE_BLANK = "⠀";

const BRAILLE_BASE = 0x2800;

// Dot bit per (column, row): the braille numbering packs dots 1,2,3,7 down the
// left column and 4,5,6,8 down the right. Indexed [col 0|1][row 0..3].
const DOT_BITS: readonly [number, number, number, number][] = [
  [0x01, 0x02, 0x04, 0x40], // left column, top→bottom
  [0x08, 0x10, 0x20, 0x80], // right column, top→bottom
];

/**
 * A `height`-line braille line chart of `values`, each line `width` cells wide.
 * The series is spread across the full width (nearest-sample per dot-column) and
 * normalized between its own min and max; higher values sit nearer the top. An
 * empty series yields a blank canvas; a flat series plots along a middle row.
 */
export function brailleChart(
  values: readonly number[],
  width: number,
  height: number,
): string[] {
  const cols = Math.max(1, Math.floor(width));
  const rows = Math.max(1, Math.floor(height));
  const dotCols = cols * 2;
  const dotRows = rows * 4;

  const grid: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length > 0) {
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    const span = max - min;

    for (let dotCol = 0; dotCol < dotCols; dotCol++) {
      const value = sampleAt(values, dotCol, dotCols);
      if (!Number.isFinite(value)) continue;

      // Normalize into 0..1 (flat series → mid), then to a dot-row from the top.
      const norm = span === 0 ? 0.5 : (value - min) / span;
      const dotRow = Math.round((1 - norm) * (dotRows - 1));

      const cellCol = Math.floor(dotCol / 2);
      const cellRow = Math.floor(dotRow / 4);
      grid[cellRow]![cellCol]! |= DOT_BITS[dotCol % 2]![dotRow % 4]!;
    }
  }

  return grid.map((row) => row.map((bits) => String.fromCodePoint(BRAILLE_BASE + bits)).join(""));
}

/** Nearest series value for a dot-column, spreading the series across the width. */
function sampleAt(values: readonly number[], dotCol: number, dotCols: number): number {
  const n = values.length;
  if (n === 0) return NaN;
  if (n === 1) return values[0]!;
  const t = dotCols <= 1 ? 1 : dotCol / (dotCols - 1);
  return values[Math.round(t * (n - 1))]!;
}
