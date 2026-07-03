import { describe, expect, test } from "bun:test";
import {
  cellToChunk,
  heatCellToChunk,
  heatToBg,
  paletteFor,
  rush,
  slate,
} from "../../src/shell/theme";
import type { CharCell } from "../../src/engine/typing_view";
import type { RGBA } from "@opentui/core";

function cell(over: Partial<CharCell>): CharCell {
  return { char: "x", status: "pending", cursor: false, ...over };
}

/** Read back an RGBA's channels as 0–255 ints. */
function ints(c: RGBA): [number, number, number] {
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

const CUBE = [0, 95, 135, 175, 215, 255];

describe("palettes", () => {
  test("paletteFor resolves each theme name", () => {
    expect(paletteFor("slate")).toBe(slate);
    expect(paletteFor("rush")).toBe(rush);
  });

  test("Slate and Rush are distinct palettes with all roles filled", () => {
    for (const p of [slate, rush]) {
      for (const role of ["pending", "correct", "wrong", "cursorBg", "cursorFg", "chrome", "heatFg"] as const) {
        expect(p[role]).toBeDefined();
      }
    }
    expect(ints(rush.correct)).not.toEqual(ints(slate.correct));
    expect(ints(rush.chrome)).not.toEqual(ints(slate.chrome));
  });
});

describe("cellToChunk", () => {
  test("pending -> dim fg, no background", () => {
    const c = cellToChunk(cell({ status: "pending" }), slate);
    expect(c.fg).toBe(slate.pending);
    expect(c.bg).toBeUndefined();
  });

  test("correct -> green fg", () => {
    expect(cellToChunk(cell({ status: "correct" }), slate).fg).toBe(slate.correct);
  });

  test("wrong -> red fg on the expected char", () => {
    const c = cellToChunk(cell({ char: "a", status: "wrong" }), slate);
    expect(c.text).toBe("a");
    expect(c.fg).toBe(slate.wrong);
  });

  test("cursor -> block (cursor bg + dark fg)", () => {
    const c = cellToChunk(cell({ cursor: true }), slate);
    expect(c.bg).toBe(slate.cursorBg);
    expect(c.fg).toBe(slate.cursorFg);
  });

  test("renders in the active palette (Rush colors differ from Slate)", () => {
    expect(cellToChunk(cell({ status: "correct" }), rush).fg).toBe(rush.correct);
    expect(cellToChunk(cell({ cursor: true }), rush).bg).toBe(rush.cursorBg);
  });
});

describe("heatToBg", () => {
  test("heat 0 -> no background", () => {
    expect(heatToBg(0)).toBeUndefined();
  });

  test("hotter heat is redder (more red, less green)", () => {
    const [rLow, gLow] = ints(heatToBg(0.2)!);
    const [rHigh, gHigh] = ints(heatToBg(1)!);
    expect(rHigh).toBeGreaterThanOrEqual(rLow);
    expect(gHigh).toBeLessThan(gLow); // amber -> red drains green
  });

  test("256-color fallback snaps every channel to the ansi cube", () => {
    for (const heat of [0.1, 0.5, 0.9, 1]) {
      const [r, g, b] = ints(heatToBg(heat, false)!);
      expect(CUBE).toContain(r);
      expect(CUBE).toContain(g);
      expect(CUBE).toContain(b);
    }
  });

  test("truecolor path is not constrained to the cube", () => {
    // at least one heat produces an off-cube channel when truecolor is allowed
    const offCube = [0.15, 0.35, 0.55, 0.75].some((heat) =>
      ints(heatToBg(heat, true)!).some((ch) => !CUBE.includes(ch)),
    );
    expect(offCube).toBe(true);
  });
});

describe("heatCellToChunk", () => {
  test("cold cell (heat 0) -> dim fg, no background", () => {
    const c = heatCellToChunk(cell({ char: "a", heat: 0 }), slate);
    expect(c.text).toBe("a");
    expect(c.bg).toBeUndefined();
    expect(c.fg).toBe(slate.pending);
  });

  test("hot cell -> heat background + legible palette fg", () => {
    const c = heatCellToChunk(cell({ char: "a", heat: 0.8 }), rush);
    expect(c.bg).toBeDefined();
    expect(c.fg).toBe(rush.heatFg);
  });

  test("missing heat is treated as cold", () => {
    expect(heatCellToChunk(cell({ char: "a" }), slate).bg).toBeUndefined();
  });
});
