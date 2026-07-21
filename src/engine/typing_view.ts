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
  /** Post-run digraph heat (0–1) for the heat-map replay; absent while typing. */
  readonly heat?: number;
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

/** One wrapped display line as a half-open range over the source sequence.
 *  `end` excludes a space dropped at a wrap boundary, so `end` is not always the
 *  next line's `start`. */
interface LineSegment {
  readonly start: number;
  readonly end: number;
}

/**
 * THE greedy wrap rule, in one place. Walks a sequence of `length` items —
 * `isSpaceAt` tells it which are spaces — and returns the display lines as
 * ranges. Three rules, matching frank_type:
 *   - a space landing at a full line is consumed (no leading spaces);
 *   - a word longer than the width is hard-split;
 *   - a word that would overflow moves whole to the next line.
 *
 * Both consumers derive from this: `wordWrap` slices cells by these ranges, and
 * `visualLineStarts` reads their starts. They cannot disagree — which matters
 * because Ctrl-U deletes to a line start that must land exactly where the
 * rendered text broke.
 */
function wrapSegments(
  length: number,
  isSpaceAt: (index: number) => boolean,
  width: number,
): LineSegment[] {
  const w = Math.max(1, Math.floor(width));
  const segments: LineSegment[] = [];
  let start = 0;
  let lineLen = 0;
  let i = 0;

  while (i < length) {
    if (isSpaceAt(i)) {
      if (lineLen >= w) {
        segments.push({ start, end: i }); // drop the space at the boundary
        start = i + 1;
        lineLen = 0;
        i++;
        continue;
      }
      lineLen++;
      i++;
      continue;
    }

    // Measure the next word (maximal run of non-space items).
    let j = i;
    while (j < length && !isSpaceAt(j)) j++;
    const wordLen = j - i;

    if (wordLen > w) {
      // Word can never fit: hard-split across lines.
      for (let k = i; k < j; k++) {
        if (lineLen >= w) {
          segments.push({ start, end: k });
          start = k;
          lineLen = 0;
        }
        lineLen++;
      }
    } else {
      if (lineLen + wordLen > w) {
        segments.push({ start, end: i });
        start = i;
        lineLen = 0;
      }
      lineLen += wordLen;
    }
    i = j;
  }

  segments.push({ start, end: length });
  return segments;
}

/**
 * Greedy word-wrap to `width`, never splitting a word that fits on a line.
 * Whitespace that lands at a wrap point is consumed (no leading spaces).
 * Words longer than the width are hard-split. Layout is fixed: the same
 * excerpt always wraps identically regardless of typed correctness.
 */
export function wordWrap(cells: CharCell[], width: number): CharCell[][] {
  const w = Math.max(1, Math.floor(width));
  const segments = wrapSegments(cells.length, (i) => isSpace(cells[i]!), width);
  const lines: CharCell[][] = [];
  // When a space carrying the cursor is dropped at a wrap boundary, the cursor
  // is moved onto the next placed cell — the layout stays byte-for-byte fixed
  // (it never depends on typed progress) while the cursor is never lost.
  let carryCursor = false;

  segments.forEach((segment, s) => {
    const line: CharCell[] = [];
    for (let k = segment.start; k < segment.end; k++) {
      const cell = cells[k]!;
      if (carryCursor && !cell.cursor) {
        line.push({ ...cell, cursor: true });
        carryCursor = false;
      } else {
        line.push(cell);
      }
    }
    // A space between this segment and the next was dropped at the boundary; if
    // it carried the cursor, relocate it onto the next cell placed.
    const next = segments[s + 1];
    if (next && next.start === segment.end + 1 && cells[segment.end]!.cursor) {
      carryCursor = true;
    }
    lines.push(line);
  });

  // A trailing cursor-space (excerpt fully typed) with nothing after it: give
  // the block cursor its own cell so it still renders past the last character.
  if (carryCursor) {
    if (lines[lines.length - 1]!.length >= w) lines.push([]);
    lines[lines.length - 1]!.push({ char: " ", status: "pending", cursor: true });
  }

  return lines;
}

/**
 * Target-text indices at which each wrapped display line begins, for `width`.
 * Shares `wordWrap`'s break rule (see `wrapSegments`), so a break here lands
 * exactly where `wordWrap` breaks. Drives delete-to-line-start (Ctrl-U).
 */
export function visualLineStarts(target: string, width: number): number[] {
  return wrapSegments(target.length, (i) => target[i] === " ", width).map(
    (segment) => segment.start,
  );
}

/**
 * Target index at the start of the wrapped line holding `cursor` (input.length),
 * never past `cursor`. Mirrors frank_type's `currentVisualLineStartIndex`: it
 * references the char under the cursor (or the last char when the cursor sits
 * past the end) and returns that line's first index.
 */
export function visualLineStartIndex(
  target: string,
  cursor: number,
  width: number,
): number {
  if (cursor <= 0) return 0;
  const ref = cursor >= target.length ? Math.max(target.length - 1, 0) : cursor;
  let start = 0;
  for (const s of visualLineStarts(target, width)) {
    if (s <= ref) start = s;
    else break;
  }
  return Math.min(start, cursor);
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
