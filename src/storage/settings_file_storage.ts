// The real SettingsPort adapter: persists preferences to `settings.json` in the
// cross-platform data directory (see `dataDir`), with atomic writes (temp file +
// rename) so a crash mid-write can't corrupt existing settings. The in-memory
// fake stands in for this in tests.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { dataDir } from "./file_storage";
import type { SettingsPort } from "./settings_store";

/** A file-backed SettingsPort. `dir` defaults to the platform data directory. */
export class FileSettingsStorage implements SettingsPort {
  private readonly filePath: string;

  constructor(private readonly dir: string = dataDir(), fileName = "settings.json") {
    this.filePath = join(dir, fileName);
  }

  read(): unknown {
    if (!existsSync(this.filePath)) return undefined;
    return JSON.parse(readFileSync(this.filePath, "utf8"));
  }

  write(data: unknown): void {
    mkdirSync(this.dir, { recursive: true });

    // Write to a sibling temp file, then rename over the target. rename is
    // atomic on the same filesystem, so readers never see a half-written file.
    const tempPath = `${this.filePath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(data), "utf8");
    renameSync(tempPath, this.filePath);
  }
}
