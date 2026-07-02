import { describe, expect, test } from "bun:test";
import { buildResult } from "../../src/engine/session_result";
import { createSession, finish, typeChar } from "../../src/engine/session_state";

// End-to-end golden: a scripted keystroke-and-timestamp sequence in, exact
// metric numbers + captured timings out. This is the backbone assertion the
// PRD calls for — the finished result a user reviews.

describe("buildResult — finished run", () => {
  test("a clean 4/4 run over 30s yields the frank_type metrics", () => {
    // "test" typed correctly, run frozen at 30s elapsed (started at 1000).
    let s = typeChar(createSession("test", 30), "t", 1000);
    s = typeChar(s, "e", 1000);
    s = typeChar(s, "s", 1000);
    s = typeChar(s, "t", 1000);
    s = finish(s, 31000); // elapsedMs = 30000 → 0.5 min

    const r = buildResult(s, 99999); // finished → later `now` is ignored
    expect(r.elapsedMs).toBe(30000);
    expect(r.metrics.wpm).toBe(2); // round((4/5)/0.5) = round(1.6)
    expect(r.metrics.rawWpm).toBe(2);
    expect(r.metrics.accuracy).toBe(100);
    expect(r.metrics.mistakes).toBe(0);
    expect(r.metrics.completion).toBe(100);
  });

  test("a corrected mistake still counts against accuracy", () => {
    // type "s" wrong at index0 (expected "t"), fix it, finish the word.
    let s = typeChar(createSession("test", 30), "s", 1000); // wrong
    s = typeChar(s, "e", 1000); // now at index1, wrong-vs-target too? expected "e" -> correct
    s = finish(s, 31000);

    const r = buildResult(s, 31000);
    // 2 type events, 1 wrong → accuracy round((2-1)/2*100) = 50
    expect(r.metrics.typedCharacters).toBe(2);
    expect(r.metrics.mistakes).toBe(1);
    expect(r.metrics.accuracy).toBe(50);
  });

  test("captures per-character and per-word timings", () => {
    let s = typeChar(createSession("ab cd", 30), "a", 1000);
    s = typeChar(s, "b", 1080);
    s = typeChar(s, " ", 1160);
    s = typeChar(s, "c", 1300);
    s = typeChar(s, "d", 1380);
    s = finish(s, 31000);

    const r = buildResult(s, 31000);
    // per-character: one timing per typed position
    expect(r.characterTimings).toHaveLength(5);
    // per-word: two words, each with a press span across its chars
    expect(r.wordTimings).toHaveLength(2);
    expect(r.wordTimings[0]).toMatchObject({ word: "ab", wordIndex: 0, elapsedMs: 80, correct: true });
    expect(r.wordTimings[1]).toMatchObject({ word: "cd", wordIndex: 1, elapsedMs: 80, correct: true });
  });
});
