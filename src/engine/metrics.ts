// Pure metrics — a 1:1 port of frank_type's app/javascript/lib/typing/metrics.js
// (calculateMetrics + summarizeWords). The formulas and constants are reproduced
// byte-for-byte; golden values are pinned in test/engine/metrics.test.ts, ported
// from frank_type's own typing_metrics.test.mjs. No OpenTUI/TTY/fs — data in,
// data out (the engine seam).
//
// The digraph analysis (summarizeDigraphs) lives in the same frank_type file
// and is ported below, byte-for-byte; the per-character timings captured by the
// session engine feed it. Golden values in test/engine/metrics.test.ts are
// ported verbatim from frank_type's typing_metrics.test.mjs.

// Digraph constants — frank_type verbatim.
const ACTIONABLE_PAIR_LIMIT = 3;
const MAX_HEATED_SAMPLE_LIMIT = 18;
const MAX_HEATED_SAMPLE_RATIO = 0.08;
const MIN_HEATED_SAMPLE_LIMIT = 3;

/** One entry of the session key log, as far as metrics care. */
export interface TypedEvent {
  readonly action: "type" | "backspace";
  /** Present on `type` events: did the keystroke match the expected char. */
  readonly correct?: boolean;
}

export interface Metrics {
  readonly wpm: number;
  readonly rawWpm: number;
  readonly accuracy: number;
  readonly typedCharacters: number;
  readonly correctCharacters: number;
  readonly mistakes: number;
  readonly completion: number;
}

export interface MetricsInput {
  readonly typedEvents?: readonly TypedEvent[];
  readonly correctCharacters?: number;
  readonly elapsedMs?: number;
  readonly targetText?: string;
}

export function calculateMetrics({
  typedEvents = [],
  correctCharacters = 0,
  elapsedMs = 0,
  targetText = "",
}: MetricsInput): Metrics {
  const typedCharacters = typedEvents.filter((event) => event.action === "type").length;
  const mistakes = typedEvents.filter(
    (event) => event.action === "type" && !event.correct,
  ).length;
  const minutes = Math.max(elapsedMs / 60000, 1 / 60000);

  return {
    wpm: Math.round(correctCharacters / 5 / minutes),
    rawWpm: Math.round(typedCharacters / 5 / minutes),
    accuracy:
      typedCharacters === 0
        ? 100
        : Math.max(0, Math.round(((typedCharacters - mistakes) / typedCharacters) * 100)),
    typedCharacters,
    correctCharacters,
    mistakes,
    completion:
      targetText.length === 0
        ? 0
        : Math.round((correctCharacters / targetText.length) * 100),
  };
}

/** Minimal timing shape summarizeWords reads (a subset of CharTiming). */
export interface WordTiming {
  readonly index: number;
  readonly elapsedMs: number;
  readonly correct: boolean;
}

export interface WordSummary {
  readonly word: string;
  readonly wordIndex: number;
  readonly startIndex: number;
  readonly endIndex: number;
  /** Press span across the word's characters, or null if none were typed. */
  readonly elapsedMs: number | null;
  readonly correct: boolean;
}

export function summarizeWords({
  text,
  characterTimings,
}: {
  readonly text: string;
  readonly characterTimings: readonly WordTiming[];
}): WordSummary[] {
  const words = text.split(" ");
  const summaries: WordSummary[] = [];
  let cursor = 0;

  words.forEach((word, wordIndex) => {
    const startIndex = cursor;
    const endIndex = cursor + word.length - 1;
    const timings = characterTimings.filter(
      (timing) => timing.index >= startIndex && timing.index <= endIndex,
    );
    const first = timings.at(0);
    const last = timings.at(-1);

    summaries.push({
      word,
      wordIndex,
      startIndex,
      endIndex,
      elapsedMs: first && last ? Math.round(last.elapsedMs - first.elapsedMs) : null,
      correct: timings.length === word.length && timings.every((timing) => timing.correct),
    });

    cursor += word.length + 1;
  });

  return summaries;
}

// --- digraph analysis (frank_type summarizeDigraphs, ported byte-for-byte) ----

/** Per-character timing a digraph sample reads (subset of session CharTiming). */
export interface DigraphTiming {
  readonly index: number;
  readonly expected: string;
  readonly correct: boolean;
  readonly elapsedMs: number;
}

/** Key-log entry the digraph pass reads (only backspaces, by elapsedMs). */
export interface DigraphKeyEvent {
  readonly action: string;
  readonly elapsedMs: number;
}

/** One kept adjacent-pair latency sample, with its heat (0–1). */
export interface DigraphSample {
  readonly pair: string;
  readonly displayPair: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly latencyMs: number;
  readonly heat: number;
}

/** A pair aggregated across its samples, ranked slowest-first. */
export interface RankedPair {
  readonly pair: string;
  readonly displayPair: string;
  readonly count: number;
  readonly medianLatencyMs: number;
  readonly maxLatencyMs: number;
  readonly heat: number;
}

export interface DigraphSummary {
  readonly samples: DigraphSample[];
  readonly rankedPairs: RankedPair[];
  readonly medianLatencyMs: number;
}

/** Sample shape while heat is still being assigned (frank_type: `heat` added later). */
type PartialSample = Omit<DigraphSample, "heat"> & { heat?: number };

