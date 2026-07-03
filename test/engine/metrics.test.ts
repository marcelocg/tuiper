import { describe, expect, test } from "bun:test";
import {
  calculateMetrics,
  displayPair,
  summarizeDigraphs,
  summarizeWords,
} from "../../src/engine/metrics";

// Golden values ported verbatim from frank_type's
// test/javascript/typing_metrics.test.mjs, plus hand-derived cases pinning
// each formula. Metrics must reproduce frank_type byte-for-byte.

describe("calculateMetrics", () => {
  // frank_type: "calculateMetrics returns wpm accuracy and mistakes"
  test("wpm, rawWpm, accuracy, mistakes (frank_type golden)", () => {
    const metrics = calculateMetrics({
      typedEvents: [
        { action: "type", correct: true },
        { action: "type", correct: false },
        { action: "type", correct: true },
        { action: "backspace" },
        { action: "type", correct: true },
      ],
      correctCharacters: 3,
      elapsedMs: 30000,
      targetText: "test",
    });

    // 4 type events, 3 correct chars over 0.5 min:
    //   wpm    = round((3/5)/0.5) = round(1.2) = 1
    //   rawWpm = round((4/5)/0.5) = round(1.6) = 2
    //   accuracy = round((4-1)/4*100) = 75
    expect(metrics.wpm).toBe(1);
    expect(metrics.rawWpm).toBe(2);
    expect(metrics.accuracy).toBe(75);
    expect(metrics.mistakes).toBe(1);
    expect(metrics.typedCharacters).toBe(4);
    expect(metrics.correctCharacters).toBe(3);
    // completion = round(3 / "test".length(4) * 100) = 75
    expect(metrics.completion).toBe(75);
  });

  test("no typed characters → 100% accuracy, zeroed rates", () => {
    const m = calculateMetrics({ typedEvents: [], correctCharacters: 0, elapsedMs: 30000, targetText: "abc" });
    expect(m.accuracy).toBe(100); // guarded divide-by-zero
    expect(m.wpm).toBe(0);
    expect(m.rawWpm).toBe(0);
    expect(m.mistakes).toBe(0);
    expect(m.completion).toBe(0);
  });

  test("empty target → completion 0 (guarded divide-by-zero)", () => {
    const m = calculateMetrics({
      typedEvents: [{ action: "type", correct: true }],
      correctCharacters: 1,
      elapsedMs: 60000,
      targetText: "",
    });
    expect(m.completion).toBe(0);
  });

  test("minutes floored at 1/60000 so instantaneous runs don't divide by zero", () => {
    // elapsedMs = 0 → minutes = 1/60000; rawWpm = round((1/5)/(1/60000))
    const m = calculateMetrics({
      typedEvents: [{ action: "type", correct: true }],
      correctCharacters: 1,
      elapsedMs: 0,
      targetText: "a",
    });
    expect(m.rawWpm).toBe(Math.round((1 / 5) / (1 / 60000)));
    expect(Number.isFinite(m.rawWpm)).toBe(true);
  });

  test("accuracy never goes below 0", () => {
    // more mistakes than clean chars can't happen naturally, but the clamp holds
    const m = calculateMetrics({
      typedEvents: [
        { action: "type", correct: false },
        { action: "type", correct: false },
      ],
      correctCharacters: 0,
      elapsedMs: 60000,
      targetText: "ab",
    });
    expect(m.accuracy).toBe(0);
  });
});

describe("summarizeWords", () => {
  // frank_type: "summarizeWords groups character timings by word"
  test("groups character timings by word (frank_type golden)", () => {
    const words = summarizeWords({
      text: "one two",
      characterTimings: [
        { index: 0, correct: true, elapsedMs: 0 },
        { index: 1, correct: true, elapsedMs: 60 },
        { index: 2, correct: true, elapsedMs: 120 },
        { index: 4, correct: true, elapsedMs: 260 },
        { index: 5, correct: false, elapsedMs: 320 },
      ],
    });

    expect(words[0]).toEqual({
      word: "one",
      wordIndex: 0,
      startIndex: 0,
      endIndex: 2,
      elapsedMs: 120,
      correct: true,
    });

    expect(words[1]!.word).toBe("two");
    // second word only has 2 of 3 timings and one is wrong → not correct
    expect(words[1]!.correct).toBe(false);
  });

  test("a word with no timings reports null elapsed and incomplete", () => {
    const words = summarizeWords({
      text: "hi bye",
      characterTimings: [
        { index: 0, correct: true, elapsedMs: 0 },
        { index: 1, correct: true, elapsedMs: 90 },
      ],
    });
    expect(words[0]!.elapsedMs).toBe(90);
    expect(words[1]!.elapsedMs).toBeNull(); // "bye" untyped
    expect(words[1]!.correct).toBe(false);
  });
});

