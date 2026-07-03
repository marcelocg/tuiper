import { describe, expect, test } from "bun:test";
import { mapKeyToCommand } from "../../src/engine/input_intent";
import { createSession, finish, start } from "../../src/engine/session_state";
import { key } from "../support/key_event";

const ready = createSession("hello world");
const active = start(ready, 1000); // timer started -> mid-run
const finished = finish(active, 2000);

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

  test("Enter produces no command mid-run; Tab loads the next excerpt", () => {
    // Tab is a live control key even mid-run (excerpt selection, see #5).
    expect(mapKeyToCommand(key({ name: "tab", sequence: "\t" }), active)).toEqual({
      kind: "nextExcerpt",
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

describe("mapKeyToCommand — ready (before first keystroke)", () => {
  test("1 / 2 / 3 select the 15 / 30 / 60-second duration", () => {
    expect(mapKeyToCommand(key({ name: "1", sequence: "1" }), ready)).toEqual({
      kind: "setDuration",
      seconds: 15,
    });
    expect(mapKeyToCommand(key({ name: "2", sequence: "2" }), ready)).toEqual({
      kind: "setDuration",
      seconds: 30,
    });
    expect(mapKeyToCommand(key({ name: "3", sequence: "3" }), ready)).toEqual({
      kind: "setDuration",
      seconds: 60,
    });
  });

  test("any other printable is the first keystroke — it types (and starts the run)", () => {
    expect(mapKeyToCommand(key({ name: "h", sequence: "h" }), ready)).toEqual({
      kind: "type",
      char: "h",
    });
  });

  test("Backspace before typing does nothing", () => {
    expect(
      mapKeyToCommand(key({ name: "backspace", sequence: "\x7f" }), ready),
    ).toEqual({ kind: "none" });
  });

  test("Ctrl-C quits from the ready state", () => {
    expect(
      mapKeyToCommand(key({ name: "c", sequence: "\x03", ctrl: true }), ready),
    ).toEqual({ kind: "quit" });
  });
});

describe("mapKeyToCommand — finished", () => {
  test("duration keys go dormant once the run is over (no restart yet)", () => {
    // Changing duration post-run would only falsify the results banner; it
    // returns when a restart action lands in a later slice.
    expect(mapKeyToCommand(key({ name: "3", sequence: "3" }), finished)).toEqual({
      kind: "none",
    });
  });

  test("printables no longer type once the run is over", () => {
    expect(mapKeyToCommand(key({ name: "h", sequence: "h" }), finished)).toEqual({
      kind: "none",
    });
  });

  test("Ctrl-C still quits from the finished state", () => {
    expect(
      mapKeyToCommand(key({ name: "c", sequence: "\x03", ctrl: true }), finished),
    ).toEqual({ kind: "quit" });
  });
});
