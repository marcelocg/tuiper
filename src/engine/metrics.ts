// Pure metrics — a 1:1 port of frank_type's app/javascript/lib/typing/metrics.js
// (calculateMetrics + summarizeWords). The formulas and constants are reproduced
// byte-for-byte; golden values are pinned in test/engine/metrics.test.ts, ported
// from frank_type's own typing_metrics.test.mjs. No OpenTUI/TTY/fs — data in,
// data out (the engine seam).
//
// The digraph analysis (summarizeDigraphs) lives in the same frank_type file but
// belongs to the post-run heat-map slice; it is deferred to that issue. The
// per-character timings captured by the session engine already feed it.

/** One entry of the session key log, as far as metrics care. */
export interface TypedEvent {
  readonly action: "type" | "backspace";
  /** Present on `type` events: did the keystroke match the expected char. */
  readonly correct?: boolean;
}

export interface Metrics {
  readonly wpm: number;
  readonly rawWpm: number;
  readonly accuracy: number;
  readonly typedCharacters: number;
  readonly correctCharacters: number;
  readonly mistakes: number;
  readonly completion: number;
}

export interface MetricsInput {
  readonly typedEvents?: readonly TypedEvent[];
  readonly correctCharacters?: number;
  readonly elapsedMs?: number;
  readonly targetText?: string;
}

export function calculateMetrics({
  typedEvents = [],
  correctCharacters = 0,
  elapsedMs = 0,
  targetText = "",
}: MetricsInput): Metrics {
  const typedCharacters = typedEvents.filter((event) => event.action === "type").length;
  const mistakes = typedEvents.filter(
    (event) => event.action === "type" && !event.correct,
  ).length;
  const minutes = Math.max(elapsedMs / 60000, 1 / 60000);

  return {
    wpm: Math.round(correctCharacters / 5 / minutes),
    rawWpm: Math.round(typedCharacters / 5 / minutes),
    accuracy:
      typedCharacters === 0
        ? 100
        : Math.max(0, Math.round(((typedCharacters - mistakes) / typedCharacters) * 100)),
    typedCharacters,
    correctCharacters,
    mistakes,
    completion:
      targetText.length === 0
        ? 0
        : Math.round((correctCharacters / targetText.length) * 100),
  };
}

/** Minimal timing shape summarizeWords reads (a subset of CharTiming). */
export interface WordTiming {
  readonly index: number;
  readonly elapsedMs: number;
  readonly correct: boolean;
}

export interface WordSummary {
  readonly word: string;
  readonly wordIndex: number;
  readonly startIndex: number;
  readonly endIndex: number;
  /** Press span across the word's characters, or null if none were typed. */
  readonly elapsedMs: number | null;
  readonly correct: boolean;
}

export function summarizeWords({
  text,
  characterTimings,
}: {
  readonly text: string;
  readonly characterTimings: readonly WordTiming[];
}): WordSummary[] {
  const words = text.split(" ");
  const summaries: WordSummary[] = [];
  let cursor = 0;

  words.forEach((word, wordIndex) => {
    const startIndex = cursor;
    const endIndex = cursor + word.length - 1;
    const timings = characterTimings.filter(
      (timing) => timing.index >= startIndex && timing.index <= endIndex,
    );
    const first = timings.at(0);
    const last = timings.at(-1);

    summaries.push({
      word,
      wordIndex,
      startIndex,
      endIndex,
      elapsedMs: first && last ? Math.round(last.elapsedMs - first.elapsedMs) : null,
      correct: timings.length === word.length && timings.every((timing) => timing.correct),
    });

    cursor += word.length + 1;
  });

  return summaries;
}