describe("summarizeDigraphs", () => {
  // Helper mirrored from frank_type's typing_metrics.test.mjs.
  function timingsFromLatencies(latencies: number[]) {
    let elapsedMs = 0;
    const characters = "abcdefghijklmnopqrstuvwxyz";
    const timings = [{ index: 0, expected: characters[0]!, correct: true, elapsedMs }];
    latencies.forEach((latencyMs, index) => {
      elapsedMs += latencyMs;
      timings.push({
        index: index + 1,
        expected: characters[(index + 1) % characters.length]!,
        correct: true,
        elapsedMs,
      });
    });
    return timings;
  }

  test("displayPair replaces spaces with the visible glyph", () => {
    expect(displayPair("e ")).toBe("e␠");
    expect(displayPair("th")).toBe("th");
  });

  // frank_type: "summarizeDigraphs ranks correct adjacent character pairs"
  test("ranks correct adjacent character pairs (frank_type golden)", () => {
    const summary = summarizeDigraphs({
      characterTimings: [
        { index: 0, expected: "t", correct: true, elapsedMs: 0 },
        { index: 1, expected: "h", correct: true, elapsedMs: 180 },
        { index: 2, expected: "e", correct: true, elapsedMs: 240 },
        { index: 3, expected: " ", correct: true, elapsedMs: 520 },
        { index: 4, expected: "m", correct: true, elapsedMs: 610 },
      ],
      keyEvents: [],
    });

    expect(summary.samples.length).toBe(4);
    expect(summary.rankedPairs[0]!.displayPair).toBe("e␠");
    expect(summary.rankedPairs[0]!.medianLatencyMs).toBe(280);
    expect(summary.samples.some((sample) => sample.heat > 0)).toBe(true);
  });

  // frank_type: "summarizeDigraphs filters mistakes corrections and long pauses"
  test("filters mistakes, corrections and long pauses (frank_type golden)", () => {
    const summary = summarizeDigraphs({
      characterTimings: [
        { index: 0, expected: "a", correct: true, elapsedMs: 0 },
        { index: 1, expected: "b", correct: false, elapsedMs: 100 },
        { index: 2, expected: "c", correct: true, elapsedMs: 260 },
        { index: 3, expected: "d", correct: true, elapsedMs: 1900 },
        { index: 4, expected: "e", correct: true, elapsedMs: 2020 },
        { index: 5, expected: "f", correct: true, elapsedMs: 2300 },
      ],
      keyEvents: [{ action: "backspace", elapsedMs: 2100 }],
    });

    // b wrong (a→b, b→c dropped), c→d = 1640ms > 1200 (dropped), d→e kept,
    // e→f spans the backspace at 2100 (dropped).
    expect(summary.samples.map((sample) => sample.pair)).toEqual(["de"]);
  });

  // frank_type: "summarizeDigraphs only heats the most actionable slow pairs"
  test("only heats the most actionable slow pairs (frank_type golden)", () => {
    const latencies = [40, 45, 50, 55, 60, 65, 70, 75, 160, 180, 200, 220, 240, 260, 280];
    const summary = summarizeDigraphs({
      characterTimings: timingsFromLatencies(latencies),
      keyEvents: [],
    });
    const heated = summary.samples.filter((sample) => sample.heat > 0);

    expect(heated.length).toBe(3);
    expect(heated.map((sample) => sample.latencyMs)).toEqual([240, 260, 280]);
    // a pair slower than baseline can still be left cold (not among the actionable)
    expect(
      summary.samples.some(
        (sample) => sample.latencyMs > summary.medianLatencyMs && sample.heat === 0,
      ),
    ).toBe(true);
  });

  // frank_type: "summarizeDigraphs caps heat to a small fraction of long sessions"
  test("caps heat to a small fraction of long sessions (frank_type golden)", () => {
    const latencies = Array.from({ length: 80 }, (_value, index) => 50 + index * 6);
    const summary = summarizeDigraphs({
      characterTimings: timingsFromLatencies(latencies),
      keyEvents: [],
    });
    const heated = summary.samples.filter((sample) => sample.heat > 0);

    expect(heated.length).toBeLessThanOrEqual(6);
    expect(heated.length).toBeLessThan(summary.samples.length / 2);
  });

  test("empty input → empty summary, zero baseline", () => {
    const summary = summarizeDigraphs({ characterTimings: [], keyEvents: [] });
    expect(summary.samples).toEqual([]);
    expect(summary.rankedPairs).toEqual([]);
    expect(summary.medianLatencyMs).toBe(0);
  });
});
