import { describe, expect, test } from "bun:test";
import { mapKeyToCommand } from "../../src/engine/input_intent";
import { createSession } from "../../src/engine/session_state";
import { key } from "../support/key_event";

const active = createSession("hello world");

describe("mapKeyToCommand — active run", () => {
  test("printable letter types itself", () => {
    expect(mapKeyToCommand(key({ name: "h", sequence: "h" }), active)).toEqual({
      kind: "type",
      char: "h",
    });
  });

  test("shifted letter types the uppercase glyph", () => {
    expect(
      mapKeyToCommand(key({ name: "a", sequence: "A", shift: true }), active),
    ).toEqual({ kind: "type", char: "A" });
  });

  test("space types a space", () => {
    expect(mapKeyToCommand(key({ name: "space", sequence: " " }), active)).toEqual({
      kind: "type",
      char: " ",
    });
  });

  test("digit and punctuation type themselves (not treated as hotkeys mid-run)", () => {
    expect(mapKeyToCommand(key({ name: "1", sequence: "1" }), active)).toEqual({
      kind: "type",
      char: "1",
    });
    expect(mapKeyToCommand(key({ name: "?", sequence: "?" }), active)).toEqual({
      kind: "type",
      char: "?",
    });
  });

  test("q is typed input during an active run", () => {
    expect(mapKeyToCommand(key({ name: "q", sequence: "q" }), active)).toEqual({
      kind: "type",
      char: "q",
    });
  });

  test("plain Backspace deletes a character", () => {
    expect(
      mapKeyToCommand(key({ name: "backspace", sequence: "\x7f" }), active),
    ).toEqual({ kind: "deleteChar" });
  });

  test("Ctrl-C quits", () => {
    expect(
      mapKeyToCommand(key({ name: "c", sequence: "\x03", ctrl: true }), active),
    ).toEqual({ kind: "quit" });
  });

  test("Ctrl-<letter> is not typed input", () => {
    expect(
      mapKeyToCommand(key({ name: "a", sequence: "\x01", ctrl: true }), active),
    ).toEqual({ kind: "none" });
  });

  test("Alt/Ctrl-Backspace is not a plain char delete (reserved for delete-word)", () => {
    expect(
      mapKeyToCommand(
        key({ name: "backspace", sequence: "\x7f", ctrl: true }),
        active,
      ),
    ).toEqual({ kind: "none" });
  });

  test("control keys like Tab / Enter produce no command in the skeleton", () => {
    expect(mapKeyToCommand(key({ name: "tab", sequence: "\t" }), active)).toEqual({
      kind: "none",
    });
    expect(
      mapKeyToCommand(key({ name: "return", sequence: "\r" }), active),
    ).toEqual({ kind: "none" });
  });

  test("Kitty key-release events are ignored", () => {
    expect(
      mapKeyToCommand(
        key({ name: "h", sequence: "h", eventType: "release" }),
        active,
      ),
    ).toEqual({ kind: "none" });
  });
});
