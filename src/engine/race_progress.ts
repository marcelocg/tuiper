// Pure race pacing — a 1:1 port of frank_type's race_progress. Two fixed
// pace-setters (a 60 WPM "slow" and a 140 WPM "fast" racer) plus the live user
// marker advance across a shared track. Data in, data out (the engine seam): no
// clock, no OpenTUI; the shell feeds elapsed time + the user's live WPM each
// tick and colors the returned lanes.
//
// Every lane's position is the drill's elapsed fraction scaled by that racer's
// speed relative to the fastest racer in the field, so the field leader reaches
// the finish exactly when the timer runs out. Golden values in
// test/engine/race_progress.test.ts.

/** Pace-setter constants (WPM) — frank_type verbatim. */
export const SLOW_RACER_WPM = 60;
export const FAST_RACER_WPM = 140;

export type RacerId = "slow" | "you" | "fast";

/** One lane's live position: `progress` is a clamped 0–1 track fraction. */
export interface RacerProgress {
  readonly id: RacerId;
  readonly label: string;
  readonly wpm: number;
  readonly progress: number;
}

export interface RaceInput {
  /** Run-relative elapsed time in ms (session elapsedMs). */
  readonly elapsedMs: number;
  /** Selected drill length in seconds (the race's full distance). */
  readonly durationSeconds: number;
  /** The user's live WPM this tick (their pace-setter speed). */
  readonly userWpm: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(value, 1));
}

/**
 * Position of the three racers at `elapsedMs` into a `durationSeconds` drill:
 *
 *   elapsedRatio = clamp(elapsedMs / max(durationSeconds*1000, 1))
 *   progress_x   = clamp(elapsedRatio * (speed_x / max(slow, user, fast, 1)))
 *
 * The `max(..., 1)` denominators guard against a divide-by-zero when the
 * duration or the whole field is zero. Returned in fixed lane order
 * (slow, you, fast) so the strip renders consistently.
 */
export function raceProgress({
  elapsedMs,
  durationSeconds,
  userWpm,
}: RaceInput): RacerProgress[] {
  const elapsedRatio = clamp01(elapsedMs / Math.max(durationSeconds * 1000, 1));
  const fieldMax = Math.max(SLOW_RACER_WPM, userWpm, FAST_RACER_WPM, 1);
  const position = (wpm: number) => clamp01(elapsedRatio * (wpm / fieldMax));

  return [
    { id: "slow", label: "Slow", wpm: SLOW_RACER_WPM, progress: position(SLOW_RACER_WPM) },
    { id: "you", label: "You", wpm: userWpm, progress: position(userWpm) },
    { id: "fast", label: "Fast", wpm: FAST_RACER_WPM, progress: position(FAST_RACER_WPM) },
  ];
}
