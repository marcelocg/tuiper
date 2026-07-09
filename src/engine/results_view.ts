import type { SessionResult } from "./session_result";
import { stringsFor, type ResultsStrings } from "./strings";
import { span, type Row } from "./view_row";

// Pure view mapping for the post-run results panel: SessionResult -> text lines.
// The shell paints these onto the terminal; keeping the layout pure lets the
// panel be asserted line-for-line without a TTY. Stat labels come from the
// injected locale table (defaults to English) so the panel is localized without
// leaving the seam.

const LABEL_WIDTH = 12;

function row(label: string, value: string): string {
  return label.padEnd(LABEL_WIDTH) + value;
}

/** The five headline metrics a user reviews after a run, one Row each — all in
 *  the `correct` role (the post-run headline color). */
export function formatResultPanel(
  result: SessionResult,
  strings: ResultsStrings = stringsFor("en").results,
): Row[] {
  const m = result.metrics;
  return [
    [span("correct", row(strings.wpm, String(m.wpm)))],
    [span("correct", row(strings.rawWpm, String(m.rawWpm)))],
    [span("correct", row(strings.accuracy, `${m.accuracy}%`))],
    [span("correct", row(strings.mistakes, String(m.mistakes)))],
    [span("correct", row(strings.completion, `${m.completion}%`))],
  ];
}
