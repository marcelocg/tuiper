import { describe, expect, test } from "bun:test";
import { cellsToRows, rowsText, span, windowClip } from "../../src/engine/view_row";
import type { CharCell } from "../../src/engine/typing_view";

function cell(over: Partial<CharCell>): CharCell {
  return { char: "x", status: "pending", cursor: false, ...over };
}

describe("rowsText", () => {
  test("projects each row to its concatenated span text", () => {
    const rows = [
      [span("chrome", "th   "), span("wrong", "280ms")],
      [span("title", "Slowest pairs")],
    ];
    expect(rowsText(rows)).toEqual(["th   280ms", "Slowest pairs"]);
  });
});

describe("cellsToRows", () => {
  test("maps status to role, cursor to cursor, heat to a heat span", () => {
    const grid: CharCell[][] = [
      [cell({ char: "c", status: "correct" }), cell({ char: "a", status: "wrong" }), cell({ char: "t", status: "pending", cursor: true })],
      [cell({ char: "h", status: "correct", heat: 0.8 })],
    ];
    expect(cellsToRows(grid)).toEqual([
      [span("correct", "c"), span("wrong", "a"), span("cursor", "t")],
      [{ text: "h", heat: 0.8 }],
    ]);
  });
});

describe("windowClip", () => {
  const lines = (n: number) => Array.from({ length: n }, (_, i) => [span("chrome", `L${i}`)]);

  test("windows to height from the given top line, clamping past the end", () => {
    const w = windowClip(lines(6), { top: 2, width: 80, height: 3 });
    expect(rowsText(w)).toEqual(["L2", "L3", "L4"]);
  });

  test("clamps top so a too-large offset still fills the window", () => {
    const w = windowClip(lines(6), { top: 99, width: 80, height: 3 });
    expect(rowsText(w)).toEqual(["L3", "L4", "L5"]);
  });

  test("shorter-than-window content returns unchanged", () => {
    expect(rowsText(windowClip(lines(2), { top: 0, width: 80, height: 5 }))).toEqual(["L0", "L1"]);
  });
});

describe("windowClip — width clipping", () => {
  test("clips an over-wide row to width-1 chars plus an ellipsis", () => {
    const rows = [[span("chrome", "abcdefgh")]];
    expect(rowsText(windowClip(rows, { top: 0, width: 5, height: 9 }))).toEqual(["abcd…"]);
  });

  test("rows within width are untouched", () => {
    const rows = [[span("chrome", "abc")]];
    expect(rowsText(windowClip(rows, { top: 0, width: 5, height: 9 }))).toEqual(["abc"]);
  });

  test("width <= 1 truncates with no ellipsis", () => {
    const rows = [[span("chrome", "abc")]];
    expect(rowsText(windowClip(rows, { top: 0, width: 1, height: 9 }))).toEqual(["a"]);
  });

  test("clip walks spans; the ellipsis carries the boundary span's role", () => {
    const rows = [[span("chrome", "abc"), span("wrong", "defgh")]];
    const [row] = windowClip(rows, { top: 0, width: 5, height: 9 });
    expect(row).toEqual([span("chrome", "abc"), span("wrong", "d…")]);
  });
});
