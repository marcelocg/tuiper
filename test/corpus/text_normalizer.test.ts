import { describe, expect, test } from "bun:test";
import { normalizeText } from "../../src/corpus/text_normalizer";

// Golden-value port of frank_type's text_normalizer_test.rb. The corpus-build
// normalizer: English is transliterated to ASCII (NFKD + strip marks) then
// reduced to [a-z0-9 ]; pt-BR preserves accents (NFC) and keeps letters/digits.

describe("normalizeText — English (default / en)", () => {
  test("normalizes prose into lowercase typing text", () => {
    expect(normalizeText("Café au lait — 42 times!", "en")).toBe("cafe au lait 42 times");
  });

  test("collapses repeated whitespace and punctuation", () => {
    expect(normalizeText(" Hello,   world... again? ", "en")).toBe("hello world again");
  });

  test("default locale still strips accents to ascii", () => {
    expect(normalizeText("Café")).toBe("cafe");
  });
});

describe("normalizeText — Brazilian Portuguese (pt-BR)", () => {
  test("preserves accents", () => {
    expect(normalizeText("Coração, ação — CAFÉ!", "pt-BR")).toBe(
      "coração ação café",
    );
  });

  test("preserves accents (second sample)", () => {
    expect(normalizeText("Coração — açúcar, NÃO!", "pt-BR")).toBe(
      "coração açúcar não",
    );
  });

  test("normalizes whitespace (newline / tab / nbsp)", () => {
    expect(normalizeText("Coração\n\tação café", "pt-BR")).toBe(
      "coração ação café",
    );
  });

  test("composes decomposed input to NFC", () => {
    // "Coração" written with combining cedilla (U+0327) + tilde (U+0303).
    const result = normalizeText("Coração", "pt-BR");
    expect(result).toBe("coração");
    expect(result).toBe(result.normalize("NFC"));
  });
});
