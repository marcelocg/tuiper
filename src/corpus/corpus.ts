// Corpus entry point: the built catalog and locale filtering. The raw records
// come from the generated corpus.data.ts (bundled from corpus/**/*.yml); this
// module builds them into Excerpts once and exposes locale-scoped views,
// mirroring frank_type's ExcerptCatalog.all(locale:) with its English fallback.

import { buildCatalog, type Excerpt } from "./excerpt_catalog";
import { RAW_EXCERPTS } from "./corpus.data";

export type { Excerpt } from "./excerpt_catalog";

const DEFAULT_LOCALE = "en";

/** Every excerpt, built and normalized. Computed once at module load. */
export const CATALOG: readonly Excerpt[] = buildCatalog(RAW_EXCERPTS);

/**
 * Excerpts for a UI locale. Unknown/unsupported locales fall back to English,
 * matching frank_type (`records_for` → default locale when none match).
 */
export function excerptsForLocale(locale?: string): Excerpt[] {
  if (!locale) return [...CATALOG];

  const matching = CATALOG.filter((excerpt) => excerpt.language === locale);
  if (matching.length > 0) return matching;

  return CATALOG.filter((excerpt) => excerpt.language === DEFAULT_LOCALE);
}
