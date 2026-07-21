import { describe, expect, test } from "bun:test";
import { mapKeyToCommand } from "../../src/engine/input_intent";
import { createSession, typeChar } from "../../src/engine/session_state";
import type { Overlay } from "../../src/engine/overlay";
import { key } from "../support/key_event";

// Overlay keys used to be an ad-hoc second input model in the shell, untested.
// They now cross the same seam as the session: (KeyEvent, InputState) -> Command.
// These cases pin the rules that were previously only reachable through a TTY.

const PAGE = 19; // the shell's overlay page-scroll step at 24 rows

const session = typeChar(createSession("hello world", 30), "h", 1000); // mid-run
const on = (overlay: Overlay) => ({ state: session, overlay, pageSize: PAGE });

const down = key({ name: "down", sequence: "\x1b[B" });
const up = key({ name: "up", sequence: "\x1b[A" });
const pageDown = key({ name: "pagedown", sequence: "\x1b[6~" });
const pageUp = key({ name: "pageup", sequence: "\x1b[5~" });
const esc = key({ name: "escape", sequence: "\x1b" });
const tab = key({ name: "tab", sequence: "\t" });
const ctrlC = key({ name: "c", sequence: "\x03", ctrl: true });

describe("overlay keys — scrolling", () => {
  test("arrows scroll a scrollable overlay one line", () => {
    expect(mapKeyToCommand(down, on("help"))).toEqual({ kind: "scrollOverlay", delta: 1 });
    expect(mapKeyToCommand(up, on("help"))).toEqual({ kind: "scrollOverlay", delta: -1 });
  });

  test("j / k scroll one line (vi bindings)", () => {
    expect(mapKeyToCommand(key({ sequence: "j" }), on("sources"))).toEqual({
      kind: "scrollOverlay",
      delta: 1,
    });
    expect(mapKeyToCommand(key({ sequence: "k" }), on("sources"))).toEqual({
      kind: "scrollOverlay",
      delta: -1,
    });
  });

  test("page keys scroll by the shell-supplied page size", () => {
    expect(mapKeyToCommand(pageDown, on("help"))).toEqual({ kind: "scrollOverlay", delta: PAGE });
    expect(mapKeyToCommand(pageUp, on("help"))).toEqual({ kind: "scrollOverlay", delta: -PAGE });
  });

  test("profile never scrolls — a nav key dismisses it instead", () => {
    expect(mapKeyToCommand(down, on("profile"))).toEqual({ kind: "closeOverlay" });
    expect(mapKeyToCommand(pageDown, on("profile"))).toEqual({ kind: "closeOverlay" });
  });
});

describe("overlay keys — dismissing", () => {
  test("Esc, q, and any other key close the overlay", () => {
    for (const k of [esc, key({ sequence: "q" }), key({ sequence: "x" })]) {
      expect(mapKeyToCommand(k, on("help"))).toEqual({ kind: "closeOverlay" });
    }
  });

  test("q closes the overlay rather than quitting the app", () => {
    // Mid-run `q` would otherwise be typed input, and in ready/finished it quits.
    expect(mapKeyToCommand(key({ sequence: "q" }), on("sources"))).toEqual({
      kind: "closeOverlay",
    });
  });

  test("Tab closes the overlay instead of loading the next excerpt", () => {
    // Tab is a control key in every session state, so the overlay branch has to
    // run BEFORE the Tab rule or an overlay key would swap the excerpt.
    expect(mapKeyToCommand(tab, on("help"))).toEqual({ kind: "closeOverlay" });
  });

  test("a printable never reaches the session while an overlay is up", () => {
    expect(mapKeyToCommand(key({ sequence: "h" }), on("help"))).toEqual({ kind: "closeOverlay" });
  });
});

describe("overlay keys — event types", () => {
  test("Ctrl-C quits from an overlay", () => {
    expect(mapKeyToCommand(ctrlC, on("help"))).toEqual({ kind: "quit" });
  });

  test("release events are ignored", () => {
    expect(mapKeyToCommand({ ...down, eventType: "release" }, on("help"))).toEqual({
      kind: "none",
    });
  });

  test("repeat events are ignored, unlike the session (which types on repeat)", () => {
    // Holding the key that opened the overlay must not immediately close it.
    expect(mapKeyToCommand({ ...esc, eventType: "repeat" }, on("help"))).toEqual({ kind: "none" });
    expect(mapKeyToCommand({ ...down, eventType: "repeat" }, on("help"))).toEqual({ kind: "none" });
  });

  test("a repeat Ctrl-C inside an overlay does nothing", () => {
    // `repeat` is dropped before the Ctrl-C check — quitting takes a fresh press.
    expect(mapKeyToCommand({ ...ctrlC, eventType: "repeat" }, on("help"))).toEqual({
      kind: "none",
    });
  });
});

describe("no overlay — the session model is untouched", () => {
  test("keys reach the session exactly as before", () => {
    const input = { state: session, overlay: null, pageSize: PAGE };
    expect(mapKeyToCommand(key({ sequence: "h" }), input)).toEqual({ kind: "type", char: "h" });
    expect(mapKeyToCommand(tab, input)).toEqual({ kind: "nextExcerpt" });
    expect(mapKeyToCommand(ctrlC, input)).toEqual({ kind: "quit" });
  });

  test("nav keys are inert without an overlay (no stray scroll commands)", () => {
    const input = { state: session, overlay: null, pageSize: PAGE };
    expect(mapKeyToCommand(down, input)).toEqual({ kind: "none" });
    expect(mapKeyToCommand(pageUp, input)).toEqual({ kind: "none" });
  });
});
