import { describe, expect, test } from "bun:test";
import {
  TRACK_FILL,
  TRACK_GLYPH,
  glyphColumn,
  raceLanes,
  raceRows,
} from "../../src/engine/race_view";
import { rowsText } from "../../src/engine/view_row";
import { calculateMetrics } from "../../src/engine/metrics";

const LABELS = { slow: "Slow", you: "You", fast: "Fast" } as const;
import {
  correctCharacters,
  createSession,
  elapsedMs,
  typeChar,
} from "../../src/engine/session_state";

// The race strip is a pure view mapping: race progress (0–1 per lane) → a glyph
// column on a fixed-width track. The shell colors each lane's glyph; this layer
// stays free of OpenTUI so the strip can be asserted as plain text.

describe("glyphColumn", () => {
  test("maps 0 → first column and 1 → last column", () => {
    expect(glyphColumn(0, 10)).toBe(0);
    expect(glyphColumn(1, 10)).toBe(9);
  });

  test("rounds to the nearest track cell", () => {
    expect(glyphColumn(0.5, 11)).toBe(5); // 0.5 * 10 = 5
    expect(glyphColumn(0.44, 11)).toBe(4); // 0.44 * 10 = 4.4 → 4
    expect(glyphColumn(0.46, 11)).toBe(5); // 0.46 * 10 = 4.6 → 5
  });

  test("clamps out-of-range progress into the track", () => {
    expect(glyphColumn(-1, 10)).toBe(0);
    expect(glyphColumn(2, 10)).toBe(9);
  });

  test("degenerate widths stay in bounds", () => {
    expect(glyphColumn(0.5, 1)).toBe(0);
    expect(glyphColumn(0.5, 0)).toBe(0);
  });
});

describe("raceLanes", () => {
  test("three lanes in fixed order, each a full-width track", () => {
    const lanes = raceLanes({ elapsedMs: 0, durationSeconds: 30, userWpm: 100 }, 8);
    expect(lanes.map((l) => l.id)).toEqual(["slow", "you", "fast"]);
    for (const l of lanes) {
      expect(l.track.length).toBe(8);
      expect(l.track[l.glyphIndex]).toBe(TRACK_GLYPH);
      // Exactly one glyph; the rest is fill.
      expect(l.track.split("").filter((c) => c === TRACK_GLYPH).length).toBe(1);
      expect(l.track.replaceAll(TRACK_GLYPH, TRACK_FILL)).toBe(TRACK_FILL.repeat(8));
    }
  });

  test("faster racers sit further along the track", () => {
    const lanes = raceLanes({ elapsedMs: 15000, durationSeconds: 30, userWpm: 100 }, 20);
    const at = (id: string) => lanes.find((l) => l.id === id)!.glyphIndex;
    expect(at("slow")).toBeLessThan(at("you"));
    expect(at("you")).toBeLessThan(at("fast"));
  });
});

describe("raceRows", () => {
  test("one labeled row per lane, glyph at the mapped column", () => {
    const rows = raceRows({ elapsedMs: 0, durationSeconds: 30, userWpm: 0 }, 6, LABELS);
    expect(rowsText(rows)).toEqual([
      `Slow ${TRACK_GLYPH}${TRACK_FILL.repeat(5)}`,
      `You  ${TRACK_GLYPH}${TRACK_FILL.repeat(5)}`,
      `Fast ${TRACK_GLYPH}${TRACK_FILL.repeat(5)}`,
    ]);
  });

  test("the moving glyph carries its lane role (slow/you/fast → pending/correct/wrong)", () => {
    const rows = raceRows({ elapsedMs: 0, durationSeconds: 30, userWpm: 0 }, 6, LABELS);
    const glyphRole = (row: (typeof rows)[number]) =>
      row.find((s) => "role" in s && (s.text === TRACK_GLYPH));
    expect(glyphRole(rows[0]!)).toMatchObject({ role: "pending" });
    expect(glyphRole(rows[1]!)).toMatchObject({ role: "correct" });
    expect(glyphRole(rows[2]!)).toMatchObject({ role: "wrong" });
  });

  test("the fast lane reaches the far end at the end of the drill", () => {
    const lines = rowsText(raceRows({ elapsedMs: 30000, durationSeconds: 30, userWpm: 80 }, 10, LABELS));
    expect(lines[2]!.endsWith(TRACK_GLYPH)).toBe(true); // Fast finished
  });
});

describe("race strip driven from a live session (the shell's path)", () => {
  // Mirror the shell: user WPM comes from the same metrics the results panel
  // uses, elapsed time from the session clock. The glyph must advance tick over
  // tick as the run progresses.
  const laneAt = (state: ReturnType<typeof createSession>, now: number) => {
    const userWpm = calculateMetrics({
      typedEvents: state.events,
      correctCharacters: correctCharacters(state),
      elapsedMs: elapsedMs(state, now),
      targetText: state.target,
    }).wpm;
    return raceLanes(
      { elapsedMs: elapsedMs(state, now), durationSeconds: state.durationSeconds, userWpm },
      40,
    );
  };

  test("the fast marker advances as the run's elapsed time grows", () => {
    // First keystroke starts the clock at t=0; sample the strip at 3s and 9s.
    const state = typeChar(createSession("the quick brown fox", 30), "t", 0);
    const fastAt3s = laneAt(state, 3000).find((l) => l.id === "fast")!.glyphIndex;
    const fastAt9s = laneAt(state, 9000).find((l) => l.id === "fast")!.glyphIndex;
    expect(fastAt9s).toBeGreaterThan(fastAt3s);
  });
});
