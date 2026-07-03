import { describe, expect, test } from "bun:test";
import { buildProfile } from "../../src/engine/profile";
import type { StoredSession } from "../../src/storage/session_store";

// buildProfile turns stored history (full runs + daily summaries, newest-first
// as the store returns them) into chronological trend series plus best/average/
// recent headline stats. Pure: sessions in → profile view-model out.

function session(over: Partial<StoredSession> & { finishedAt: string }): StoredSession {
  return {
    id: "x",
    metrics: { wpm: 0, accuracy: 100 },
    ...over,
  };
}

describe("buildProfile", () => {
  test("empty history → zeroed stats and empty series", () => {
    const profile = buildProfile([]);
    expect(profile.sessionCount).toBe(0);
    expect(profile.wpmSeries).toEqual([]);
    expect(profile.accuracySeries).toEqual([]);
    expect(profile.wpm).toEqual({ best: 0, average: 0, recent: 0 });
    expect(profile.accuracy).toEqual({ best: 0, average: 0, recent: 0 });
  });

  test("orders series chronologically (oldest → newest) regardless of input order", () => {
    // Store hands back newest-first; the chart reads left(old)→right(new).
    const profile = buildProfile([
      session({ finishedAt: "2026-07-03T00:00:00Z", metrics: { wpm: 90, accuracy: 97 } }),
      session({ finishedAt: "2026-07-01T00:00:00Z", metrics: { wpm: 50, accuracy: 91 } }),
      session({ finishedAt: "2026-07-02T00:00:00Z", metrics: { wpm: 70, accuracy: 95 } }),
    ]);
    expect(profile.wpmSeries).toEqual([50, 70, 90]);
    expect(profile.accuracySeries).toEqual([91, 95, 97]);
  });

  test("headline stats: best is the max, average the rounded mean, recent the newest", () => {
    const profile = buildProfile([
      session({ finishedAt: "2026-07-03T00:00:00Z", metrics: { wpm: 80, accuracy: 90 } }),
      session({ finishedAt: "2026-07-01T00:00:00Z", metrics: { wpm: 40, accuracy: 100 } }),
      session({ finishedAt: "2026-07-02T00:00:00Z", metrics: { wpm: 61, accuracy: 95 } }),
    ]);
    expect(profile.sessionCount).toBe(3);
    // wpm: max 80, mean (40+61+80)/3 = 60.33 → 60, recent (newest) 80
    expect(profile.wpm).toEqual({ best: 80, average: 60, recent: 80 });
    // accuracy: max 100, mean (100+95+90)/3 = 95, recent 90
    expect(profile.accuracy).toEqual({ best: 100, average: 95, recent: 90 });
  });

  test("includes daily summaries and skips records with non-finite metrics", () => {
    const profile = buildProfile([
      session({ finishedAt: "2026-07-02T00:00:00Z", summary: true, metrics: { wpm: 55, accuracy: 93 } }),
      session({ finishedAt: "2026-07-01T00:00:00Z", metrics: { wpm: undefined, accuracy: 88 } }),
    ]);
    // The summary contributes; the run with a missing wpm is dropped from wpm.
    expect(profile.wpmSeries).toEqual([55]);
    expect(profile.accuracySeries).toEqual([88, 93]);
  });
});
