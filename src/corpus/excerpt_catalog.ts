// Excerpt catalog builder — a TS port of frank_type's
// app/services/typing/excerpt_catalog.rb. Pure: raw YAML-derived records in →
// attributed, normalized Excerpts out. The impure part (finding and parsing the
// bundled YAML) lives in the build step (scripts/build-corpus.ts) and the
// generated corpus.data.ts; this module only transforms records.

import { normalizeText, type Locale } from "./text_normalizer";

/** A raw excerpt record, as bundled: prose plus path-derived taxonomy. */
export interface RawExcerpt {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly source: string;
  readonly source_url: string;
  readonly text: string;
  readonly language: string;
  readonly category: string;
  readonly speed_band: string;
}

export type Difficulty = "easy" | "medium" | "hard";

/** A built excerpt: frank_type's `Excerpt` Data class, field-for-field. */
export interface Excerpt {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly language: string;
  readonly category: string;
  readonly source: string;
  readonly source_url: string;
  readonly original_text: string;
  readonly normalized_text: string;
  readonly speed_band: string;
  readonly difficulty: Difficulty;
  readonly word_count: number;
  readonly character_count: number;
}

export function buildCatalog(records: readonly RawExcerpt[]): Excerpt[] {
  return records.map(buildExcerpt);
}

function buildExcerpt(attributes: RawExcerpt): Excerpt {
  const normalized_text = normalizeText(attributes.text, attributes.language as Locale);
  const list = words(normalized_text); // split once; reused for difficulty + count

  return {
    id: attributes.id,
    title: attributes.title,
    author: attributes.author,
    language: attributes.language,
    category: attributes.category,
    source: attributes.source,
    source_url: attributes.source_url,
    original_text: attributes.text,
    normalized_text,
    speed_band: attributes.speed_band,
    difficulty: difficultyForWords(list),
    word_count: list.length,
    character_count: normalized_text.length,
  };
}

/** frank_type's difficulty heuristic: average word length + long-word ratio. */
export function difficultyFor(text: string): Difficulty {
  return difficultyForWords(words(text));
}

function difficultyForWords(list: readonly string[]): Difficulty {
  if (list.length === 0) return "easy";

  const averageWordLength = list.reduce((sum, word) => sum + word.length, 0) / list.length;
  const longWordRatio = list.filter((word) => word.length >= 8).length / list.length;

  if (averageWordLength >= 5.2 || longWordRatio >= 0.2) return "hard";
  if (averageWordLength >= 4.5 || longWordRatio >= 0.12) return "medium";
  return "easy";
}

/** Split on whitespace, dropping empties — Ruby's `String#split` with no arg. */
function words(text: string): string[] {
  return text.split(/\s+/).filter((word) => word.length > 0);
}
