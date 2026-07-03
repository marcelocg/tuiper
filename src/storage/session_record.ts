// Pure mapper: a finished run + its excerpt → a persisted session record. This
// is the bridge from the engine's SessionResult to the storage schema (#4). It
// stays lean — attribution, timestamps, and the headline metrics that the
// profile trends and speed-band derivation read. Per-keystroke timings are
// live-only and are dropped from #4's daily summaries anyway.

import type { Excerpt } from "../corpus/excerpt_catalog";
import type { SessionResult } from "../engine/session_result";
import type { StoredSession } from "./session_store";

export interface SessionTimestamps {
  /** ISO-8601 wall-clock time the run started. */
  readonly startedAt: string;
  /** ISO-8601 wall-clock time the run finished (drives daily compaction). */
  readonly finishedAt: string;
}

export function buildStoredSession(
  result: SessionResult,
  excerpt: Excerpt,
  { startedAt, finishedAt }: SessionTimestamps,
): StoredSession {
  return {
    id: excerpt.id,
    title: excerpt.title,
    author: excerpt.author,
    source: excerpt.source,
    language: excerpt.language,
    category: excerpt.category,
    speedBand: excerpt.speed_band,
    startedAt,
    finishedAt,
    durationSeconds: result.durationSeconds,
    elapsedMs: result.elapsedMs,
    metrics: {
      wpm: result.metrics.wpm,
      rawWpm: result.metrics.rawWpm,
      accuracy: result.metrics.accuracy,
      mistakes: result.metrics.mistakes,
      typedCharacters: result.metrics.typedCharacters,
    },
  };
}
