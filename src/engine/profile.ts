// Pure profile view-model: stored history → trend series + headline stats. Reads
// the same records the store returns (full runs *and* daily summaries, newest-
// first) and turns them into chronological series (oldest→newest, the direction
// the braille charts read) plus best/average/recent numbers per metric. No fs,
// no OpenTUI — sessions in, view-model out, golden-tested.

import type { StoredSession } from "../storage/session_store";

/** Headline numbers for one metric across all history. */
export interface TrendStat {
  /** The best (maximum) value achieved. */
  readonly best: number;
  /** The rounded mean across all sessions. */
  readonly average: number;
  /** The most recent (newest) value. */
  readonly recent: number;
}

export interface Profile {
  /** Sessions with a valid timestamp (full runs + daily summaries). */
  readonly sessionCount: number;
  readonly wpm: TrendStat;
  readonly accuracy: TrendStat;
  /** WPM per session, oldest→newest (chart reads left to right). */
  readonly wpmSeries: number[];
  /** Accuracy per session, oldest→newest. */
  readonly accuracySeries: number[];
}

export function buildProfile(sessions: readonly StoredSession[]): Profile {
  const chronological = [...sessions]
    .filter((session): session is StoredSession => Boolean(session) && typeof session === "object")
    .sort((left, right) => timestamp(left.finishedAt) - timestamp(right.finishedAt));

  const wpmSeries = seriesOf(chronological, (session) => Number(session.metrics?.wpm));
  const accuracySeries = seriesOf(chronological, (session) => Number(session.metrics?.accuracy));

  return {
    sessionCount: chronological.length,
    wpm: statOf(wpmSeries),
    accuracy: statOf(accuracySeries),
    wpmSeries,
    accuracySeries,
  };
}

/** The finite values of one metric across chronological sessions. */
function seriesOf(
  sessions: readonly StoredSession[],
  valueFor: (session: StoredSession) => number,
): number[] {
  return sessions.map(valueFor).filter((value) => Number.isFinite(value));
}

/** best / average / recent for a chronological (oldest→newest) series. */
function statOf(series: readonly number[]): TrendStat {
  if (series.length === 0) return { best: 0, average: 0, recent: 0 };
  const sum = series.reduce((total, value) => total + value, 0);
  return {
    best: Math.max(...series),
    average: Math.round(sum / series.length),
    recent: series[series.length - 1]!,
  };
}

function timestamp(value: string | undefined): number {
  const date = new Date(value ?? NaN);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
