import type { Command } from "./command";
import { charsMatch, normalizeForCompare } from "./text_compare";
import { previousWordDeletionCount, toIndexDeletionCount } from "./deletion";

// Session engine — a functional (immutable) port of frank_type's
// TypingSessionState timing model. tuiper keeps the house immutable style
// (data in -> data out) rather than frank_type's mutable class, but the
// numbers are reproduced byte-for-byte (see test/engine/session_timing.test.ts,
// ported from frank_type's own session_state.test.mjs).
//
// The single seam is timestamp injection: every timing transition/selector
// takes an explicit `now`, so the module never reads a clock and stays pure.
// The OpenTUI shell stamps `performance.now()` on receipt and passes it in.
//
// Pause/resume is retained but dormant in v1 (blur-pause dropped); the state
// machine keeps it so a future release can wire a trigger. Typing and
// backspacing implicitly resume, exactly as frank_type does.

export type SessionStatus = "ready" | "active" | "finished";

/**
 * One entry in the session key log. `type` events carry the keystroke's
 * correctness; `backspace` events mark a deleted position. Ported from
 * frank_type's `keyEvents`; `elapsedMs` is run-relative (from the first key).
 */
export interface KeyStroke {
  readonly action: "type" | "backspace";
  readonly index: number;
  readonly expected?: string;
  readonly actual?: string;
  readonly correct?: boolean;
  readonly elapsedMs: number;
}

/**
 * Per-character timing, retained only for positions still present in `input`
 * (a backspace drops the timings it deletes). Feeds per-word timings and the
 * later digraph analysis. Ported from frank_type's `characterTimings`.
 */
export interface CharTiming {
  readonly index: number;
  readonly expected: string;
  readonly actual: string;
  readonly correct: boolean;
  readonly elapsedMs: number;
  readonly wordIndex: number;
}

export interface SessionState {
  /** The excerpt to type (already normalized for display). */
  readonly target: string;
  /** Characters entered so far, in order — advances even on a wrong key. */
  readonly input: string;
  /** Every keystroke, including corrected mistakes (drives `mistakes`). */
  readonly events: readonly KeyStroke[];
  /** Timings for the currently-present characters (backspace-trimmed). */
  readonly timings: readonly CharTiming[];
  /** Selected drill length: 15 / 30 / 60 seconds. */
  readonly durationSeconds: number;
  /** performance.now() of the first keystroke; null until the run starts. */
  readonly startedAt: number | null;
  /** performance.now() when the run auto-finished; null while running. */
  readonly finishedAt: number | null;
  /** Total time (ms) already spent paused and resumed. */
  readonly pausedMs: number;
  /** performance.now() the current pause began; null when not paused. */
  readonly pausedAt: number | null;
}

export const DEFAULT_DURATION_SECONDS = 30;

export function createSession(
  target: string,
  durationSeconds: number = DEFAULT_DURATION_SECONDS,
): SessionState {
  return {
    target,
    input: "",
    events: [],
    timings: [],
    durationSeconds,
    startedAt: null,
    finishedAt: null,
    pausedMs: 0,
    pausedAt: null,
  };
}

/**
 * Run-relative elapsed (ms) for an event stamped at `now`, matching frank_type:
 * `round(now - startedAt - pausedSoFar)`. Requires a started run.
 */
function eventElapsedMs(state: SessionState, now: number): number {
  return Math.round(now - state.startedAt! - pausedSoFar(state, now));
}

/** Zero-based index of the word containing `charIndex` (space-delimited). */
function wordIndexFor(text: string, charIndex: number): number {
  return text.slice(0, charIndex).split(" ").length - 1;
}

/** Count of typed positions matching their target char (NFC + case-insensitive). */
export function correctCharacters(state: SessionState): number {
  let count = 0;
  for (let i = 0; i < state.input.length; i++) {
    if (charsMatch(state.target[i]!, state.input[i]!)) count++;
  }
  return count;
}

// --- derived status ----------------------------------------------------------

export function sessionStatus(state: SessionState): SessionStatus {
  if (state.finishedAt !== null) return "finished";
  if (state.startedAt !== null) return "active";
  return "ready";
}

export function isPaused(state: SessionState): boolean {
  return state.pausedAt !== null;
}

// --- timing selectors (pure; `now` injected) ---------------------------------

/** Paused time accumulated so far, counting an in-flight pause up to `now`. */
export function pausedSoFar(state: SessionState, now: number): number {
  const ongoing = state.pausedAt !== null ? now - state.pausedAt : 0;
  return state.pausedMs + ongoing;
}

/** Elapsed run time in ms, excluding paused spans; frozen once finished. */
export function elapsedMs(state: SessionState, now: number): number {
  if (state.startedAt === null) return 0;
  const end = state.finishedAt !== null ? state.finishedAt : now;
  return Math.max(0, end - state.startedAt - pausedSoFar(state, end));
}

