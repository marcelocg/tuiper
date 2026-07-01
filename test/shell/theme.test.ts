import { describe, expect, test } from "bun:test";
import { cellToChunk, slate } from "../../src/shell/theme";
import type { CharCell } from "../../src/engine/typing_view";

function cell(over: Partial<CharCell>): CharCell {
  return { char: "x", status: "pending", cursor: false, ...over };
}

describe("cellToChunk", () => {
  test("pending -> dim fg, no background", () => {
    const c = cellToChunk(cell({ status: "pending" }));
    expect(c.fg).toBe(slate.pending);
    expect(c.bg).toBeUndefined();
  });

  test("correct -> green fg", () => {
    expect(cellToChunk(cell({ status: "correct" })).fg).toBe(slate.correct);
  });

  test("wrong -> red fg on the expected char", () => {
    const c = cellToChunk(cell({ char: "a", status: "wrong" }));
    expect(c.text).toBe("a");
    expect(c.fg).toBe(slate.wrong);
  });

  test("cursor -> block (cursor bg + dark fg)", () => {
    const c = cellToChunk(cell({ cursor: true }));
    expect(c.bg).toBe(slate.cursorBg);
    expect(c.fg).toBe(slate.cursorFg);
  });
});
