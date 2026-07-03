import { describe, expect, test } from "bun:test";
import { applyCommand, createSession, typeChar } from "../../src/engine/session_state";

// applyCommand wires the pure deletion counts (deletion.ts) into the session
// engine. Word boundaries are read off the TARGET at the cursor, so a mistyped
// word still deletes cleanly (frank_type parity).

/** Type `text` into a fresh session for `target`, one char per 10ms from t=1000. */
function typed(target: string, text: string) {
  let s = createSession(target);
  [...text].forEach((ch, i) => (s = typeChar(s, ch, 1000 + i * 10)));
  return s;
}

describe("applyCommand — deleteWord", () => {
  test("removes the previous word and its trailing space", () => {
    const s = typed("hello world", "hello wor"); // cursor at 9
    // previousWordDeletionCount("hello world", 9) → back over "wor" to index 6.
    const next = applyCommand(s, { kind: "deleteWord" }, 2000);
    expect(next.input).toBe("hello ");
  });

  test("at a word start, deletes the whole preceding word incl. its space", () => {
    const s = typed("hello world", "hello "); // cursor at 6
    const next = applyCommand(s, { kind: "deleteWord" }, 2000);
    expect(next.input).toBe("");
  });

  test("uses the target's boundaries even when the input mistypes the word", () => {
    const s = typed("hello world", "hexxo wor"); // typed wrong but cursor still 9
    const next = applyCommand(s, { kind: "deleteWord" }, 2000);
    expect(next.input).toBe("hexxo "); // deletes 3 chars (the target's "wor")
  });

  test("logs one backspace event per removed position", () => {
    const s = typed("hello world", "hello wor");
    const before = s.events.length;
    const next = applyCommand(s, { kind: "deleteWord" }, 2000);
    const bs = next.events.slice(before);
    expect(bs).toHaveLength(3);
    expect(bs.every((e) => e.action === "backspace")).toBe(true);
  });
});

describe("applyCommand — deleteToLineStart", () => {
  test("with no resolved index, deletes to the input start", () => {
    const s = typed("hello world", "hello wor");
    const next = applyCommand(s, { kind: "deleteToLineStart" }, 2000);
    expect(next.input).toBe("");
  });

  test("honours a shell-resolved line-start index", () => {
    const s = typed("the quick brown fox", "the quick brown"); // cursor 15
    // Second visual line starts at index 10 ("brown"); delete 5 chars.
    const next = applyCommand(s, { kind: "deleteToLineStart", toIndex: 10 }, 2000);
    expect(next.input).toBe("the quick ");
  });

  test("an index at or past the cursor deletes nothing", () => {
    const s = typed("hello world", "hello");
    const next = applyCommand(s, { kind: "deleteToLineStart", toIndex: 5 }, 2000);
    expect(next.input).toBe("hello");
  });
});
