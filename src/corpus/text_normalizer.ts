// Corpus-build text normalizer — a TS port of frank_type's
// app/services/typing/text_normalizer.rb. It produces the `normalized_text`
// a typist actually types: English is folded to ASCII, Brazilian Portuguese
// keeps its accents. Pure (data in → data out); golden values are pinned in
// test/corpus/text_normalizer.test.ts, ported from the Ruby test.
//
// Note: this is the *corpus* normalizer (builds the excerpt text). The runtime
// keystroke comparison uses a separate, lighter NFC+lowercase pass in
// text_compare.ts — matching frank_type, which likewise separates the two.

export type Locale = "en" | "pt-BR" | (string & {});

/**
 * Normalize prose for typing. `locale === "pt-BR"` preserves diacritics; any
 * other locale (default English) transliterates to ASCII.
 */
export function normalizeText(text: string, locale: Locale = "en"): string {
  return locale === "pt-BR" ? normalizePortuguese(text) : normalizeEnglish(text);
}

function normalizeEnglish(text: string): string {
  return (
    text
      // NFKD decomposes accents (é → e + ◌́) and expands ligatures (ﬁ → fi);
      // stripping combining marks then folds to ASCII, as I18n.transliterate does.
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      // Anything left that isn't a-z, 0-9, or whitespace becomes a space…
      .replace(/[^a-z0-9\s]/g, " ")
      // …then collapse the resulting space runs (Ruby squeeze(" ")).
      .replace(/ +/g, " ")
      .trim()
  );
}

function normalizePortuguese(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}
