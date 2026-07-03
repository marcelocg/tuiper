import { describe, expect, test } from "bun:test";
import { BRAILLE_BLANK, brailleChart } from "../../src/engine/braille_chart";

// A braille line chart is a pure numeric-series → text-lines renderer. Each cell
// packs a 2×4 dot grid, so a `width`×`height` chart plots on 2·width dot-columns
// and 4·height dot-rows. We assert shape and dot placement, never OpenTUI.

/** Total lit dots across a rendered chart (each braille cell carries 0–8). */
function litDots(lines: readonly string[]): number {
  let count = 0;
  for (const line of lines) {
    for (const ch of line) {
      let bits = ch.codePointAt(0)! - 0x2800;
      while (bits) {
        count += bits & 1;
        bits >>= 1;
      }
    }
  }
  return count;
}

describe("brailleChart shape", () => {
  test("emits exactly height lines, each width cells wide", () => {
    const lines = brailleChart([1, 2, 3, 4], 10, 3);
    expect(lines).toHaveLength(3);
    for (const line of lines) expect([...line]).toHaveLength(10);
  });

  test("all cells are braille (U+2800 block)", () => {
    for (const ch of brailleChart([5, 1, 9, 3], 6, 2).join("")) {
      const code = ch.codePointAt(0)!;
      expect(code).toBeGreaterThanOrEqual(0x2800);
      expect(code).toBeLessThanOrEqual(0x28ff);
    }
  });

  test("degenerate width/height clamp to at least 1", () => {
    const lines = brailleChart([1, 2], 0, 0);
    expect(lines).toHaveLength(1);
    expect([...lines[0]!]).toHaveLength(1);
  });
});

describe("brailleChart plotting", () => {
  test("empty series → a blank braille canvas", () => {
    const lines = brailleChart([], 4, 2);
    expect(lines).toEqual([BRAILLE_BLANK.repeat(4), BRAILLE_BLANK.repeat(4)]);
    expect(litDots(lines)).toBe(0);
  });

  test("plots one dot per dot-column (2·width dots for a filled series)", () => {
    // Distinct rising values so every dot-column samples a value and lights one
    // dot — a width-w chart has 2w dot-columns.
    const lines = brailleChart([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5, 4);
    expect(litDots(lines)).toBe(10); // 2·5 dot-columns, one dot each
  });

  test("the maximum sits at the top row, the minimum at the bottom row", () => {
    // Rising series: highest value on the left→right end is the max. Its dot is
    // on the top dot-row (row 0), the min on the bottom dot-row.
    const lines = brailleChart([0, 100], 4, 2);
    const topDot = 0x01; // dot at (col 0, row 0)
    const bottomDot = 0x80; // dot at (col 1, row 3) — set on a right dot-column
    // Some cell in the top line carries a top-row dot; some cell in the bottom
    // line carries a bottom-row dot.
    const hasTopRowDot = [...lines[0]!].some(
      (c) => (c.codePointAt(0)! - 0x2800) & (0x01 | 0x08),
    );
    const hasBottomRowDot = [...lines[lines.length - 1]!].some(
      (c) => (c.codePointAt(0)! - 0x2800) & (0x40 | 0x80),
    );
    expect(hasTopRowDot).toBe(true);
    expect(hasBottomRowDot).toBe(true);
    void topDot;
    void bottomDot;
  });

  test("a flat series plots along a single mid row (no divide-by-zero)", () => {
    const lines = brailleChart([50, 50, 50, 50], 4, 4);
    expect(litDots(lines)).toBe(8); // 2·4 dot-columns, one dot each, all valid
    // Nothing on the very top or very bottom dot-row — a flat line sits mid.
    const topRow = [...lines[0]!].some((c) => (c.codePointAt(0)! - 0x2800) & (0x01 | 0x08));
    expect(topRow).toBe(false);
  });
});
