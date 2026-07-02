import type { Command } from "./command";

// Walking-skeleton session state: the excerpt, the characters typed so far,
// and a status. The full frank_type state machine (ready/active/finished,
// timer, pause/resume) arrives in later slices; the skeleton boots straight
// into an active run so the end-to-end pipe can be exercised.
export type SessionStatus = "active";

export interface SessionState {
  /** The excerpt to type (already normalized for display). */
  readonly target: string;
  /** Characters entered so far, in order — advances even on a wrong key. */
  readonly input: string;
  readonly status: SessionStatus;
}

export function createSession(target: string): SessionState {
  return { target, input: "", status: "active" };
}

/** Apply a resolved command to the session, returning the next state. */
export function applyCommand(state: SessionState, cmd: Command): SessionState {
  switch (cmd.kind) {
    case "type":
      // Block typing past the end of the excerpt (the run is complete there).
      if (state.input.length >= state.target.length) return state;
      return { ...state, input: state.input + cmd.char };
    case "deleteChar":
      if (state.input.length === 0) return state;
      return { ...state, input: state.input.slice(0, -1) };
    case "quit":
    case "none":
      return state;
  }
}
