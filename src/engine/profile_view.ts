// Pure view mapping for the profile screen: a Profile view-model → display
// lines. A title, a headline stat row (best / avg / recent) per metric, and a
// braille trend chart beneath each. The shell paints these lines; keeping the
// layout pure lets the screen be snapshot-asserted without a TTY.

import { brailleChart } from "./braille_chart";
import type { Profile, TrendStat } from "./profile";
import { stringsFor, type ProfileStrings } from "./strings";
import { span, type Row } from "./view_row";

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
): Row[] {
  if (profile.sessionCount === 0) {
    return [[span("chrome", strings.title)], [], [span("chrome", strings.empty)]];
  }

  return [
    [span("chrome", strings.title)],
    [span("chrome", `${strings.sessions.padEnd(LABEL_WIDTH)}${profile.sessionCount}`)],
    [],
    ...metricBlock(strings.wpm, profile.wpm, profile.wpmSeries, "", chartWidth, chartHeight, strings),
    [],
    ...metricBlock(strings.accuracy, profile.accuracy, profile.accuracySeries, "%", chartWidth, chartHeight, strings),
  ];
}

/** One metric's stat row (chrome) followed by its braille trend chart (correct,
 *  the trend color). The role replaces the shell's old braille-glyph regex. */
function metricBlock(
  label: string,
  stat: TrendStat,
  series: readonly number[],
  suffix: string,
  chartWidth: number,
  chartHeight: number,
  strings: ProfileStrings,
): Row[] {
  const headline =
    `${label.padEnd(LABEL_WIDTH)}` +
    `${strings.best} ${stat.best}${suffix} · ${strings.avg} ${stat.average}${suffix} · ` +
    `${strings.recent} ${stat.recent}${suffix}`;
  return [
    [span("chrome", headline)],
    ...brailleChart(series, chartWidth, chartHeight).map((line) => [span("correct", line)]),
  ];
}
