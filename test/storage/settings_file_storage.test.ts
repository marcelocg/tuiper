import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FileSettingsStorage } from "../../src/storage/settings_file_storage";
import { SettingsStore } from "../../src/storage/settings_store";

// The impure edge: a few smokes proving the file adapter round-trips through
// SettingsStore and writes atomically. Uses a throwaway temp dir.

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "tuiper-settings-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("FileSettingsStorage", () => {
  test("round-trips a saved theme through SettingsStore and the file", () => {
    const dir = tempDir();
    new SettingsStore(new FileSettingsStorage(dir)).save({ theme: "rush" });
    const reloaded = new SettingsStore(new FileSettingsStorage(dir)).load();

    expect(reloaded.theme).toBe("rush");
    expect(existsSync(join(dir, "settings.json"))).toBe(true);
  });

  test("writes atomically — no temp file left behind, file is valid JSON", () => {
    const dir = tempDir();
    new SettingsStore(new FileSettingsStorage(dir)).save({ theme: "slate" });

    expect(existsSync(join(dir, "settings.json.tmp"))).toBe(false);
    const parsed = JSON.parse(readFileSync(join(dir, "settings.json"), "utf8"));
    expect(parsed.theme).toBe("slate");
  });

  test("missing file loads the defaults", () => {
    const store = new SettingsStore(new FileSettingsStorage(tempDir()));
    expect(store.load().theme).toBe("slate");
  });
});
