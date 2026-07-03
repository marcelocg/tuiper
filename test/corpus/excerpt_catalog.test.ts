import { describe, expect, test } from "bun:test";
import { buildCatalog, difficultyFor, type RawExcerpt } from "../../src/corpus/excerpt_catalog";

// Unit tests for the pure catalog builder (frank_type's ExcerptCatalog): raw
// records in → attributed, normalized Excerpts out. Real-corpus invariants are
// asserted separately in corpus.test.ts.

function raw(over: Partial<RawExcerpt> = {}): RawExcerpt {
  return {
    id: "asimov-x",
    title: "Youth",
    author: "Isaac Asimov",
    source: "Project Gutenberg ebook #31547",
    source_url: "https://www.gutenberg.org/ebooks/31547",
    text: "The Industrialist tried.",
    language: "en",
    category: "scifi",
    speed_band: "slow",
    ...over,
  };
}

describe("buildCatalog", () => {
  test("attributes and normalizes each record", () => {
    const [excerpt] = buildCatalog([raw({ text: "Café — twice!" })]);
    expect(excerpt).toMatchObject({
      id: "asimov-x",
      author: "Isaac Asimov",
      language: "en",
      category: "scifi",
      speed_band: "slow",
      normalized_text: "cafe twice",
      original_text: "Café — twice!",
    });
    expect(excerpt!.word_count).toBe(2);
    expect(excerpt!.character_count).toBe("cafe twice".length);
  });

  test("pt-BR records keep their accents", () => {
    const [excerpt] = buildCatalog([
      raw({ language: "pt-BR", text: "Coração, ação!" }),
    ]);
    expect(excerpt!.normalized_text).toBe("coração ação");
  });
});

describe("difficultyFor", () => {
  test("empty text is easy", () => {
    expect(difficultyFor("")).toBe("easy");
  });

  test("short common words are easy", () => {
    expect(difficultyFor("the cat sat on a mat and ran")).toBe("easy");
  });

  test("long-word-heavy text is hard", () => {
    expect(difficultyFor("industrialist meditation extraordinary hexagonal")).toBe("hard");
  });
});
