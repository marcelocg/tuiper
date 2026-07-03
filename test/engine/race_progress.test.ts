import { describe, expect, test } from "bun:test";
import {
  FAST_RACER_WPM,
  SLOW_RACER_WPM,
  raceProgress,
} from "../../src/engine/race_progress";

// Golden-value port of frank_type's race_progress: three pace-setters advance by
//   elapsedRatio = clamp(elapsedMs / max(durationSeconds*1000, 1))
//   progress_x   = clamp(elapsedRatio * (speed_x / max(slow, user, fast, 1)))
// The fast lane (top speed when the user is slower than 140) always finishes at
// exactly the drill's end.

const lane = (racers: ReturnType<typeof raceProgress>, id: string) =>
  racers.find((r) => r.id === id)!;

describe("raceProgress", () => {
  test("pace-setter constants are 60 and 140 WPM", () => {
    expect(SLOW_RACER_WPM).toBe(60);
    expect(FAST_RACER_WPM).toBe(140);
    const racers = raceProgress({ elapsedMs: 0, durationSeconds: 30, userWpm: 0 });
    expect(racers.map((r) => r.id)).toEqual(["slow", "you", "fast"]);
    expect(lane(racers, "slow").wpm).toBe(60);
    expect(lane(racers, "fast").wpm).toBe(140);
  });

  test("all lanes sit at the start line at elapsed 0", () => {
    const racers = raceProgress({ elapsedMs: 0, durationSeconds: 30, userWpm: 100 });
    for (const r of racers) expect(r.progress).toBe(0);
  });

  test("mid-run: progress scales by speed over the field max (user < fast)", () => {
    // elapsedRatio = 15000/30000 = 0.5; denom = max(60,100,140,1) = 140.
    const racers = raceProgress({ elapsedMs: 15000, durationSeconds: 30, userWpm: 100 });
    expect(lane(racers, "slow").progress).toBeCloseTo(0.5 * (60 / 140), 10);
    expect(lane(racers, "you").progress).toBeCloseTo(0.5 * (100 / 140), 10);
    expect(lane(racers, "fast").progress).toBeCloseTo(0.5, 10);
  });

  test("fast lane reaches the finish exactly at duration when user is slower", () => {
    const racers = raceProgress({ elapsedMs: 30000, durationSeconds: 30, userWpm: 90 });
    expect(lane(racers, "fast").progress).toBeCloseTo(1, 10);
    expect(lane(racers, "slow").progress).toBeCloseTo(60 / 140, 10);
    expect(lane(racers, "you").progress).toBeCloseTo(90 / 140, 10);
  });

  test("a user faster than 140 becomes the field max: user finishes first", () => {
    // denom = max(60,200,140,1) = 200.
    const racers = raceProgress({ elapsedMs: 30000, durationSeconds: 30, userWpm: 200 });
    expect(lane(racers, "you").progress).toBeCloseTo(1, 10);
    expect(lane(racers, "fast").progress).toBeCloseTo(140 / 200, 10);
    expect(lane(racers, "slow").progress).toBeCloseTo(60 / 200, 10);
  });

  test("elapsed past the duration clamps the ratio (and progress) at 1", () => {
    const racers = raceProgress({ elapsedMs: 99000, durationSeconds: 30, userWpm: 80 });
    expect(lane(racers, "fast").progress).toBe(1);
    expect(lane(racers, "you").progress).toBeCloseTo(80 / 140, 10);
  });

  test("zero user WPM leaves the user marker at the start line", () => {
    const racers = raceProgress({ elapsedMs: 15000, durationSeconds: 30, userWpm: 0 });
    expect(lane(racers, "you").progress).toBe(0);
    expect(lane(racers, "slow").progress).toBeGreaterThan(0);
  });

  test("guards a zero/negative duration against divide-by-zero", () => {
    const racers = raceProgress({ elapsedMs: 500, durationSeconds: 0, userWpm: 100 });
    // max(durationSeconds*1000, 1) = 1 → ratio clamps to 1.
    expect(lane(racers, "fast").progress).toBe(1);
  });

  test("negative elapsed clamps to the start line", () => {
    const racers = raceProgress({ elapsedMs: -100, durationSeconds: 30, userWpm: 100 });
    for (const r of racers) expect(r.progress).toBe(0);
  });
});
