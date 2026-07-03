import { describe, expect, test } from "bun:test";
import {
  preferredSpeedBand,
  randomExcerptIndex,
  type BandExcerpt,
} from "../../src/engine/speed_band";

// Golden-value port of frank_type's speed_band.test.mjs, plus explicit
// fallback / rng-injected cases. preferredSpeedBand + randomExcerptIndex are a
// 1:1 port; selection uses an injectable rng (Math.random by default).

describe("preferredSpeedBand", () => {
  test("defaults new users to slow", () => {
    expect(preferredSpeedBand([])).toBe("slow");
  });

  test("uses recent average WPM", () => {
    expect(preferredSpeedBand([{ metrics: { wpm: 55 } }, { metrics: { wpm: 62 } }])).toBe("slow");
    expect(preferredSpeedBand([{ metrics: { wpm: 91 } }, { metrics: { wpm: 83 } }])).toBe("medium");
    expect(preferredSpeedBand([{ metrics: { wpm: 125 } }, { metrics: { wpm: 132 } }])).toBe(
      "medium",
    );
    expect(preferredSpeedBand([{ metrics: { wpm: 145 } }, { metrics: { wpm: 152 } }])).toBe("fast");
  });

  test("boundaries: 75 → medium, 140 → fast", () => {
    expect(preferredSpeedBand([{ metrics: { wpm: 75 } }])).toBe("medium");
    expect(preferredSpeedBand([{ metrics: { wpm: 74 } }])).toBe("slow");
    expect(preferredSpeedBand([{ metrics: { wpm: 140 } }])).toBe("fast");
    expect(preferredSpeedBand([{ metrics: { wpm: 139 } }])).toBe("medium");
  });

  test("averages only the most recent 5, ignoring non-positive/NaN", () => {
    const sessions = [
      { metrics: { wpm: 200 } },
      { metrics: { wpm: 200 } },
      { metrics: { wpm: 200 } },
      { metrics: { wpm: 200 } },
      { metrics: { wpm: 200 } },
      { metrics: { wpm: 10 } }, // 6th — excluded
    ];
    expect(preferredSpeedBand(sessions)).toBe("fast");
    // A lone zero/NaN entry is filtered → falls back to slow.
    expect(preferredSpeedBand([{ metrics: { wpm: 0 } }])).toBe("slow");
  });
});

describe("randomExcerptIndex", () => {
  const excerpts: BandExcerpt[] = [
    { category: "scifi", speed_band: "slow" },
    { category: "scifi", speed_band: "medium" },
    { category: "scifi", speed_band: "fast" },
    { category: "fantasy", speed_band: "fast" },
  ];

  test("prefers the matching speed band", () => {
    for (let i = 0; i < 20; i++) {
      expect([2, 3]).toContain(randomExcerptIndex(excerpts, { speedBand: "fast" }));
    }
  });

  test("respects category when selected", () => {
    const pool: BandExcerpt[] = [
      { category: "scifi", speed_band: "fast" },
      { category: "fantasy", speed_band: "fast" },
      { category: "fantasy", speed_band: "fast" },
    ];
    for (let i = 0; i < 20; i++) {
      expect([1, 2]).toContain(
        randomExcerptIndex(pool, { category: "fantasy", speedBand: "fast" }),
      );
    }
  });

  test("avoids the current excerpt when possible", () => {
    const pool: BandExcerpt[] = [
      { category: "scifi", speed_band: "slow" },
      { category: "scifi", speed_band: "slow" },
    ];
    for (let i = 0; i < 20; i++) {
      expect(randomExcerptIndex(pool, { speedBand: "slow", except: 0 })).toBe(1);
    }
  });

  test("falls back to any excerpt (except current) when no band/category match", () => {
    // No 'fast' excerpt exists → fallback pool is every index but `except`.
    for (let i = 0; i < 20; i++) {
      const idx = randomExcerptIndex(excerpts, { speedBand: "fast", category: "biography", except: 0 });
      expect(idx).not.toBe(0);
      expect([1, 2, 3]).toContain(idx);
    }
  });

  test("returns 0 for a single-excerpt corpus", () => {
    expect(randomExcerptIndex([{ category: "scifi", speed_band: "slow" }], { speedBand: "fast" })).toBe(0);
  });

  test("rng is injectable for deterministic selection", () => {
    // rng → 0 picks the first candidate; rng → 0.99 the last.
    expect(randomExcerptIndex(excerpts, { speedBand: "slow" }, () => 0)).toBe(0);
    const fantasy: BandExcerpt[] = [
      { category: "fantasy", speed_band: "fast" },
      { category: "fantasy", speed_band: "fast" },
      { category: "fantasy", speed_band: "fast" },
    ];
    expect(randomExcerptIndex(fantasy, { speedBand: "fast" }, () => 0.99)).toBe(2);
  });
});
