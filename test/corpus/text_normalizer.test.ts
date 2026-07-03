import { describe, expect, test } from "bun:test";
import { normalizeText } from "../../src/corpus/text_normalizer";

// Golden-value port of frank_type's text_normalizer_test.rb. The corpus-build
// normalizer: English is transliterated to ASCII (NFKD + strip marks + an
// explicit map for non-decomposing Latin letters) then reduced to [a-z0-9 ];
// pt-BR preserves accents (NFC) and keeps letters/digits.

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

  test("transliterates non-decomposing Latin letters (I18n.transliterate parity)", () => {
    // These do not decompose under NFKD, so they need an explicit map to match
    // frank_type's Ruby I18n.transliterate rather than being spaced out.
    expect(normalizeText("Straße", "en")).toBe("strasse");
    expect(normalizeText("Encyclopædia", "en")).toBe("encyclopaedia");
    expect(normalizeText("Œuvre", "en")).toBe("oeuvre");
    expect(normalizeText("Þor and Ðegn", "en")).toBe("thor and degn");
  });

  test("exotic Unicode separators fold to a space (Ruby ASCII \\s parity)", () => {
    // U+2028 LINE SEPARATOR has no NFKD mapping and is not ASCII whitespace, so
    // frank_type replaces it with a space; JS \s must not retain it verbatim.
    const lineSep = String.fromCharCode(0x2028);
    expect(normalizeText(`a${lineSep}b`, "en")).toBe("a b");
  });
});

describe("normalizeText — Brazilian Portuguese (pt-BR)", () => {
  test("preserves accents", () => {
    expect(normalizeText("Coração, ação — CAFÉ!", "pt-BR")).toBe("coração ação café");
  });

  test("preserves accents (second sample)", () => {
    expect(normalizeText("Coração — açúcar, NÃO!", "pt-BR")).toBe("coração açúcar não");
  });

  test("normalizes whitespace (newline / tab)", () => {
    expect(normalizeText("Coração\n\tação café", "pt-BR")).toBe("coração ação café");
  });

  test("composes decomposed input to NFC", () => {
    const result = normalizeText("Coração", "pt-BR");
    expect(result).toBe("coração");
    expect(result).toBe(result.normalize("NFC"));
  });
});
