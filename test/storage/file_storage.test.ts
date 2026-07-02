import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { dataDir, FileStorage } from "../../src/storage/file_storage";
import { SessionStore, type StoredSession } from "../../src/storage/session_store";

// The impure edge: a few smokes proving the file adapter round-trips through
// SessionStore, writes atomically (no leftover temp file), and resolves the
// platform data directory. Uses a throwaway temp dir, never the real one.

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "tuiper-store-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

function run(id: string, finishedAt: string): StoredSession {
  return {
    id,
    finishedAt,
    durationSeconds: 30,
    elapsedMs: 30000,
    metrics: { wpm: 80, rawWpm: 82, accuracy: 98, mistakes: 1, typedCharacters: 250 },
  };
}

describe("FileStorage", () => {
  test("round-trips a saved run through SessionStore and the file", () => {
    const dir = tempDir();
    const store = new SessionStore(new FileStorage(dir));

    store.save(run("a", "2026-06-01T12:00:30.000Z"));
    const reloaded = new SessionStore(new FileStorage(dir)).all();

    expect(reloaded.map((s) => s.id)).toEqual(["a"]);
    expect(existsSync(join(dir, "sessions.json"))).toBe(true);
  });

  test("writes atomically — no temp file left behind, file is valid JSON", () => {
    const dir = tempDir();
    new SessionStore(new FileStorage(dir)).save(run("a", "2026-06-01T12:00:30.000Z"));

    expect(existsSync(join(dir, "sessions.json.tmp"))).toBe(false);
    const parsed = JSON.parse(readFileSync(join(dir, "sessions.json"), "utf8"));
    expect(Array.isArray(parsed)).toBe(true);
  });

  test("missing file reads as empty history", () => {
    const store = new SessionStore(new FileStorage(tempDir()));
    expect(store.all()).toEqual([]);
  });

  test("clear() removes the file", () => {
    const dir = tempDir();
    const store = new SessionStore(new FileStorage(dir));
    store.save(run("a", "2026-06-01T12:00:30.000Z"));
    store.clear();
    expect(existsSync(join(dir, "sessions.json"))).toBe(false);
  });

  test("dataDir resolves per platform", () => {
    if (process.platform === "win32") {
      expect(dataDir({ APPDATA: "C:\\Users\\x\\AppData\\Roaming" } as NodeJS.ProcessEnv)).toBe(
        join("C:\\Users\\x\\AppData\\Roaming", "tuiper"),
      );
    } else {
      expect(dataDir({ XDG_DATA_HOME: "/data" } as NodeJS.ProcessEnv)).toBe(
        join("/data", "tuiper"),
      );
    }
  });
});
