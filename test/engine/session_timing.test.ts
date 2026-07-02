import { describe, expect, test } from "bun:test";
import {
  DEFAULT_DURATION_SECONDS,
  applyCommand,
  backspace,
  createSession,
  elapsedMs,
  finish,
  pause,
  remainingSeconds,
  resume,
  sessionStatus,
  shouldFinish,
  start,
  typeChar,
} from "../../src/engine/session_state";

// These golden values are ported verbatim from frank_type's
// test/javascript/session_state.test.mjs. tuiper keeps a functional
// (immutable) session model but must reproduce the same timing numbers,
// since `now` is injected the shell can stamp performance.now() and the
// module stays pure (no clock reads).

describe("session lifecycle", () => {
  test("a fresh session is ready — timer not started", () => {
    const s = createSession("abc");
    expect(sessionStatus(s)).toBe("ready");
    expect(s.durationSeconds).toBe(DEFAULT_DURATION_SECONDS);
    expect(elapsedMs(s, 5000)).toBe(0);
  });

  test("the default duration is 30 seconds", () => {
    expect(DEFAULT_DURATION_SECONDS).toBe(30);
    expect(createSession("abc").durationSeconds).toBe(30);
  });

  test("the timer starts on the first typed character, not on creation", () => {
    let s = createSession("abc");
    expect(sessionStatus(s)).toBe("ready");
    s = typeChar(s, "a", 1000);
    expect(sessionStatus(s)).toBe("active");
    expect(s.startedAt).toBe(1000);
    // Elapsed is measured from the first keystroke.
    expect(elapsedMs(s, 3000)).toBe(2000);
  });

  test("remaining seconds counts down from the full duration", () => {
    const s = typeChar(createSession("abc", 15), "a", 1000);
    expect(remainingSeconds(s, 1000)).toBe(15);
    expect(remainingSeconds(s, 6000)).toBe(10);
  });
});

describe("elapsed excludes paused (dormant) time", () => {
  // frank_type: "excludes paused time from elapsed metrics"
  test("elapsed freezes while paused and resumes on next input", () => {
    let s = typeChar(createSession("abc"), "a", 1000);
    s = pause(s, 4000);
    expect(sessionStatus(s)).toBe("active");
    expect(s.pausedAt).not.toBeNull();
    expect(elapsedMs(s, 9000)).toBe(3000); // frozen at 4000-1000

    s = typeChar(s, "b", 9000); // typing resumes the clock
    expect(s.pausedAt).toBeNull();
    expect(elapsedMs(s, 9000)).toBe(3000);
    expect(elapsedMs(s, 10000)).toBe(4000);
  });

  // frank_type: "resumes when backspacing after a pause"
  test("backspacing after a pause resumes the clock", () => {
    let s = typeChar(createSession("ab"), "a", 1000);
    s = typeChar(s, "b", 1500);
    s = pause(s, 2000);
    s = backspace(s, 7000);
    expect(s.pausedAt).toBeNull();
    expect(s.input).toBe("a");
    // now(7000) - started(1000) - paused(5000) = 1000
    expect(elapsedMs(s, 7000)).toBe(1000);
  });

  // frank_type: "freezes remaining seconds while paused"
  test("remaining seconds freeze while paused", () => {
    let s = typeChar(createSession("abc", 10), "a", 1000);
    s = pause(s, 4000);
    expect(remainingSeconds(s, 24000)).toBe(7);
    s = resume(s, 24000);
    expect(remainingSeconds(s, 24000)).toBe(7);
  });
});

describe("auto-finish", () => {
  test("shouldFinish is true once remaining seconds reach zero", () => {
    const s = typeChar(createSession("abc", 15), "a", 1000);
    expect(shouldFinish(s, 15000)).toBe(false);
    expect(shouldFinish(s, 16000)).toBe(true); // 15s elapsed
  });

  test("finishing freezes elapsed at the finish timestamp", () => {
    let s = typeChar(createSession("abc", 15), "a", 1000);
    s = finish(s, 16000);
    expect(sessionStatus(s)).toBe("finished");
    expect(elapsedMs(s, 99999)).toBe(15000); // frozen, ignores later now
  });

  test("finish is idempotent", () => {
    let s = typeChar(createSession("abc", 15), "a", 1000);
    s = finish(s, 16000);
    expect(finish(s, 20000)).toBe(s);
  });
});

describe("applyCommand routes to timing transitions", () => {
  test("type command starts the timer at the stamped now", () => {
    const s = applyCommand(createSession("abc"), { kind: "type", char: "a" }, 2000);
    expect(s.startedAt).toBe(2000);
    expect(s.input).toBe("a");
  });

  test("setDuration changes the duration while ready", () => {
    const s = applyCommand(createSession("abc"), { kind: "setDuration", seconds: 60 }, 0);
    expect(s.durationSeconds).toBe(60);
    expect(sessionStatus(s)).toBe("ready");
  });

  test("setDuration is ignored mid-run (cannot change duration while active)", () => {
    let s = applyCommand(createSession("abc"), { kind: "type", char: "a" }, 1000);
    s = applyCommand(s, { kind: "setDuration", seconds: 60 }, 2000);
    expect(s.durationSeconds).toBe(DEFAULT_DURATION_SECONDS);
  });

  test("setDuration is ignored once finished (the run length is settled)", () => {
    let s = applyCommand(createSession("abc", 15), { kind: "type", char: "a" }, 1000);
    s = finish(s, 16000);
    s = applyCommand(s, { kind: "setDuration", seconds: 60 }, 17000);
    expect(s.durationSeconds).toBe(15);
  });

  test("deleteChar routes through backspace and resumes the clock", () => {
    let s = applyCommand(createSession("ab"), { kind: "type", char: "a" }, 1000);
    s = applyCommand(s, { kind: "type", char: "b" }, 1500);
    s = pause(s, 2000);
    s = applyCommand(s, { kind: "deleteChar" }, 7000);
    expect(s.input).toBe("a");
    expect(s.pausedAt).toBeNull();
  });
});
