import { describe, expect, test } from "bun:test";
import { EMPTY_HISTORY_MESSAGE, formatProfile } from "../../src/engine/profile_view";
import { buildProfile } from "../../src/engine/profile";
import { stringsFor } from "../../src/engine/strings";
import { rowsText } from "../../src/engine/view_row";
import type { StoredSession } from "../../src/storage/session_store";
import type { Row } from "../../src/engine/view_row";

/** Braille chart rows carry the `correct` (trend) role; all text is chrome. */
function isChart(row: Row): boolean {
  return row.length > 0 && row.every((s) => "role" in s && s.role === "correct");
}

// formatProfile composes the pure profile view-model into display lines: a title,
// a headline stat row per metric, and a braille trend chart under each. The shell
// paints these; the layout is asserted here without a TTY.

function session(finishedAt: string, wpm: number, accuracy: number): StoredSession {
  return { id: finishedAt, finishedAt, metrics: { wpm, accuracy } };
}

describe("formatProfile", () => {
  test("empty history shows a single guidance line, no charts", () => {
    const lines = rowsText(formatProfile(buildProfile([]), 20, 3));
    expect(lines).toContain(EMPTY_HISTORY_MESSAGE);
    // No braille cells when there's nothing to plot.
    expect(lines.join("")).not.toMatch(/[⠀-⣿]/);
  });

  test("renders headline stats for WPM and accuracy", () => {
    const profile = buildProfile([
      session("2026-07-01T00:00:00Z", 40, 90),
      session("2026-07-02T00:00:00Z", 80, 96),
    ]);
    const text = rowsText(formatProfile(profile, 24, 3)).join("\n");
    expect(text).toContain("Profile");
    expect(text).toContain("Sessions");
    // wpm best 80 / avg 60 / recent 80
    expect(text).toMatch(/WPM.*best 80.*avg 60.*recent 80/s);
    // accuracy best 96 / avg 93 / recent 96, percent-suffixed
    expect(text).toMatch(/Accuracy.*best 96%.*avg 93%.*recent 96%/s);
  });

  test("localizes the title, stats, and empty message for pt-BR", () => {
    const pt = stringsFor("pt-BR").profile;
    expect(rowsText(formatProfile(buildProfile([]), 20, 3, pt))).toContain(pt.empty);

    const profile = buildProfile([
      session("2026-07-01T00:00:00Z", 40, 90),
      session("2026-07-02T00:00:00Z", 80, 96),
    ]);
    const text = rowsText(formatProfile(profile, 24, 3, pt)).join("\n");
    expect(text).toContain("Perfil");
    expect(text).toContain("Sessões");
    expect(text).toMatch(/PPM.*melhor 80.*média 60.*recente 80/s);
    expect(text).not.toContain("Accuracy");
  });

  test("braille chart rows carry the correct role at the requested height", () => {
    const profile = buildProfile([
      session("2026-07-01T00:00:00Z", 40, 90),
      session("2026-07-02T00:00:00Z", 80, 96),
    ]);
    const rows = formatProfile(profile, 16, 2);
    const chartRows = rows.filter(isChart);
    // Two charts (WPM + accuracy), each 2 rows tall.
    expect(chartRows).toHaveLength(4);
    for (const row of chartRows) {
      expect(row).toHaveLength(1);
      expect([...rowsText([row])[0]!]).toHaveLength(16);
      expect(rowsText([row])[0]!).toMatch(/[⠀-⣿]/);
    }
  });
});
