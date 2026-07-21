import { describe, expect, test } from "bun:test";
import { mapKeyToCommand as mapKey } from "../../src/engine/input_intent";
import {
  applyCommand,
  createSession,
  type SessionState,
} from "../../src/engine/session_state";
import { computeCells } from "../../src/engine/typing_view";
import type { KeyEvent } from "../../src/engine/key_event";
import type { Command } from "../../src/engine/command";
import { key } from "../support/key_event";
// Session-only wrapper: these cases predate the overlay branch of the seam, so
// they always map with no overlay up. Overlay keys are covered in
// input_intent_overlay.test.ts.
const mapKeyToCommand = (key: KeyEvent, state: SessionState): Command =>
  mapKey(key, { state, overlay: null, pageSize: 19 });

// End-to-end below the seam: keystroke -> command -> state -> rendered cells,
// exactly the path the OpenTUI shell drives (minus the terminal).
const press = (sequence: string) => key({ sequence });

function feed(state: SessionState, keys: KeyEvent[]): SessionState {
  return keys.reduce((s, k) => applyCommand(s, mapKeyToCommand(k, s)), state);
}

describe("keystroke -> engine pipeline", () => {
  // Sample text avoids the ready-state hotkeys (1/2/3 duration, c category):
  // in Ready those are commands, not typed input, so a run can't begin with one.
  test("typing the excerpt correctly marks every char correct", () => {
    const state = feed(createSession("dog"), [press("d"), press("o"), press("g")]);
    expect(state.input).toBe("dog");
    expect(computeCells(state).map((c) => c.status)).toEqual([
      "correct",
      "correct",
      "correct",
      "pending", // trailing cursor cell
    ]);
  });

  test("a wrong key colors the expected char red and Backspace fixes it", () => {
    let state = feed(createSession("dog"), [press("d"), press("x")]);
    expect(computeCells(state)[1]!.status).toBe("wrong");

    state = feed(state, [key({ name: "backspace", sequence: "\x7f" }), press("o")]);
    expect(state.input).toBe("do");
    expect(computeCells(state)[1]!.status).toBe("correct");
  });
});
