import { describe, expect, test } from "bun:test";
import { CATALOG, excerptsForLocale } from "../../src/corpus/corpus";

// Real-corpus invariants, mirroring frank_type's excerpt_catalog_test.rb. These
// guard the bundled YAML → generated data → built catalog pipeline: every
// excerpt is fully attributed, normalized to the right character set for its
// language, and the taxonomy covers the expected languages/categories/bands.

describe("CATALOG (bundled corpus)", () => {
  test("loads attributed, normalized excerpts", () => {
    expect(CATALOG.length).toBeGreaterThan(0);
    expect(CATALOG.every((e) => e.id.length > 0)).toBe(true);
    expect(CATALOG.some((e) => e.author === "Isaac Asimov")).toBe(true);
    expect(CATALOG.some((e) => e.author === "Machado de Assis")).toBe(true);
  });

  test("covers the expected languages, categories and bands", () => {
    expect([...new Set(CATALOG.map((e) => e.language))].sort()).toEqual(["en", "pt-BR"]);
    expect([...new Set(CATALOG.map((e) => e.category))].sort()).toEqual([
      "biography",
      "fantasy",
      "scifi",
    ]);
    expect([...new Set(CATALOG.map((e) => e.speed_band))].sort()).toEqual([
      "fast",
      "medium",
      "slow",
    ]);
  });

  test("attributes every excerpt to a Gutenberg source", () => {
    expect(CATALOG.every((e) => /Project Gutenberg ebook #\d+/.test(e.source))).toBe(true);
    expect(
      CATALOG.every((e) => e.source_url.startsWith("https://www.gutenberg.org/ebooks/")),
    ).toBe(true);
  });

  test("English normalizes to [a-z0-9 ], pt-BR keeps accents", () => {
    const en = CATALOG.filter((e) => e.language === "en");
    const pt = CATALOG.filter((e) => e.language === "pt-BR");
    expect(en.every((e) => /^[a-z0-9 ]+$/.test(e.normalized_text))).toBe(true);
    expect(pt.every((e) => /^[\p{L}\p{N} ]+$/u.test(e.normalized_text))).toBe(true);
    expect(pt.some((e) => /[áàâãéêíóôõúç]/.test(e.normalized_text))).toBe(true);
  });

  test("every band/category/language group has a healthy pool", () => {
    const groups = new Map<string, number>();
    for (const e of CATALOG) {
      const key = `${e.language}/${e.category}/${e.speed_band}`;
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
    expect([...groups.values()].every((count) => count >= 10)).toBe(true);
    expect(CATALOG.every((e) => e.word_count >= 70)).toBe(true);
  });
});

describe("excerptsForLocale", () => {
  test("returns only the requested locale", () => {
    expect(excerptsForLocale("pt-BR").every((e) => e.language === "pt-BR")).toBe(true);
    expect(excerptsForLocale("en").every((e) => e.language === "en")).toBe(true);
  });

  test("falls back to English for unsupported locales", () => {
    expect(excerptsForLocale("fr").every((e) => e.language === "en")).toBe(true);
  });
});
