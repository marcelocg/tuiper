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

// Non-decomposing Latin letters I18n.transliterate maps to ASCII but NFKD
// leaves intact (they carry no combining marks). Without this map they would be
// spaced out by the [a-z0-9] filter instead of folded. Values are lowercase —
// applied after toLowerCase.
const NON_DECOMPOSING: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ø: "o",
  ð: "d",
  þ: "th",
  đ: "d",
  ł: "l",
  ĳ: "ij",
};

// Ruby's `\s` is ASCII-only ([ \t\r\n\f\v]); JS `\s` also matches Unicode
// separators (U+2028/2029/00A0…). Match Ruby exactly so exotic separators are
// stripped to a space rather than retained.
const ASCII_WS = " \\t\\n\\r\\f\\v";

function normalizeEnglish(text: string): string {
  return (
    text
      // NFKD decomposes accents (é → e + ◌́) and expands ligatures (ﬁ → fi);
      // stripping combining marks then folds to ASCII, as I18n.transliterate does.
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      // Fold the non-decomposing Latin letters NFKD can't (ß→ss, æ→ae, …).
      .replace(/[ßæœøðþđłĳ]/g, (c) => NON_DECOMPOSING[c] ?? c)
      // Anything left that isn't a-z, 0-9, or ASCII whitespace becomes a space…
      .replace(new RegExp(`[^a-z0-9${ASCII_WS}]`, "g"), " ")
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
