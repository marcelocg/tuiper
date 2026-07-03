// Pure UI-locale identity — the active language, how it cycles, and how the
// boot default is derived from the environment. Sibling of theme.ts: kept free
// of any OpenTUI/fs import so it stays below the seam. The storage layer
// validates/persists a Locale, the input mapper cycles it, the strings table
// turns it into a UI-string set, and the corpus filters excerpts by it.

export type Locale = "en" | "pt-BR";

/** All locales in cycle order — `l` steps through this list. */
export const LOCALES: readonly Locale[] = ["en", "pt-BR"];

export const DEFAULT_LOCALE: Locale = "en";

/** Type guard: is `value` one of the known locales? */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Next locale in cycle order, wrapping around (unknown names restart the cycle). */
export function nextLocale(current: Locale): Locale {
  const i = LOCALES.indexOf(current);
  return LOCALES[(i + 1) % LOCALES.length]!;
}

/**
 * The boot default locale from a POSIX `$LANG` value (e.g. `pt_BR.UTF-8`,
 * `en_US`, `C`). Only the primary language subtag is inspected: `pt*` → pt-BR,
 * `en*` → en, anything else (empty, `C`, `POSIX`, an unsupported language) →
 * the default. A persisted choice always overrides this — it's only the
 * first-run seed.
 */
export function localeFromEnv(lang?: string): Locale {
  if (!lang) return DEFAULT_LOCALE;
  const primary = lang.split(/[.@_-]/)[0]!.toLowerCase();
  if (primary === "pt") return "pt-BR";
  if (primary === "en") return "en";
  return DEFAULT_LOCALE;
}
