import { describe, expect, test } from "bun:test";
import { buildStoredSession } from "../../src/storage/session_record";
import type { Excerpt } from "../../src/corpus/excerpt_catalog";
import type { SessionResult } from "../../src/engine/session_result";

// The pure mapper the shell uses to turn a finished run + its excerpt into a
// persisted record. Kept lean (metadata + headline metrics + timestamps) — the
// heavy per-keystroke timings are only needed live, and #4's compaction drops
// them from summaries anyway.

const excerpt: Excerpt = {
  id: "asimov-youth-slow-1",
  title: "Youth",
  author: "Isaac Asimov",
  language: "en",
  category: "scifi",
  source: "Project Gutenberg ebook #31547",
  source_url: "https://www.gutenberg.org/ebooks/31547",
  original_text: "The Industrialist tried.",
  normalized_text: "the industrialist tried",
  speed_band: "slow",
  difficulty: "medium",
  word_count: 3,
  character_count: 23,
};

const result: SessionResult = {
  durationSeconds: 30,
  elapsedMs: 30000,
  metrics: {
    wpm: 82,
    rawWpm: 85,
    accuracy: 97,
    typedCharacters: 250,
    correctCharacters: 243,
    mistakes: 7,
    completion: 60,
  },
  characterTimings: [],
  wordTimings: [],
};

describe("buildStoredSession", () => {
  test("carries excerpt attribution, timestamps and headline metrics", () => {
    const record = buildStoredSession(result, excerpt, {
      startedAt: "2026-07-02T12:00:00.000Z",
      finishedAt: "2026-07-02T12:00:30.000Z",
    });

    expect(record).toMatchObject({
      id: "asimov-youth-slow-1",
      title: "Youth",
      author: "Isaac Asimov",
      source: "Project Gutenberg ebook #31547",
      startedAt: "2026-07-02T12:00:00.000Z",
      finishedAt: "2026-07-02T12:00:30.000Z",
      durationSeconds: 30,
      elapsedMs: 30000,
    });
    expect(record.metrics).toEqual({
      wpm: 82,
      rawWpm: 85,
      accuracy: 97,
      mistakes: 7,
      typedCharacters: 250,
    });
  });

  test("the record round-trips through the speed band derivation", async () => {
    const { preferredSpeedBand } = await import("../../src/engine/speed_band");
    const record = buildStoredSession(result, excerpt, {
      startedAt: "2026-07-02T12:00:00.000Z",
      finishedAt: "2026-07-02T12:00:30.000Z",
    });
    // wpm 82 → medium band, proving metrics.wpm survives for adaptivity.
    expect(preferredSpeedBand([record])).toBe("medium");
  });
});
