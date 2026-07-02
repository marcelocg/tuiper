import type { SessionResult } from "./session_result";

// Pure view mapping for the post-run results panel: SessionResult -> text lines.
// The shell paints these onto the terminal; keeping the layout pure lets the
// panel be asserted line-for-line without a TTY.

const LABEL_WIDTH = 12;

function row(label: string, value: string): string {
  return label.padEnd(LABEL_WIDTH) + value;
}

/** The five headline metrics a user reviews after a run, one per line. */
export function formatResultPanel(result: SessionResult): string[] {
  const m = result.metrics;
  return [
    row("WPM", String(m.wpm)),
    row("Raw WPM", String(m.rawWpm)),
    row("Accuracy", `${m.accuracy}%`),
    row("Mistakes", String(m.mistakes)),
    row("Completion", `${m.completion}%`),
  ];
}
