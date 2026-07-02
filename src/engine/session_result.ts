import {
  calculateMetrics,
  summarizeWords,
  type Metrics,
  type WordSummary,
} from "./metrics";
import {
  correctCharacters,
  elapsedMs,
  type CharTiming,
  type SessionState,
} from "./session_state";

// The finished-run result: the metrics a user sees plus the fine-grained
// per-character and per-word timings the PRD requires captured. A pure
// projection of session state (frank_type's `toResult`, trimmed to the metrics
// slice — id/excerpt metadata, persistence and digraphs are separate issues).

export interface SessionResult {
  readonly durationSeconds: number;
  readonly elapsedMs: number;
  readonly metrics: Metrics;
  /** Per-character timings for the characters still present in the input. */
  readonly characterTimings: readonly CharTiming[];
  /** Per-word timing summaries derived from the character timings. */
  readonly wordTimings: readonly WordSummary[];
}

export function buildResult(state: SessionState, now: number): SessionResult {
  const ms = elapsedMs(state, now);
  const metrics = calculateMetrics({
    typedEvents: state.events,
    correctCharacters: correctCharacters(state),
    elapsedMs: ms,
    targetText: state.target,
  });

  return {
    durationSeconds: state.durationSeconds,
    elapsedMs: Math.round(ms),
    metrics,
    characterTimings: state.timings,
    wordTimings: summarizeWords({ text: state.target, characterTimings: state.timings }),
  };
}
