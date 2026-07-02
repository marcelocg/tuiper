import { describe, expect, test } from "bun:test";
import {
  applyCommand,
  createSession,
} from "../../src/engine/session_state";

describe("applyCommand", () => {
  test("type appends to input", () => {
    const s = applyCommand(createSession("abc"), { kind: "type", char: "a" });
    expect(s.input).toBe("a");
  });

  test("typing is blocked past the end of the excerpt", () => {
    let s = createSession("ab");
    s = applyCommand(s, { kind: "type", char: "a" });
    s = applyCommand(s, { kind: "type", char: "b" });
    s = applyCommand(s, { kind: "type", char: "c" });
    expect(s.input).toBe("ab");
  });

  test("wrong character still advances input (fixed layout, no reflow)", () => {
    const s = applyCommand(createSession("abc"), { kind: "type", char: "x" });
    expect(s.input).toBe("x");
  });

  test("deleteChar removes the last character", () => {
    let s = createSession("abc");
    s = applyCommand(s, { kind: "type", char: "a" });
    s = applyCommand(s, { kind: "type", char: "b" });
    s = applyCommand(s, { kind: "deleteChar" });
    expect(s.input).toBe("a");
  });

  test("deleteChar on empty input is a no-op", () => {
    const s = applyCommand(createSession("abc"), { kind: "deleteChar" });
    expect(s.input).toBe("");
  });

  test("quit and none leave state unchanged", () => {
    const base = applyCommand(createSession("abc"), { kind: "type", char: "a" });
    expect(applyCommand(base, { kind: "quit" })).toEqual(base);
    expect(applyCommand(base, { kind: "none" })).toEqual(base);
  });
});
