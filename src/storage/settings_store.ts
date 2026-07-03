// Local user preferences — the persisted counterpart to session history. Like
// SessionStore, the impure edge is an injected port (read/write JSON); the app
// injects a file adapter (`settings.json`), tests inject an in-memory fake.
//
// `theme` and `locale` are modeled today; last-duration / last-category (PRD)
// slot in later. Unknown keys in the stored payload ride through untouched on
// save, so a future field written by a newer build survives an older one.
//
// `locale` is optional: absent means "no persisted choice yet", so the shell
// falls back to the $LANG-derived default (locale.ts) on first run.

import { DEFAULT_THEME, isThemeName, type ThemeName } from "../engine/theme";
import { isLocale, type Locale } from "../engine/locale";

export interface Settings {
  readonly theme: ThemeName;
  /** Absent until the user has picked a locale; the shell seeds it from $LANG. */
  readonly locale?: Locale;
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
    // Locale stays absent (not defaulted) when unset/invalid, so the shell can
    // tell "never chosen" from "chosen en" and seed from $LANG on first run.
    return isLocale(raw.locale) ? { theme, locale: raw.locale } : { theme };
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
