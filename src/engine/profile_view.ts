// Pure view mapping for the profile screen: a Profile view-model → display
// lines. A title, a headline stat row (best / avg / recent) per metric, and a
// braille trend chart beneath each. The shell paints these lines; keeping the
// layout pure lets the screen be snapshot-asserted without a TTY.

import { brailleChart } from "./braille_chart";
import type { Profile, TrendStat } from "./profile";

/** Shown when there is no history yet to chart. */
export const EMPTY_HISTORY_MESSAGE = "No sessions yet — finish a run to see your trends.";

const LABEL_WIDTH = 10;

/**
 * The profile screen as text lines: header + WPM block + accuracy block. Charts
 * are drawn `chartWidth` cells wide and `chartHeight` rows tall. With no history
 * only the title and a guidance line are returned (no empty charts).
 */
export function formatProfile(
  profile: Profile,
  chartWidth: number,
  chartHeight: number,
): string[] {
  if (profile.sessionCount === 0) {
    return ["Profile", "", EMPTY_HISTORY_MESSAGE];
  }

  return [
    "Profile",
    `${"Sessions".padEnd(LABEL_WIDTH)}${profile.sessionCount}`,
    "",
    ...metricBlock("WPM", profile.wpm, profile.wpmSeries, "", chartWidth, chartHeight),
    "",
    ...metricBlock("Accuracy", profile.accuracy, profile.accuracySeries, "%", chartWidth, chartHeight),
  ];
}

/** One metric's stat row followed by its braille trend chart. */
function metricBlock(
  label: string,
  stat: TrendStat,
  series: readonly number[],
  suffix: string,
  chartWidth: number,
  chartHeight: number,
): string[] {
  const headline =
    `${label.padEnd(LABEL_WIDTH)}` +
    `best ${stat.best}${suffix} · avg ${stat.average}${suffix} · recent ${stat.recent}${suffix}`;
  return [headline, ...brailleChart(series, chartWidth, chartHeight)];
}
