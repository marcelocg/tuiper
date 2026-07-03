import type { SessionResult } from "./session_result";
import { stringsFor, type ResultsStrings } from "./strings";

// Pure view mapping for the post-run results panel: SessionResult -> text lines.
// The shell paints these onto the terminal; keeping the layout pure lets the
// panel be asserted line-for-line without a TTY. Stat labels come from the
// injected locale table (defaults to English) so the panel is localized without
// leaving the seam.

const LABEL_WIDTH = 12;

function row(label: string, value: string): string {
  return label.padEnd(LABEL_WIDTH) + value;
}

/** The five headline metrics a user reviews after a run, one per line. */
export function formatResultPanel(
  result: SessionResult,
  strings: ResultsStrings = stringsFor("en").results,
): string[] {
  const m = result.metrics;
  return [
    row(strings.wpm, String(m.wpm)),
    row(strings.rawWpm, String(m.rawWpm)),
    row(strings.accuracy, `${m.accuracy}%`),
    row(strings.mistakes, String(m.mistakes)),
    row(strings.completion, `${m.completion}%`),
  ];
}
