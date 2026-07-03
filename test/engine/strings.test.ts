import { describe, expect, test } from "bun:test";
import { LOCALES, type Locale } from "../../src/engine/locale";
import { stringsFor, type UIStrings } from "../../src/engine/strings";

// Walk a strings table into leaf values (functions invoked with a sample arg) so
// we can assert coverage without hand-listing every key.
function leaves(strings: UIStrings): string[] {
  const out: string[] = [];
  const visit = (v: unknown): void => {
    if (typeof v === "string") out.push(v);
    else if (typeof v === "function") out.push((v as (n: number) => string)(30));
    else if (v && typeof v === "object") for (const x of Object.values(v)) visit(x);
  };
  visit(strings);
  return out;
}

describe("stringsFor", () => {
  test("every locale resolves to a table", () => {
    for (const locale of LOCALES) expect(stringsFor(locale)).toBeDefined();
  });

  test("English table carries the frank_type stat labels verbatim", () => {
    const en = stringsFor("en");
    expect(en.results.wpm).toBe("WPM");
    expect(en.results.accuracy).toBe("Accuracy");
    expect(en.profile.empty).toBe("No sessions yet — finish a run to see your trends.");
    expect(en.header.done(30)).toBe("Time! 30s drill complete — ");
  });

  test("pt-BR translates the labels (no leftover English)", () => {
    const pt = stringsFor("pt-BR");
    expect(pt.results.accuracy).toBe("Precisão");
    expect(pt.footer.duration).toBe("Duração");
    expect(pt.header.done(60)).toBe("Tempo! Treino de 60s concluído — ");
    expect(pt.race.you).toBe("Você");
  });

  test("no leaf string is empty in any locale", () => {
    for (const locale of LOCALES) {
      for (const value of leaves(stringsFor(locale))) expect(value.length).toBeGreaterThan(0);
    }
  });

  test("tables share the same shape across locales (no missing key)", () => {
    const enKeys = flatKeys(stringsFor("en"));
    for (const locale of LOCALES as readonly Locale[]) {
      expect(flatKeys(stringsFor(locale))).toEqual(enKeys);
    }
  });
});

// Dotted key paths of a table, sorted — two tables with the same paths have the
// same shape (every label present in both).
function flatKeys(obj: unknown, prefix = ""): string[] {
  if (!obj || typeof obj !== "object") return [prefix];
  return Object.entries(obj)
    .flatMap(([k, v]) =>
      typeof v === "object" && v !== null ? flatKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
    )
    .sort();
}
