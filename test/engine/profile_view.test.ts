import { describe, expect, test } from "bun:test";
import { EMPTY_HISTORY_MESSAGE, formatProfile } from "../../src/engine/profile_view";
import { buildProfile } from "../../src/engine/profile";
import { stringsFor } from "../../src/engine/strings";
import type { StoredSession } from "../../src/storage/session_store";

// formatProfile composes the pure profile view-model into display lines: a title,
// a headline stat row per metric, and a braille trend chart under each. The shell
// paints these; the layout is asserted here without a TTY.

function session(finishedAt: string, wpm: number, accuracy: number): StoredSession {
  return { id: finishedAt, finishedAt, metrics: { wpm, accuracy } };
}

describe("formatProfile", () => {
  test("empty history shows a single guidance line, no charts", () => {
    const lines = formatProfile(buildProfile([]), 20, 3);
    expect(lines).toContain(EMPTY_HISTORY_MESSAGE);
    // No braille cells when there's nothing to plot.
    expect(lines.join("")).not.toMatch(/[⠀-⣿]/);
  });

  test("renders headline stats for WPM and accuracy", () => {
    const profile = buildProfile([
      session("2026-07-01T00:00:00Z", 40, 90),
      session("2026-07-02T00:00:00Z", 80, 96),
    ]);
    const text = formatProfile(profile, 24, 3).join("\n");
    expect(text).toContain("Profile");
    expect(text).toContain("Sessions");
    // wpm best 80 / avg 60 / recent 80
    expect(text).toMatch(/WPM.*best 80.*avg 60.*recent 80/s);
    // accuracy best 96 / avg 93 / recent 96, percent-suffixed
    expect(text).toMatch(/Accuracy.*best 96%.*avg 93%.*recent 96%/s);
  });

  test("localizes the title, stats, and empty message for pt-BR", () => {
    const pt = stringsFor("pt-BR").profile;
    expect(formatProfile(buildProfile([]), 20, 3, pt)).toContain(pt.empty);

    const profile = buildProfile([
      session("2026-07-01T00:00:00Z", 40, 90),
      session("2026-07-02T00:00:00Z", 80, 96),
    ]);
    const text = formatProfile(profile, 24, 3, pt).join("\n");
    expect(text).toContain("Perfil");
    expect(text).toContain("Sessões");
    expect(text).toMatch(/PPM.*melhor 80.*média 60.*recente 80/s);
    expect(text).not.toContain("Accuracy");
  });

  test("includes a braille chart of the requested height per metric", () => {
    const profile = buildProfile([
      session("2026-07-01T00:00:00Z", 40, 90),
      session("2026-07-02T00:00:00Z", 80, 96),
    ]);
    const lines = formatProfile(profile, 16, 2);
    const chartLines = lines.filter((line) => /[⠀-⣿]/.test(line));
    // Two charts (WPM + accuracy), each 2 rows tall.
    expect(chartLines).toHaveLength(4);
    for (const line of chartLines) expect([...line]).toHaveLength(16);
  });
});
