import { describe, expect, test } from "bun:test";
import {
  computeHeatCells,
  formatSlowPairs,
  heatByIndex,
} from "../../src/engine/heatmap_view";
import { summarizeDigraphs, type DigraphSample } from "../../src/engine/metrics";
import { wordWrap } from "../../src/engine/typing_view";
import { rowsText } from "../../src/engine/view_row";

function sample(over: Partial<DigraphSample>): DigraphSample {
  return {
    pair: "ab",
    displayPair: "ab",
    startIndex: 0,
    endIndex: 1,
    latencyMs: 100,
    heat: 0.5,
    ...over,
  };
}

describe("heatByIndex", () => {
  test("assigns each covered index the sample heat, 0 elsewhere", () => {
    const heat = heatByIndex([sample({ startIndex: 1, endIndex: 2, heat: 0.8 })], 4);
    expect(heat).toEqual([0, 0.8, 0.8, 0]);
  });

  test("overlapping samples take the hotter heat per index", () => {
    const heat = heatByIndex(
      [
        sample({ startIndex: 0, endIndex: 1, heat: 0.3 }),
        sample({ startIndex: 1, endIndex: 2, heat: 0.9 }),
      ],
      3,
    );
    expect(heat).toEqual([0.3, 0.9, 0.9]);
  });

  test("cold samples (heat 0) leave the excerpt cold", () => {
    expect(heatByIndex([sample({ heat: 0 })], 2)).toEqual([0, 0]);
  });

  test("indices outside the target are ignored (no throw)", () => {
    expect(heatByIndex([sample({ startIndex: 3, endIndex: 5 })], 2)).toEqual([0, 0]);
  });
});

describe("computeHeatCells", () => {
  test("one cell per char, carrying its heat, all correct, no cursor", () => {
    const cells = computeHeatCells("ab", [sample({ startIndex: 0, endIndex: 1, heat: 0.7 })]);
    expect(cells).toEqual([
      { char: "a", status: "correct", cursor: false, heat: 0.7 },
      { char: "b", status: "correct", cursor: false, heat: 0.7 },
    ]);
  });

  test("layout is wrappable: heat cells feed wordWrap unchanged", () => {
    const cells = computeHeatCells("ab cd", []);
    const lines = wordWrap(cells, 2);
    expect(lines.map((line) => line.map((c) => c.char).join(""))).toEqual(["ab", "cd"]);
  });

  test("empty target → no cells", () => {
    expect(computeHeatCells("", [])).toEqual([]);
  });
});

describe("formatSlowPairs", () => {
  test("lists top actionable pairs slowest-first with latencies", () => {
    // "the m" typed slowly on the last two pairs — the space pairs are slowest.
    const summary = summarizeDigraphs({
      characterTimings: [
        { index: 0, expected: "t", correct: true, elapsedMs: 0 },
        { index: 1, expected: "h", correct: true, elapsedMs: 180 },
        { index: 2, expected: "e", correct: true, elapsedMs: 240 },
        { index: 3, expected: " ", correct: true, elapsedMs: 520 },
        { index: 4, expected: "m", correct: true, elapsedMs: 610 },
      ],
      keyEvents: [],
    });
    const rows = formatSlowPairs(summary.rankedPairs);
    expect(rowsText(rows)[0]).toBe("e␠   280ms");
    expect(rows[0]![0]).toMatchObject({ role: "wrong" }); // slow pairs are painted wrong
  });

  test("drops cold pairs and caps at the limit", () => {
    const ranked = [
      { pair: "ab", displayPair: "ab", count: 1, medianLatencyMs: 300, maxLatencyMs: 300, heat: 0.9 },
      { pair: "cd", displayPair: "cd", count: 1, medianLatencyMs: 200, maxLatencyMs: 200, heat: 0.5 },
      { pair: "ef", displayPair: "ef", count: 1, medianLatencyMs: 100, maxLatencyMs: 100, heat: 0 },
    ];
    expect(rowsText(formatSlowPairs(ranked, 2))).toEqual(["ab   300ms", "cd   200ms"]);
  });

  test("no slow pairs → empty list", () => {
    expect(formatSlowPairs([])).toEqual([]);
  });
});
