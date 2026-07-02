import { describe, expect, test } from "bun:test";
import {
  SessionStore,
  compactSessions,
  type StoragePort,
  type StoredSession,
} from "../../src/storage/session_store";

// Golden-value port of frank_type's session_store.test.mjs. localStorage (a
// string key/value store) is replaced by tuiper's injected read/write-JSON
// port; the compaction numbers must match frank_type byte-for-byte.

/** In-memory fake of the storage port — the test double the PRD calls for. */
function fakePort(initial?: unknown): StoragePort & { current(): unknown } {
  let value = initial;
  return {
    read: () => value,
    write: (sessions) => {
      value = sessions;
    },
    remove: () => {
      value = undefined;
    },
    current: () => value,
  };
}

function session({ id, day, wpm }: { id: string; day: number; wpm: number }): StoredSession {
  const date = new Date(Date.UTC(2026, 5, day, 12, 0, 0));
  const finishedAt = new Date(date.getTime() + 30000);

  return {
    id,
    title: "The War of the Worlds",
    author: "H. G. Wells",
    source: "Project Gutenberg",
    startedAt: date.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationSeconds: 30,
    elapsedMs: 30000,
    metrics: {
      wpm,
      rawWpm: wpm,
      accuracy: 98,
      mistakes: 1,
      typedCharacters: 250,
    },
    keyEvents: [{ action: "type" }],
    characterTimings: [{ index: 0, elapsedMs: 100 }],
    wordTimings: [{ word: "the", durationMs: 200 }],
    digraphTimings: [{ displayPair: "th", latencyMs: 120 }],
  } as StoredSession;
}

describe("SessionStore", () => {
  test("keeps recent sessions detailed and compacts older runs by day", () => {
    const recentSessions = Array.from({ length: 29 }, (_v, index) =>
      session({ id: `recent-${index}`, day: 30 - index, wpm: 90 }),
    );
    const olderSessions = Array.from({ length: 6 }, (_v, index) =>
      session({ id: `older-${index}`, day: 1, wpm: 60 + index }),
    );
    const store = new SessionStore(fakePort([...recentSessions, ...olderSessions]));

    const sessions = store.save(session({ id: "new", day: 31, wpm: 120 }));
    const summary = sessions.at(-1)!;

    expect(sessions.length).toBe(31);
    expect(sessions[0]!.id).toBe("new");
    expect(sessions[0]!.keyEvents).toEqual([{ action: "type" }]);
    expect(summary.summary).toBe(true);
    expect(summary.sampleCount).toBe(6);
    expect(summary.metrics!.wpm).toBe(63);
    expect(summary.title).toBe("Daily summary");
    // Heavy per-keystroke fields are dropped from summaries.
    expect(summary.keyEvents).toBeUndefined();
    expect(summary.characterTimings).toBeUndefined();
    expect(summary.wordTimings).toBeUndefined();
    expect(summary.digraphTimings).toBeUndefined();
  });

  test("all() rewrites legacy oversized storage with compact summaries", () => {
    const sessions = Array.from({ length: 35 }, (_v, index) =>
      session({ id: `session-${index}`, day: index < 30 ? 35 - index : 1, wpm: 80 }),
    );
    const port = fakePort(sessions);
    const store = new SessionStore(port);

    const compacted = store.all();
    const stored = port.current() as StoredSession[];

    expect(compacted.length).toBe(31);
    expect(stored.length).toBe(31);
    expect(stored.at(-1)!.summary).toBe(true);
    expect(stored.at(-1)!.sampleCount).toBe(5);
  });

  test("limits retained daily summaries to 90 (120 total)", () => {
    const oldSessions = Array.from({ length: 130 }, (_v, index) =>
      session({ id: `old-${index}`, day: index + 1, wpm: 70 }),
    );

    const compacted = compactSessions(oldSessions);

    expect(compacted.length).toBe(120);
    expect(compacted.filter((s) => s.summary).length).toBe(90);
  });

  test("a finished run is appended to the front and compaction applied", () => {
    const store = new SessionStore(fakePort([]));
    const first = store.save(session({ id: "a", day: 1, wpm: 50 }));
    expect(first.map((s) => s.id)).toEqual(["a"]);

    const second = store.save(session({ id: "b", day: 2, wpm: 80 }));
    // Newest first (sorted by finishedAt descending).
    expect(second.map((s) => s.id)).toEqual(["b", "a"]);
  });

  test("clear() empties storage", () => {
    const port = fakePort([session({ id: "a", day: 1, wpm: 50 })]);
    const store = new SessionStore(port);
    store.clear();
    expect(port.current()).toBeUndefined();
    expect(store.all()).toEqual([]);
  });

  test("tolerates a non-array / corrupt port payload", () => {
    const store = new SessionStore(fakePort("not an array"));
    expect(store.all()).toEqual([]);
  });
});
