import { raceProgress, type RaceInput, type RacerId } from "./race_progress";
import { span, type Row, type Span } from "./view_row";

// Pure view mapping for the live race strip: race progress (0–1 per lane) → a
// labeled track with the moving glyph in its lane role. Kept free of OpenTUI so
// the strip can be asserted below the seam; the shell supplies localized labels,
// track width, and paints. Updated by the shell on the ~100ms tick during a run.

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

/** Glyph role per lane: the user (correct) chases the fast marker (wrong), ahead
 *  of the slow one (pending). Replaces the shell's old raceGlyphColor map. */
const GLYPH_ROLE: Record<RacerId, "pending" | "correct" | "wrong"> = {
  slow: "pending",
  you: "correct",
  fast: "wrong",
};

/**
 * The race strip as Styled Rows — one labeled lane each, e.g. `Slow ●·····`. The
 * label + track fill are chrome; the moving glyph carries its lane role. `labels`
 * supplies the localized lane names and `labelWidth` aligns the track start
 * across locales. Replaces the old plain-text renderRaceStrip and the shell's
 * per-lane track re-slice.
 */
export function raceRows(
  input: RaceInput,
  trackWidth: number,
  labels: Record<RacerId, string>,
  labelWidth: number = LABEL_WIDTH,
): Row[] {
  return raceLanes(input, trackWidth).map((lane) => {
    const spans: Span[] = [span("chrome", `${labels[lane.id].padEnd(labelWidth)} `)];
    if (lane.glyphIndex > 0) spans.push(span("chrome", TRACK_FILL.repeat(lane.glyphIndex)));
    spans.push(span(GLYPH_ROLE[lane.id], lane.track[lane.glyphIndex]!));
    const trailing = lane.track.length - lane.glyphIndex - 1;
    if (trailing > 0) spans.push(span("chrome", TRACK_FILL.repeat(trailing)));
    return spans;
  });
}
