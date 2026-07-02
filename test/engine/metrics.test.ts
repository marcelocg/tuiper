import { describe, expect, test } from "bun:test";
import { calculateMetrics, summarizeWords } from "../../src/engine/metrics";

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
