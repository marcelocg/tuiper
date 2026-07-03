import { describe, expect, test } from "bun:test";
import { mapKeyToCommand } from "../../src/engine/input_intent";
import { createSession, finish, typeChar } from "../../src/engine/session_state";
import { key } from "../support/key_event";

// Excerpt-selection intents added for #5: Tab loads the next excerpt (a control
// key, live in every state), `c` cycles the category (a Ready/Finished hotkey
// that is typed input mid-run). State-gating is the correctness-critical rule.

const ready = createSession("hello world");
const active = typeChar(createSession("hello world"), "h", 1000);
const finished = finish(typeChar(createSession("hello world"), "h", 1000), 40000);

const tab = key({ name: "tab", sequence: "\t" });
const cKey = key({ name: "c", sequence: "c" });
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

describe("p → openProfile", () => {
  test("opens the profile when Ready or Finished", () => {
    expect(mapKeyToCommand(pKey, ready)).toEqual({ kind: "openProfile" });
    expect(mapKeyToCommand(pKey, finished)).toEqual({ kind: "openProfile" });
  });

  test("is typed input mid-run (never opens the overlay)", () => {
    expect(mapKeyToCommand(pKey, active)).toEqual({ kind: "type", char: "p" });
  });
});
