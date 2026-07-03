import { raceProgress, type RaceInput, type RacerId } from "./race_progress";

// Pure view mapping for the live race strip: race progress (0–1 per lane) → a
// glyph column on a fixed-width track. Kept free of OpenTUI so the strip can be
// asserted on plain strings; the shell owns coloring (a distinct glyph color per
// lane) and positioning. Updated by the shell on the ~100ms tick during a run.

/** The moving racer marker and the empty-track fill. */
export const TRACK_GLYPH = "●";
export const TRACK_FILL = "·";

/** Label column width — the longest lane label ("Slow"/"Fast") plus a space. */
export const LABEL_WIDTH = 4;

/** One rendered lane: the racer's glyph column on its fixed-width track. */
export interface RaceLane {
  readonly id: RacerId;
  readonly label: string;
  readonly wpm: number;
  readonly progress: number;
  /** Column (0-based) of the glyph within `track`. */
  readonly glyphIndex: number;
  /** The full track string, fill everywhere but a single glyph. */
  readonly track: string;
}

/** Column of the glyph for a 0–1 `progress` on a `trackWidth`-cell track. */
export function glyphColumn(progress: number, trackWidth: number): number {
  const width = Math.max(1, Math.floor(trackWidth));
  if (width <= 1) return 0;
  const clamped = Math.max(0, Math.min(progress, 1));
  return Math.round(clamped * (width - 1));
}

/** The three race lanes laid out on a `trackWidth`-cell track. */
export function raceLanes(input: RaceInput, trackWidth: number): RaceLane[] {
  const width = Math.max(1, Math.floor(trackWidth));
  return raceProgress(input).map((racer) => {
    const glyphIndex = glyphColumn(racer.progress, width);
    const cells = TRACK_FILL.repeat(width).split("");
    cells[glyphIndex] = TRACK_GLYPH;
    return {
      id: racer.id,
      label: racer.label,
      wpm: racer.wpm,
      progress: racer.progress,
      glyphIndex,
      track: cells.join(""),
    };
  });
}

/**
 * The race strip as plain text lines — one labeled lane each, e.g.
 * `Slow ●·····`. The shell renders a colored version from `raceLanes`; this is
 * the text-snapshot / simple-shell path.
 */
export function renderRaceStrip(input: RaceInput, trackWidth: number): string[] {
  return raceLanes(input, trackWidth).map(
    (lane) => `${lane.label.padEnd(LABEL_WIDTH)} ${lane.track}`,
  );
}
