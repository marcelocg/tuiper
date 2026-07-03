// Local user preferences — the persisted counterpart to session history. Like
// SessionStore, the impure edge is an injected port (read/write JSON); the app
// injects a file adapter (`settings.json`), tests inject an in-memory fake.
//
// Only `theme` is modeled today; locale / last-duration / last-category (PRD)
// slot in later. Unknown keys in the stored payload ride through untouched on
// save, so a future field written by a newer build survives an older one.

import { DEFAULT_THEME, isThemeName, type ThemeName } from "../engine/theme";

export interface Settings {
  readonly theme: ThemeName;
}

export const DEFAULT_SETTINGS: Settings = { theme: DEFAULT_THEME };

/**
 * The injected persistence seam. `read` returns the parsed JSON payload (any
 * shape — the store guards it), `write` replaces it.
 */
export interface SettingsPort {
  read(): unknown;
  write(data: unknown): void;
}

export class SettingsStore {
  constructor(private readonly port: SettingsPort) {}

  /** Load validated settings, falling back to defaults for missing/bad fields. */
  load(): Settings {
    const raw = this.readRaw();
    const theme = isThemeName(raw.theme) ? raw.theme : DEFAULT_THEME;
    return { theme };
  }

  /** Persist settings, preserving any unknown keys already on disk. */
  save(settings: Settings): void {
    const merged = { ...this.readRaw(), ...settings };
    try {
      this.port.write(merged);
    } catch (_error) {
      // A settings write must never crash the app — the run continues in-memory.
    }
  }

  private readRaw(): Record<string, unknown> {
    try {
      const data = this.port.read();
      return data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};
    } catch (_error) {
      return {};
    }
  }
}
