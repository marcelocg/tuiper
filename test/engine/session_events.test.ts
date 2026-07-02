import { describe, expect, test } from "bun:test";
import {
  backspace,
  correctCharacters,
  createSession,
  typeChar,
} from "../../src/engine/session_state";

// The session engine records a per-keystroke event log and character timings,
// mirroring frank_type's TypingSessionState. These feed the metrics module
// (mistakes count every wrong key, even corrected ones) and the per-word /
// per-character timing summaries in the finished result.

describe("keyEvents log", () => {
  test("typing appends a type event with correctness and run-relative elapsed", () => {
    let s = typeChar(createSession("test"), "t", 1000); // starts the run at 1000
    s = typeChar(s, "e", 1600);
    expect(s.events).toHaveLength(2);
    expect(s.events[0]).toEqual({
      action: "type",
      index: 0,
      expected: "t",
      actual: "t",
      correct: true,
      elapsedMs: 0, // measured from the first keystroke
    });
    expect(s.events[1]!.elapsedMs).toBe(600);
  });

  test("a wrong key is logged with correct=false (a mistake), input still advances", () => {
    let s = typeChar(createSession("test"), "t", 1000);
    s = typeChar(s, "x", 1100); // expected "e"
    expect(s.input).toBe("tx");
    expect(s.events[1]!.correct).toBe(false);
  });

  test("mistakes persist in the log even after the char is corrected", () => {
    // t, e, x(wrong), backspace, s, t → 5 type events (1 wrong) + 1 backspace
    let s = typeChar(createSession("test"), "t", 1000);
    s = typeChar(s, "e", 1100);
    s = typeChar(s, "x", 1200); // wrong (expected "s")
    s = backspace(s, 1300);
    s = typeChar(s, "s", 1400);
    s = typeChar(s, "t", 1500);

    const typeEvents = s.events.filter((e) => e.action === "type");
    const wrong = typeEvents.filter((e) => e.correct === false);
    expect(typeEvents).toHaveLength(5);
    expect(wrong).toHaveLength(1); // the corrected mistake is still counted
    expect(s.input).toBe("test");
    expect(correctCharacters(s)).toBe(4);
  });
});

describe("characterTimings", () => {
  test("each typed char records index, expected, correct, elapsed and wordIndex", () => {
    let s = typeChar(createSession("ab cd"), "a", 1000);
    s = typeChar(s, "b", 1080);
    s = typeChar(s, " ", 1160);
    s = typeChar(s, "c", 1300);
    expect(s.timings).toHaveLength(4);
    expect(s.timings[0]).toEqual({
      index: 0,
      expected: "a",
      actual: "a",
      correct: true,
      elapsedMs: 0,
      wordIndex: 0,
    });
    expect(s.timings[3]!.wordIndex).toBe(1); // "c" is in the second word
    expect(s.timings[3]!.elapsedMs).toBe(300);
  });

  test("backspace drops timings for the deleted positions and logs the deletes", () => {
    let s = typeChar(createSession("abc"), "a", 1000);
    s = typeChar(s, "b", 1100);
    s = typeChar(s, "c", 1200);
    s = backspace(s, 1300, 2); // delete "c" and "b"
    expect(s.input).toBe("a");
    // only the surviving position keeps a timing
    expect(s.timings.map((t) => t.index)).toEqual([0]);
    // two backspace events, one per deleted position (descending index)
    const bs = s.events.filter((e) => e.action === "backspace");
    expect(bs.map((e) => e.index)).toEqual([2, 1]);
    expect(bs.every((e) => e.elapsedMs === 300)).toBe(true);
  });
});

describe("correctCharacters selector", () => {
  test("counts positions whose typed char matches the target (case-insensitive)", () => {
    let s = typeChar(createSession("Cat"), "c", 1000); // C vs c → match
    s = typeChar(s, "a", 1100);
    s = typeChar(s, "x", 1200); // t expected → miss
    expect(correctCharacters(s)).toBe(2);
  });
});
