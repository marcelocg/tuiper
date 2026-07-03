import { describe, expect, test } from "bun:test";
import {
  computeCells,
  cursorRow,
  visibleWindow,
  visualLineStartIndex,
  visualLineStarts,
  wordWrap,
  type CharCell,
} from "../../src/engine/typing_view";
import { createSession } from "../../src/engine/session_state";

/** Compact a cell row into "<char><flag>" tokens for readable assertions. */
function render(cells: CharCell[]): string {
  const flag = { pending: ".", correct: "+", wrong: "!" } as const;
  return cells
    .map((c) => `${c.char}${flag[c.status]}${c.cursor ? "^" : ""}`)
    .join(" ");
}

describe("computeCells", () => {
  test("all pending before any input, cursor on the first cell", () => {
    const cells = computeCells(createSession("ab"));
    expect(render(cells)).toBe("a.^ b.");
  });

  test("correct vs wrong colors the EXPECTED char and advances the cursor", () => {
    // target "cat", typed "cx" -> c correct, a wrong (shows expected 'a'), cursor on 't'
    const cells = computeCells({ target: "cat", input: "cx" });
    expect(render(cells)).toBe("c+ a! t.^");
  });

  test("comparison is case-insensitive (NFC + lowercase)", () => {
    const cells = computeCells({ target: "Ab", input: "aB" });
    expect(cells[0]!.status).toBe("correct");
    expect(cells[1]!.status).toBe("correct");
  });

  test("a trailing block cursor appears once the excerpt is fully typed", () => {
    const cells = computeCells({ target: "hi", input: "hi" });
    expect(cells).toHaveLength(3);
    expect(cells[2]).toEqual({ char: " ", status: "pending", cursor: true });
  });
});

describe("wordWrap", () => {
  function cellsOf(text: string): CharCell[] {
    return [...text].map((ch) => ({ char: ch, status: "pending", cursor: false }));
  }
  function text(lines: CharCell[][]): string[] {
    return lines.map((l) => l.map((c) => c.char).join(""));
  }

  test("wraps on word boundaries without splitting words", () => {
    expect(text(wordWrap(cellsOf("the quick brown fox"), 9))).toEqual([
      "the quick",
      "brown fox",
    ]);
  });

  test("consumes the space at a wrap boundary (no leading spaces)", () => {
    expect(text(wordWrap(cellsOf("aaa bbb ccc"), 7))).toEqual(["aaa bbb", "ccc"]);
  });

  test("hard-splits a word longer than the width", () => {
    expect(text(wordWrap(cellsOf("abcdefgh"), 3))).toEqual(["abc", "def", "gh"]);
  });

  function cursorCount(lines: CharCell[][]): number {
    return lines.reduce((n, l) => n + l.filter((c) => c.cursor).length, 0);
  }

  test("keeps an inter-word space that carries the cursor at a wrap boundary", () => {
    // target "aaa bbb", typed "aaa": cursor sits on the space at column == width.
    const cells = computeCells({ target: "aaa bbb", input: "aaa" });
    const lines = wordWrap(cells, 3);
    expect(cursorCount(lines)).toBe(1); // the cursor is not dropped
    expect(cursorRow(lines)).toBeGreaterThan(0); // and cursorRow is not the fallback 0
  });

  test("keeps the trailing block cursor when the last word fills the width", () => {
    const cells = computeCells({ target: "abc", input: "abc" });
    const lines = wordWrap(cells, 3);
    expect(cursorCount(lines)).toBe(1);
    expect(cursorRow(lines)).toBe(1);
  });

  test("layout is independent of typed correctness", () => {
    const target = "the quick brown fox";
    const pending = wordWrap(computeCells({ target, input: "" }), 9);
    const typed = wordWrap(
      computeCells({ target, input: "the quxck" }),
      9,
    );
    expect(text(typed)).toEqual(text(pending));
  });
});

describe("cursorRow", () => {
  test("finds the wrapped line holding the cursor", () => {
    const cells = computeCells({
      target: "the quick brown fox",
      input: "the quick brown", // cursor at index 15 -> start of "fox" region
    });
    const lines = wordWrap(cells, 9);
    // "the quick" / "brown fox" -> cursor sits on the second line
    expect(cursorRow(lines)).toBe(1);
  });
});

describe("visibleWindow", () => {
  test("shows everything when it fits", () => {
    expect(visibleWindow(3, 0, 10)).toEqual({ start: 0, end: 3 });
  });

  test("keeps the cursor line visible, biased to the bottom", () => {
    // 20 lines, height 5, cursor on line 10 -> window [6,11)
    expect(visibleWindow(20, 10, 5)).toEqual({ start: 6, end: 11 });
  });

  test("does not scroll past the end", () => {
    expect(visibleWindow(20, 19, 5)).toEqual({ start: 15, end: 20 });
  });

  test("does not scroll before the start", () => {
    expect(visibleWindow(20, 1, 5)).toEqual({ start: 0, end: 5 });
  });
});

describe("visualLineStarts — wrap-aligned line boundaries", () => {
  test("break points match wordWrap's line starts", () => {
    // Assert the pure line-start indices land where wordWrap actually breaks:
    // the first non-dropped cell of each wrapped line matches visualLineStarts.
    const target = "the quick brown fox jumps over the lazy dog";
    for (const width of [8, 10, 13, 20]) {
      const cells = computeCells({ target, input: "" });
      const lines = wordWrap(cells, width).filter((l) => l.length > 0);
      const firstChars = lines.map((l) => l[0]!.char);
      const starts = visualLineStarts(target, width);
      expect(starts.map((s) => target[s])).toEqual(firstChars);
    }
  });

  test("single line when everything fits", () => {
    expect(visualLineStarts("hello world", 80)).toEqual([0]);
  });

  test("hard-splits a word longer than the width", () => {
    // "abcdefgh" (8) at width 3 → lines start at 0,3,6.
    expect(visualLineStarts("abcdefgh", 3)).toEqual([0, 3, 6]);
  });
});

describe("visualLineStartIndex — Ctrl-U resolution", () => {
  const target = "the quick brown fox"; // wraps at width 10: "the quick"|"brown fox"

  test("returns 0 for a cursor on the first line", () => {
    expect(visualLineStartIndex(target, 5, 10)).toBe(0);
  });

  test("returns the second line's start once past the wrap", () => {
    // "brown" begins at index 10 (after "the quick ").
    expect(visualLineStartIndex(target, 13, 10)).toBe(10);
  });

  test("never returns past the cursor", () => {
    expect(visualLineStartIndex(target, 11, 10)).toBe(10);
    expect(visualLineStartIndex(target, 10, 10)).toBe(10);
  });

  test("cursor at 0 and unwrapped text stay at line start 0", () => {
    expect(visualLineStartIndex(target, 0, 10)).toBe(0);
    expect(visualLineStartIndex(target, 8, 80)).toBe(0);
  });
});