export function summarizeDigraphs({
  characterTimings = [],
  keyEvents = [],
  minLatencyMs = 30,
  maxLatencyMs = 1200,
}: {
  characterTimings?: readonly DigraphTiming[];
  keyEvents?: readonly DigraphKeyEvent[];
  minLatencyMs?: number;
  maxLatencyMs?: number;
} = {}): DigraphSummary {
  const backspaces = keyEvents.filter((event) => event.action === "backspace");
  const samples: PartialSample[] = [];

  for (let index = 1; index < characterTimings.length; index += 1) {
    const previous = characterTimings[index - 1]!;
    const current = characterTimings[index]!;

    if (current.index !== previous.index + 1) continue;
    if (!previous.correct || !current.correct) continue;

    const latencyMs = current.elapsedMs - previous.elapsedMs;
    if (latencyMs < minLatencyMs || latencyMs > maxLatencyMs) continue;
    if (hasCorrectionBetween(backspaces, previous.elapsedMs, current.elapsedMs)) continue;

    samples.push({
      pair: `${previous.expected}${current.expected}`,
      displayPair: displayPair(`${previous.expected}${current.expected}`),
      startIndex: previous.index,
      endIndex: current.index,
      latencyMs,
    });
  }

  const latencies = samples.map((sample) => sample.latencyMs).sort((left, right) => left - right);
  const baseline = median(latencies);
  const actionablePairs = rankPairs(samples)
    .filter((pair) => pair.medianLatencyMs > baseline)
    .slice(0, ACTIONABLE_PAIR_LIMIT);
  const actionablePairMap = new Map(actionablePairs.map((pair) => [pair.pair, pair]));
  const heatableSamples = selectHeatableSamples({ actionablePairMap, baseline, samples });
  const actionableGains = [...heatableSamples]
    .map((sample) => sample.latencyMs - baseline)
    .sort((left, right) => left - right);
  const lowGain = Math.max(percentile(actionableGains, 0.25), 1);
  const highGain = Math.max(percentile(actionableGains, 0.95), lowGain + 1);
  const heatedSamples: DigraphSample[] = samples.map((sample) => ({
    ...sample,
    heat: heatForSample({ baseline, heatableSamples, highGain, lowGain, sample }),
  }));

  return {
    samples: heatedSamples,
    rankedPairs: rankPairs(heatedSamples),
    medianLatencyMs: baseline,
  };
}

function selectHeatableSamples({
  actionablePairMap,
  baseline,
  samples,
}: {
  actionablePairMap: Map<string, RankedPair>;
  baseline: number;
  samples: readonly PartialSample[];
}): Set<PartialSample> {
  const limit = Math.min(
    MAX_HEATED_SAMPLE_LIMIT,
    Math.max(MIN_HEATED_SAMPLE_LIMIT, Math.floor(samples.length * MAX_HEATED_SAMPLE_RATIO)),
  );

  return new Set(
    samples
      .filter((sample) => actionablePairMap.has(sample.pair))
      .filter((sample) => sample.latencyMs >= actionablePairMap.get(sample.pair)!.medianLatencyMs)
      .filter((sample) => sample.latencyMs > baseline)
      .sort((left, right) => right.latencyMs - baseline - (left.latencyMs - baseline))
      .slice(0, limit),
  );
}

function heatForSample({
  baseline,
  heatableSamples,
  highGain,
  lowGain,
  sample,
}: {
  baseline: number;
  heatableSamples: Set<PartialSample>;
  highGain: number;
  lowGain: number;
  sample: PartialSample;
}): number {
  if (!heatableSamples.has(sample)) return 0;

  const gain = sample.latencyMs - baseline;
  return 0.35 + clamp((gain - lowGain) / (highGain - lowGain)) * 0.65;
}

export function displayPair(pair: string): string {
  return pair.replaceAll(" ", "␠");
}

function rankPairs(
  samples: readonly (PartialSample & { heat?: number })[],
): RankedPair[] {
  const groups = new Map<string, (PartialSample & { heat?: number })[]>();

  samples.forEach((sample) => {
    if (!groups.has(sample.pair)) groups.set(sample.pair, []);
    groups.get(sample.pair)!.push(sample);
  });

  return [...groups.entries()]
    .map(([pair, pairSamples]) => {
      const latencies = pairSamples
        .map((sample) => sample.latencyMs)
        .sort((left, right) => left - right);

      return {
        pair,
        displayPair: displayPair(pair),
        count: pairSamples.length,
        medianLatencyMs: median(latencies),
        maxLatencyMs: Math.max(...latencies),
        heat: Math.max(...pairSamples.map((sample) => sample.heat || 0)),
      };
    })
    .sort(
      (left, right) =>
        right.medianLatencyMs - left.medianLatencyMs || right.count - left.count,
    );
}

function hasCorrectionBetween(
  backspaces: readonly DigraphKeyEvent[],
  previousElapsedMs: number,
  currentElapsedMs: number,
): boolean {
  return backspaces.some(
    (event) => event.elapsedMs > previousElapsedMs && event.elapsedMs < currentElapsedMs,
  );
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;

  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? Math.round((values[middle - 1]! + values[middle]!) / 2)
    : values[middle]!;
}

function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) return 0;

  return values[Math.min(values.length - 1, Math.floor((values.length - 1) * ratio))]!;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(value, 1));
}
