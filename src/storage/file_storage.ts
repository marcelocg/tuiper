// The real StoragePort adapter: persists history to `sessions.json` in the
// cross-platform data directory, with atomic writes (temp file + rename) so a
// crash mid-write can't corrupt existing history. This is the impure edge that
// the app injects into SessionStore; tests use an in-memory fake instead.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { StoragePort, StoredSession } from "./session_store";

/**
 * Data directory per platform:
 *   Windows        → `%APPDATA%\tuiper`
 *   Linux / macOS  → `$XDG_DATA_HOME/tuiper` (default `~/.local/share/tuiper`)
 */
export function dataDir(env: NodeJS.ProcessEnv = process.env): string {
  if (process.platform === "win32") {
    const appData = env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appData, "tuiper");
  }

  const xdg = env.XDG_DATA_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".local", "share");
  return join(base, "tuiper");
}

/** A file-backed StoragePort. `dir` defaults to the platform data directory. */
export class FileStorage implements StoragePort {
  private readonly filePath: string;

  constructor(private readonly dir: string = dataDir(), fileName = "sessions.json") {
    this.filePath = join(dir, fileName);
  }

  read(): unknown {
    if (!existsSync(this.filePath)) return undefined;
    return JSON.parse(readFileSync(this.filePath, "utf8"));
  }

  write(sessions: readonly StoredSession[]): void {
    mkdirSync(this.dir, { recursive: true });

    // Write to a sibling temp file, then rename over the target. rename is
    // atomic on the same filesystem, so readers never see a half-written file.
    const tempPath = `${this.filePath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(sessions), "utf8");
    renameSync(tempPath, this.filePath);
  }

  remove(): void {
    rmSync(this.filePath, { force: true });
  }
}
