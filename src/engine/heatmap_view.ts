import type { DigraphSample, RankedPair } from "./metrics";
import type { CharCell } from "./typing_view";

// Pure view mapping for the post-run digraph heat map: the excerpt is replayed
// with a per-character heat (0–1) and a ranked slow-pairs list. The shell turns
// heat into concrete cell backgrounds (truecolor gradient, 256-color fallback);
// this layer stays free of OpenTUI so the map can be asserted on an in-memory
// grid. Reuses `wordWrap`/`visibleWindow` from typing_view for identical layout.

/**
 * Max digraph heat covering each target index (0 where no sample overlaps).
 * A character can sit in two adjacent samples (end of one pair, start of the
 * next); the hotter wins so a cluster reads as one warm region.
 */
export function heatByIndex(
  samples: readonly DigraphSample[],
  targetLength: number,
): number[] {
  const heat = new Array<number>(Math.max(0, targetLength)).fill(0);
  for (const sample of samples) {
    for (let i = sample.startIndex; i <= sample.endIndex; i++) {
      if (i >= 0 && i < heat.length) heat[i] = Math.max(heat[i]!, sample.heat);
    }
  }
  return heat;
}

/**
 * Replay cells for the heat map: one cell per target character carrying its
 * per-cell heat. Every char is shown as `correct` (this is a replay of the
 * finished excerpt, not live typing) with no cursor.
 */
export function computeHeatCells(
  target: string,
  samples: readonly DigraphSample[],
): CharCell[] {
  const heat = heatByIndex(samples, target.length);
  const cells: CharCell[] = [];
  for (let i = 0; i < target.length; i++) {
    cells.push({ char: target[i]!, status: "correct", cursor: false, heat: heat[i]! });
  }
  return cells;
}

/**
 * The ranked slow-pairs list, top-N slowest first, as display lines like
 * `th   280ms`. `rankedPairs` is already sorted slowest-median-first by
 * summarizeDigraphs; cold pairs (heat 0) are dropped so only actionable slow
 * pairs are surfaced. Empty when there is nothing slow to report.
 */
export function formatSlowPairs(
  rankedPairs: readonly RankedPair[],
  limit = 3,
): string[] {
  return rankedPairs
    .filter((pair) => pair.heat > 0)
    .slice(0, limit)
    .map((pair) => `${pair.displayPair.padEnd(4)} ${pair.medianLatencyMs}ms`);
}
