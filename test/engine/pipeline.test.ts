import { describe, expect, test } from "bun:test";
import { mapKeyToCommand } from "../../src/engine/input_intent";
import {
  applyCommand,
  createSession,
  type SessionState,
} from "../../src/engine/session_state";
import { computeCells } from "../../src/engine/typing_view";
import type { KeyEvent } from "../../src/engine/key_event";
import { key } from "../support/key_event";

// End-to-end below the seam: keystroke -> command -> state -> rendered cells,
// exactly the path the OpenTUI shell drives (minus the terminal).
const press = (sequence: string) => key({ sequence });

function feed(state: SessionState, keys: KeyEvent[]): SessionState {
  return keys.reduce((s, k) => applyCommand(s, mapKeyToCommand(k, s)), state);
}

describe("keystroke -> engine pipeline", () => {
  test("typing the excerpt correctly marks every char correct", () => {
    const state = feed(createSession("cat"), [press("c"), press("a"), press("t")]);
    expect(state.input).toBe("cat");
    expect(computeCells(state).map((c) => c.status)).toEqual([
      "correct",
      "correct",
      "correct",
      "pending", // trailing cursor cell
    ]);
  });

  test("a wrong key colors the expected char red and Backspace fixes it", () => {
    let state = feed(createSession("cat"), [press("c"), press("x")]);
    expect(computeCells(state)[1]!.status).toBe("wrong");

    state = feed(state, [key({ name: "backspace", sequence: "\x7f" }), press("a")]);
    expect(state.input).toBe("ca");
    expect(computeCells(state)[1]!.status).toBe("correct");
  });
});