/** Whole seconds left on the countdown (frank_type: ceil, floored at 0). */
export function remainingSeconds(state: SessionState, now: number): number {
  return Math.max(
    0,
    Math.ceil(state.durationSeconds - elapsedMs(state, now) / 1000),
  );
}

export function shouldFinish(state: SessionState, now: number): boolean {
  return remainingSeconds(state, now) <= 0;
}

// --- timing transitions (pure; return the next state) ------------------------

export function start(state: SessionState, now: number): SessionState {
  if (state.startedAt !== null) return state;
  return { ...state, startedAt: now };
}

export function pause(state: SessionState, now: number): SessionState {
  if (state.startedAt === null || state.finishedAt !== null || state.pausedAt !== null) {
    return state;
  }
  return { ...state, pausedAt: now };
}

export function resume(state: SessionState, now: number): SessionState {
  if (state.pausedAt === null) return state;
  return {
    ...state,
    pausedMs: state.pausedMs + (now - state.pausedAt),
    pausedAt: null,
  };
}

export function finish(state: SessionState, now: number): SessionState {
  if (state.finishedAt !== null) return state;
  return { ...state, finishedAt: now };
}

/** Type one character: start-on-first-key, resume, then append (guarded). */
export function typeChar(state: SessionState, char: string, now: number): SessionState {
  const next = resume(start(state, now), now);
  // Blocked once finished or the excerpt is fully typed (the run is complete).
  if (next.finishedAt !== null || next.input.length >= next.target.length) {
    return next;
  }
  const index = next.input.length;
  const expected = next.target[index]!;
  const correct = charsMatch(expected, char);
  const elapsedMs = eventElapsedMs(next, now);
  const event: KeyStroke = {
    action: "type",
    index,
    expected: normalizeForCompare(expected),
    actual: normalizeForCompare(char),
    correct,
    elapsedMs,
  };
  const timing: CharTiming = {
    index,
    expected: normalizeForCompare(expected),
    actual: normalizeForCompare(char),
    correct,
    elapsedMs,
    wordIndex: wordIndexFor(next.target, index),
  };
  return {
    ...next,
    input: next.input + char,
    events: [...next.events, event],
    timings: [...next.timings, timing],
  };
}

/** Delete the last `count` characters (default 1). Resumes a paused clock. */
export function backspace(state: SessionState, now: number, count = 1): SessionState {
  if (
    state.startedAt === null ||
    state.finishedAt !== null ||
    state.input.length === 0 ||
    count <= 0
  ) {
    return state;
  }
  const next = resume(state, now);
  const deleted = Math.min(count, next.input.length);
  const firstDeletedIndex = next.input.length - deleted;
  const elapsedMs = eventElapsedMs(next, now);
  // One backspace event per removed position, descending index (frank_type order).
  const deletes: KeyStroke[] = [];
  for (let index = next.input.length - 1; index >= firstDeletedIndex; index--) {
    deletes.push({ action: "backspace", index, elapsedMs });
  }
  return {
    ...next,
    input: next.input.slice(0, firstDeletedIndex),
    events: [...next.events, ...deletes],
    timings: next.timings.filter((t) => t.index < firstDeletedIndex),
  };
}

/**
 * Apply a resolved command to the session, returning the next state. `now` is
 * the timestamp stamped when the key was received (defaults to 0 so pure unit
 * tests can omit it); the shell always passes `performance.now()`.
 */
export function applyCommand(
  state: SessionState,
  cmd: Command,
  now = 0,
): SessionState {
  switch (cmd.kind) {
    case "type":
      return typeChar(state, cmd.char, now);
    case "deleteChar":
      return backspace(state, now, 1);
    case "deleteWord":
      // Word boundaries come off the TARGET at the cursor (input.length),
      // matching frank_type's backspacePreviousWord.
      return backspace(
        state,
        now,
        previousWordDeletionCount(state.target, state.input.length),
      );
    case "deleteToLineStart":
      // The shell resolves `toIndex` from the terminal width; unset (pure unit
      // tests, or an unwrapped surface) means delete to the input start.
      return backspace(
        state,
        now,
        toIndexDeletionCount(state.input.length, cmd.toIndex ?? 0),
      );
    case "setDuration":
      // Duration is chosen before a run (ready only). Once typing starts it is
      // locked; once finished, the run's length is a fact and must not change.
      if (sessionStatus(state) !== "ready") return state;
      return { ...state, durationSeconds: cmd.seconds };
    // Excerpt selection replaces the whole session and needs the corpus + rng,
    // so it is the shell's job — a no-op at the engine level.
    case "nextExcerpt":
    case "cycleCategory":
    case "openProfile":
    case "quit":
    case "none":
      return state;
  }
}
