import type { SessionState } from "./session_state";
import { charsMatch } from "./text_compare";

// Pure view mapping for the typing surface: SessionState -> laid-out cells.
// The shell turns CharStatus into concrete terminal colors; this layer stays
// free of OpenTUI so screens can be asserted against an in-memory grid.

export type CharStatus = "pending" | "correct" | "wrong";

export interface CharCell {
  /** The EXPECTED character is always shown, so a wrong key never reflows. */
  readonly char: string;
  readonly status: CharStatus;
  /** True for the single cell under the block cursor. */
  readonly cursor: boolean;
}

/**
 * One cell per excerpt character (expected glyph + typed status), plus a
 * trailing block-cursor cell once the whole excerpt has been typed.
 */
export function computeCells(state: Pick<SessionState, "target" | "input">): CharCell[] {
  const { target, input } = state;
  const cells: CharCell[] = [];
  for (let i = 0; i < target.length; i++) {
    const expected = target[i]!;
    let status: CharStatus;
    if (i < input.length) {
      status = charsMatch(expected, input[i]!) ? "correct" : "wrong";
    } else {
      status = "pending";
    }
    cells.push({ char: expected, status, cursor: i === input.length });
  }
  // Cursor sitting just past the last character (excerpt fully typed).
  if (input.length >= target.length) {
    cells.push({ char: " ", status: "pending", cursor: true });
  }
  return cells;
}

function isSpace(cell: CharCell): boolean {
  return cell.char === " ";
}

/**
 * Greedy word-wrap to `width`, never splitting a word that fits on a line.
 * Whitespace that lands at a wrap point is consumed (no leading spaces).
 * Words longer than the width are hard-split. Layout is fixed: the same
 * excerpt always wraps identically regardless of typed correctness.
 */
export function wordWrap(cells: CharCell[], width: number): CharCell[][] {
  const w = Math.max(1, Math.floor(width));
  const lines: CharCell[][] = [];
  let line: CharCell[] = [];
  // When a space carrying the cursor is dropped at a wrap boundary, the cursor
  // is moved onto the next placed cell — the layout stays byte-for-byte fixed
  // (it never depends on typed progress) while the cursor is never lost.
  let carryCursor = false;

  function place(cell: CharCell): void {
    if (carryCursor && !cell.cursor) {
      line.push({ ...cell, cursor: true });
      carryCursor = false;
    } else {
      line.push(cell);
    }
  }

  let i = 0;
  while (i < cells.length) {
    const cell = cells[i]!;
    if (isSpace(cell)) {
      if (line.length >= w) {
        lines.push(line);
        line = [];
        if (cell.cursor) carryCursor = true; // relocate cursor to the next cell
        i++; // drop the space at the wrap boundary (no leading spaces)
        continue;
      }
      place(cell);
      i++;
      continue;
    }

    // Measure the next word (maximal run of non-space cells).
    let j = i;
    while (j < cells.length && !isSpace(cells[j]!)) j++;
    const wordLen = j - i;

    if (wordLen > w) {
      // Word can never fit: hard-split across lines.
      for (let k = i; k < j; k++) {
        if (line.length >= w) {
          lines.push(line);
          line = [];
        }
        place(cells[k]!);
      }
    } else {
      if (line.length + wordLen > w) {
        lines.push(line);
        line = [];
      }
      for (let k = i; k < j; k++) place(cells[k]!);
    }
    i = j;
  }

  // A trailing cursor-space (excerpt fully typed) with nothing after it: give
  // the block cursor its own cell so it still renders past the last character.
  if (carryCursor) {
    if (line.length >= w) {
      lines.push(line);
      line = [];
    }
    line.push({ char: " ", status: "pending", cursor: true });
  }

  lines.push(line);
  return lines;
}

/** Line index holding the cursor cell, or 0 if none carries it. */
export function cursorRow(lines: CharCell[][]): number {
  for (let r = 0; r < lines.length; r++) {
    if (lines[r]!.some((c) => c.cursor)) return r;
  }
  return 0;
}

export interface Viewport {
  /** First visible line index (inclusive). */
  readonly start: number;
  /** One past the last visible line index (exclusive). */
  readonly end: number;
}

/**
 * Scroll window of at most `height` lines that keeps `cursorRow` visible,
 * biasing the cursor toward the bottom so preceding context stays on screen.
 */
export function visibleWindow(
  lineCount: number,
  cursor: number,
  height: number,
): Viewport {
  const h = Math.max(1, Math.floor(height));
  if (lineCount <= h) return { start: 0, end: lineCount };

  let start = cursor - (h - 1);
  const maxStart = lineCount - h;
  if (start < 0) start = 0;
  if (start > maxStart) start = maxStart;
  return { start, end: start + h };
}
