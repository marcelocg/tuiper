// Local session history + compaction — a 1:1 port of frank_type's
// app/javascript/lib/storage/session_store.js, with one substitution: the
// browser's `window.localStorage` becomes an injected read/write-JSON port
// (StoragePort) so the logic stays pure and testable. The schema and every
// compaction number are reproduced byte-for-byte (see the golden test).
//
// Schema `frank_type.sessions.v1`: keep 30 full sessions + 90 daily summaries,
// max 120 total. Daily summaries are keyed `summary-YYYY-MM-DD` with
// sampleCount-weighted averages for wpm/rawWpm/accuracy and summed
// mistakes/typedCharacters.

const FULL_SESSION_LIMIT = 30;
const DAILY_SUMMARY_LIMIT = 90;
const MAX_RECORDS = FULL_SESSION_LIMIT + DAILY_SUMMARY_LIMIT;

/** Metrics slice the store reads (extra fields are carried through untouched). */
export interface StoredMetrics {
  readonly wpm?: number;
  readonly rawWpm?: number;
  readonly accuracy?: number;
  readonly mistakes?: number;
  readonly typedCharacters?: number;
  readonly [key: string]: unknown;
}

/**
 * A persisted session record — either a full run or a daily summary. The store
 * touches only the fields below; anything else (keyEvents, characterTimings,
 * digraphTimings, …) rides along on full records and is dropped from summaries.
 */
export interface StoredSession {
  readonly id?: string;
  readonly summary?: boolean;
  readonly sampleCount?: number;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly durationSeconds?: number;
  readonly elapsedMs?: number;
  readonly metrics?: StoredMetrics;
  readonly [key: string]: unknown;
}

/**
 * The injected persistence seam. `read` returns the parsed JSON payload (any
 * shape — the store guards it), `write` replaces it, `remove` clears it. The
 * real app injects a file adapter; tests inject an in-memory fake.
 */
export interface StoragePort {
  read(): unknown;
  write(sessions: readonly StoredSession[]): void;
  remove(): void;
}

export class SessionStore {
  constructor(private readonly port: StoragePort) {}

  all(): StoredSession[] {
    const sessions = compactSessions(this.readRaw());
    this.persistCompaction(sessions);
    return sessions;
  }

  save(session: StoredSession): StoredSession[] {
    const sessions = compactSessions([session, ...this.readRaw()]);

    try {
      this.port.write(sessions);
    } catch (_error) {
      return sessions;
    }

    return sessions;
  }

  clear(): void {
    try {
      this.port.remove();
    } catch (_error) {
      // Storage can be unavailable in hardened/read-only contexts.
    }
  }

  private readRaw(): StoredSession[] {
    try {
      const sessions = this.port.read();
      return Array.isArray(sessions) ? (sessions as StoredSession[]) : [];
    } catch (_error) {
      return [];
    }
  }

  private persistCompaction(compacted: readonly StoredSession[]): void {
    const raw = this.readRaw();
    if (JSON.stringify(raw) === JSON.stringify(compacted)) return;

    try {
      this.port.write(compacted);
    } catch (_error) {
      // Reading history should still work when storage is full or unavailable.
    }
  }
}

/** Sort newest-first, keep 30 full records, summarize the rest by day. Pure. */
export function compactSessions(sessions: readonly StoredSession[]): StoredSession[] {
  const sortedSessions = sessions
    .filter((session): session is StoredSession => Boolean(session) && typeof session === "object")
    .sort((left, right) => timestamp(right.finishedAt) - timestamp(left.finishedAt));

  const detailedSessions = sortedSessions.slice(0, FULL_SESSION_LIMIT);
  const dailySummaries = summarizeByDay(sortedSessions.slice(FULL_SESSION_LIMIT)).slice(
    0,
    DAILY_SUMMARY_LIMIT,
  );

  return [...detailedSessions, ...dailySummaries].slice(0, MAX_RECORDS);
}

function summarizeByDay(sessions: readonly StoredSession[]): StoredSession[] {
  const groups = new Map<string, StoredSession[]>();

  sessions.forEach((session) => {
    const day = dayKey(session.finishedAt);
    if (!day) return;

    const group = groups.get(day);
    if (group) group.push(session);
    else groups.set(day, [session]);
  });

  return [...groups.entries()]
    .map(([day, daySessions]) => dailySummary(day, daySessions))
    .sort((left, right) => timestamp(right.finishedAt) - timestamp(left.finishedAt));
}

function dailySummary(day: string, sessions: readonly StoredSession[]): StoredSession {
  const sampleCount = sessions.reduce((sum, session) => sum + sessionWeight(session), 0);

  return {
    id: `summary-${day}`,
    summary: true,
    sampleCount,
    title: "Daily summary",
    author: "Frank Type",
    source: "Local history",
    startedAt: `${day}T00:00:00.000Z`,
    finishedAt: latestFinishedAt(sessions),
    durationSeconds: weightedAverage(sessions, (session) => Number(session.durationSeconds)),
    elapsedMs: weightedAverage(sessions, (session) => Number(session.elapsedMs)),
    metrics: {
      wpm: weightedAverage(sessions, (session) => Number(session.metrics?.wpm)),
      rawWpm: weightedAverage(sessions, (session) => Number(session.metrics?.rawWpm)),
      accuracy: weightedAverage(sessions, (session) => Number(session.metrics?.accuracy)),
      mistakes: sessions.reduce(
        (sum, session) => sum + (Number(session.metrics?.mistakes) || 0),
        0,
      ),
      typedCharacters: sessions.reduce(
        (sum, session) => sum + (Number(session.metrics?.typedCharacters) || 0),
        0,
      ),
    },
  };
}

function weightedAverage(
  sessions: readonly StoredSession[],
  valueFor: (session: StoredSession) => number,
): number {
  const totals = sessions.reduce(
    (result: { sum: number; weight: number }, session) => {
      const value = valueFor(session);
      if (!Number.isFinite(value)) return result;

      const weight = sessionWeight(session);
      result.sum += value * weight;
      result.weight += weight;
      return result;
    },
    { sum: 0, weight: 0 },
  );

  return totals.weight === 0 ? 0 : Math.round(totals.sum / totals.weight);
}

function latestFinishedAt(sessions: readonly StoredSession[]): string | undefined {
  return sessions.reduce<string | undefined>(
    (latest, session) =>
      timestamp(session.finishedAt) > timestamp(latest) ? session.finishedAt : latest,
    sessions[0]?.finishedAt,
  );
}

function dayKey(value: string | undefined): string | null {
  const date = new Date(value ?? NaN);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
}

function timestamp(value: string | undefined): number {
  const date = new Date(value ?? NaN);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function sessionWeight(session: StoredSession | undefined): number {
  return Math.max(1, Number(session?.sampleCount) || 1);
}
