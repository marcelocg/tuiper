// The Styled Row — the unit every pure view mapper emits across the view seam.
// A Row is one screen line as a list of Spans; a Span carries color *intent*
// (a Role, or a continuous heat value) never a concrete color. The shell's Paint
// adapter (src/shell/theme.ts) resolves intent -> RGBA. Keeping color intent
// below the seam lets every screen's coloring be snapshot-tested on plain data,
// without a TTY. See CONTEXT.md ("The view seam").

import type { CharCell } from "./typing_view";

/** The closed set of discrete color intents a Span can carry. Total: Paint must
 *  resolve every role, so a missing color fails typecheck. */
export type Role = "correct" | "wrong" | "pending" | "chrome" | "title" | "cursor";

/** A run of text carrying its color intent — a discrete role or continuous heat. */
export type Span = { readonly text: string; readonly role: Role } | { readonly text: string; readonly heat: number };

/** One screen line. */
export type Row = readonly Span[];

/** Build a discrete-role span. */
export function span(role: Role, text: string): Span {
  return { text, role };
}

/** Build a continuous heat span (digraph heat-map replay). */
export function heat(text: string, value: number): Span {
  return { text, heat: value };
}

/** Project a laid-out CharCell grid (typing surface / heat-map replay) onto Rows.
 *  The block cursor wins over its status; a cell carrying heat becomes a heat
 *  span; otherwise the typed status is the role. Keeps CharCell/wordWrap as the
 *  typing view's internal representation — this is the bridge to the seam. */
export function cellsToRows(cells: ReadonlyArray<ReadonlyArray<CharCell>>): Row[] {
  return cells.map((line) =>
    line.map((c) => {
      if (c.cursor) return span("cursor", c.char);
      if (c.heat !== undefined) return heat(c.char, c.heat);
      return span(c.status, c.char);
    }),
  );
}

/** A scroll window over a Row list: the first visible line and its extent. */
export interface Window {
  /** Desired first visible line; clamped so a full `height` window stays filled. */
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Window a Row list to `height` lines from `top` (top-anchored, clamped) and
 *  clip each row to `width`. The single shared "fit content to the box" step —
 *  cursor-biased scrolling is decided upstream by `visibleWindow`, whose start
 *  feeds `top`. */
export function windowClip(rows: readonly Row[], win: Window): Row[] {
  const height = Math.max(1, Math.floor(win.height));
  const maxTop = Math.max(0, rows.length - height);
  const start = Math.max(0, Math.min(Math.floor(win.top), maxTop));
  const width = Math.floor(win.width);
  return rows.slice(start, start + height).map((row) => clipRow(row, width));
}

/** Set a span's text, preserving its discrete/heat arm. */
function withText(s: Span, text: string): Span {
  return "heat" in s ? { text, heat: s.heat } : { text, role: s.role };
}

/** Clip a Row to at most `width` cells across its spans, marking truncation with
 *  an ellipsis on the boundary span (mirrors the shell's old `clipTo`). */
function clipRow(row: Row, width: number): Row {
  let total = 0;
  for (const s of row) total += [...s.text].length;
  if (total <= width) return row;

  const budget = width <= 1 ? Math.max(0, width) : width - 1; // reserve a cell for "…"
  const out: Span[] = [];
  let used = 0;
  for (const s of row) {
    if (used >= budget) break;
    const chars = [...s.text];
    const take = Math.min(chars.length, budget - used);
    out.push(take === chars.length ? s : withText(s, chars.slice(0, take).join("")));
    used += take;
  }
  // Mark truncation on the last kept span (unless width is too small for one).
  if (width > 1 && out.length > 0) {
    const last = out[out.length - 1]!;
    out[out.length - 1] = withText(last, last.text + "…");
  }
  return out;
}

/** The plain text of each row (span texts concatenated). A projection for
 *  assertions — it reads content while ignoring roles, so a test can check text
 *  and color intent separately. Test-only today; it is deliberately NOT a second
 *  rendering adapter (see docs/adr/0002-row-list-as-the-view-seam.md). */
export function rowsText(rows: readonly Row[]): string[] {
  return rows.map((row) => row.map((s) => s.text).join(""));
}
