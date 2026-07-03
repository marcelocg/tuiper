// Pure view mapping for the profile screen: a Profile view-model → display
// lines. A title, a headline stat row (best / avg / recent) per metric, and a
// braille trend chart beneath each. The shell paints these lines; keeping the
// layout pure lets the screen be snapshot-asserted without a TTY.

import { brailleChart } from "./braille_chart";
import type { Profile, TrendStat } from "./profile";
import { stringsFor, type ProfileStrings } from "./strings";

/** Shown when there is no history yet to chart (English default). */
export const EMPTY_HISTORY_MESSAGE = stringsFor("en").profile.empty;

const LABEL_WIDTH = 10;

/**
 * The profile screen as text lines: header + WPM block + accuracy block. Charts
 * are drawn `chartWidth` cells wide and `chartHeight` rows tall. With no history
 * only the title and a guidance line are returned (no empty charts). Labels come
 * from the injected locale table (defaults to English).
 */
export function formatProfile(
  profile: Profile,
  chartWidth: number,
  chartHeight: number,
  strings: ProfileStrings = stringsFor("en").profile,
): string[] {
  if (profile.sessionCount === 0) {
    return [strings.title, "", strings.empty];
  }

  return [
    strings.title,
    `${strings.sessions.padEnd(LABEL_WIDTH)}${profile.sessionCount}`,
    "",
    ...metricBlock(strings.wpm, profile.wpm, profile.wpmSeries, "", chartWidth, chartHeight, strings),
    "",
    ...metricBlock(strings.accuracy, profile.accuracy, profile.accuracySeries, "%", chartWidth, chartHeight, strings),
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
  strings: ProfileStrings,
): string[] {
  const headline =
    `${label.padEnd(LABEL_WIDTH)}` +
    `${strings.best} ${stat.best}${suffix} · ${strings.avg} ${stat.average}${suffix} · ` +
    `${strings.recent} ${stat.recent}${suffix}`;
  return [headline, ...brailleChart(series, chartWidth, chartHeight)];
}
