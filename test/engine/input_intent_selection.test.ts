import { describe, expect, test } from "bun:test";
import { mapKeyToCommand as mapKey } from "../../src/engine/input_intent";
import { createSession, finish, typeChar } from "../../src/engine/session_state";
import type { SessionState } from "../../src/engine/session_state";
import type { KeyEvent } from "../../src/engine/key_event";
import type { Command } from "../../src/engine/command";
import { key } from "../support/key_event";
// Session-only wrapper: these cases predate the overlay branch of the seam, so
// they always map with no overlay up. Overlay keys are covered in
// input_intent_overlay.test.ts.
const mapKeyToCommand = (key: KeyEvent, state: SessionState): Command =>
  mapKey(key, { state, overlay: null, pageSize: 19 });

// Excerpt-selection intents added for #5: Tab loads the next excerpt (a control
// key, live in every state), `c` cycles the category (a Ready/Finished hotkey
// that is typed input mid-run). State-gating is the correctness-critical rule.

const ready = createSession("hello world");
const active = typeChar(createSession("hello world"), "h", 1000);
const finished = finish(typeChar(createSession("hello world"), "h", 1000), 40000);

const tab = key({ name: "tab", sequence: "\t" });
const cKey = key({ name: "c", sequence: "c" });
const tKey = key({ name: "t", sequence: "t" });
const lKey = key({ name: "l", sequence: "l" });
const pKey = key({ name: "p", sequence: "p" });

describe("Tab → nextExcerpt", () => {
  test("is a command in every state (Ready / Active / Finished)", () => {
    expect(mapKeyToCommand(tab, ready)).toEqual({ kind: "nextExcerpt" });
    expect(mapKeyToCommand(tab, active)).toEqual({ kind: "nextExcerpt" });
    expect(mapKeyToCommand(tab, finished)).toEqual({ kind: "nextExcerpt" });
  });
});

describe("c → cycleCategory", () => {
  test("cycles the category when Ready or Finished", () => {
    expect(mapKeyToCommand(cKey, ready)).toEqual({ kind: "cycleCategory" });
    expect(mapKeyToCommand(cKey, finished)).toEqual({ kind: "cycleCategory" });
  });

  test("is typed input mid-run (never a command)", () => {
    expect(mapKeyToCommand(cKey, active)).toEqual({ kind: "type", char: "c" });
  });

  test("Ctrl-C still quits, not cycle", () => {
    expect(mapKeyToCommand(key({ name: "c", sequence: "c", ctrl: true }), ready)).toEqual({
      kind: "quit",
    });
  });
});

describe("t → toggleTheme", () => {
  test("toggles the theme when Ready or Finished", () => {
    expect(mapKeyToCommand(tKey, ready)).toEqual({ kind: "toggleTheme" });
    expect(mapKeyToCommand(tKey, finished)).toEqual({ kind: "toggleTheme" });
  });

  test("is typed input mid-run (never a command)", () => {
    expect(mapKeyToCommand(tKey, active)).toEqual({ kind: "type", char: "t" });
  });
});

describe("l → toggleLocale", () => {
  test("toggles the locale when Ready or Finished", () => {
    expect(mapKeyToCommand(lKey, ready)).toEqual({ kind: "toggleLocale" });
    expect(mapKeyToCommand(lKey, finished)).toEqual({ kind: "toggleLocale" });
  });

  test("is typed input mid-run (never a command)", () => {
    expect(mapKeyToCommand(lKey, active)).toEqual({ kind: "type", char: "l" });
  });
});

describe("p → openProfile", () => {
  test("opens the profile when Ready or Finished", () => {
    expect(mapKeyToCommand(pKey, ready)).toEqual({ kind: "openProfile" });
    expect(mapKeyToCommand(pKey, finished)).toEqual({ kind: "openProfile" });
  });

  test("is typed input mid-run (never opens the overlay)", () => {
    expect(mapKeyToCommand(pKey, active)).toEqual({ kind: "type", char: "p" });
  });
});

describe("? → openHelp", () => {
  const helpKey = key({ name: "?", sequence: "?" });

  test("opens the help overlay when Ready or Finished", () => {
    expect(mapKeyToCommand(helpKey, ready)).toEqual({ kind: "openHelp" });
    expect(mapKeyToCommand(helpKey, finished)).toEqual({ kind: "openHelp" });
  });

  test("is typed input mid-run (a `?` in the excerpt, never help)", () => {
    expect(mapKeyToCommand(helpKey, active)).toEqual({ kind: "type", char: "?" });
  });
});

describe("s → openSources", () => {
  const sKey = key({ name: "s", sequence: "s" });

  test("opens the sources screen when Ready or Finished", () => {
    expect(mapKeyToCommand(sKey, ready)).toEqual({ kind: "openSources" });
    expect(mapKeyToCommand(sKey, finished)).toEqual({ kind: "openSources" });
  });

  test("is typed input mid-run (never opens the overlay)", () => {
    expect(mapKeyToCommand(sKey, active)).toEqual({ kind: "type", char: "s" });
  });
});

describe("q → quit", () => {
  const qKey = key({ name: "q", sequence: "q" });

  test("quits when Ready or Finished", () => {
    expect(mapKeyToCommand(qKey, ready)).toEqual({ kind: "quit" });
    expect(mapKeyToCommand(qKey, finished)).toEqual({ kind: "quit" });
  });

  test("is typed input mid-run (a `q` in the excerpt, never quit)", () => {
    expect(mapKeyToCommand(qKey, active)).toEqual({ kind: "type", char: "q" });
  });
});
