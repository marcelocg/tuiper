// Adaptive banding + excerpt selection — a 1:1 port of frank_type's
// app/javascript/lib/typing/speed_band.js. Pure: band is derived from stored
// history, selection from an excerpt list. Math.random is injectable as `rng`
// so selection can be golden-tested deterministically; the default matches
// frank_type exactly.

const RECENT_SESSION_LIMIT = 5;

export type SpeedBand = "slow" | "medium" | "fast";

/** The slice of a stored session speed banding reads. */
export interface BandSession {
  readonly metrics?: { readonly wpm?: number } | undefined;
}

/** The slice of an excerpt selection reads. */
export interface BandExcerpt {
  readonly category: string;
  readonly speed_band: string;
}

export interface SelectionOptions {
  readonly category?: string;
  readonly except?: number | null;
  readonly speedBand?: SpeedBand | string;
}

/**
 * Band from the average WPM of the most recent 5 sessions: `< 75` slow,
 * `75–139` medium, `≥ 140` fast. No positive history → slow (cold start).
 */
export function preferredSpeedBand(sessions: readonly BandSession[] = []): SpeedBand {
  const recentWpms = sessions
    .slice(0, RECENT_SESSION_LIMIT)
    .map((session) => Number(session?.metrics?.wpm))
    .filter((wpm) => Number.isFinite(wpm) && wpm > 0);

  if (recentWpms.length === 0) return "slow";

  const averageWpm = recentWpms.reduce((sum, wpm) => sum + wpm, 0) / recentWpms.length;

  if (averageWpm >= 140) return "fast";
  if (averageWpm >= 75) return "medium";
  return "slow";
}

/**
 * Pick a random excerpt index matching the selected category and band, never
 * the current one (`except`). Falls back to any excerpt but the current when no
 * candidate matches. `rng` returns [0,1); defaults to Math.random.
 */
export function randomExcerptIndex(
  excerpts: readonly BandExcerpt[],
  { category = "random", except = null, speedBand = "slow" }: SelectionOptions = {},
  rng: () => number = Math.random,
): number {
  if (excerpts.length <= 1) return 0;

  const candidateIndexes = excerpts
    .map((excerpt, index) => ({ excerpt, index }))
    .filter(
      ({ excerpt, index }) =>
        matchesCategory(excerpt, category) &&
        excerpt.speed_band === speedBand &&
        index !== except,
    )
    .map(({ index }) => index);

  const fallbackIndexes = excerpts
    .map((_excerpt, index) => index)
    .filter((index) => index !== except);

  const pool = candidateIndexes.length > 0 ? candidateIndexes : fallbackIndexes;
  return pool[Math.floor(rng() * pool.length)]!;
}

function matchesCategory(excerpt: BandExcerpt, category: string): boolean {
  return category === "random" || excerpt.category === category;
}
