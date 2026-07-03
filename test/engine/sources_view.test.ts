import { describe, expect, test } from "bun:test";
import { formatSources, type SourceEntry } from "../../src/engine/sources_view";
import { stringsFor } from "../../src/engine/strings";

// formatSources composes the sources screen: a title then one attribution line
// per excerpt (title — author · source). Asserted here without a TTY.

const excerpts: SourceEntry[] = [
  { title: "Frankenstein", author: "Mary Shelley", source: "Project Gutenberg" },
  { title: "Dom Casmurro", author: "Machado de Assis", source: "Domínio Público" },
];

describe("formatSources", () => {
  test("empty corpus shows a single guidance line, no entries", () => {
    const lines = formatSources([]);
    expect(lines).toContain(stringsFor("en").sources.empty);
    expect(lines.join("\n")).not.toContain("—");
  });

  test("renders one attribution line per excerpt with title, author, source", () => {
    const text = formatSources(excerpts).join("\n");
    expect(text).toContain("Sources");
    expect(text).toContain("Frankenstein — Mary Shelley · Project Gutenberg");
    expect(text).toContain("Dom Casmurro — Machado de Assis · Domínio Público");
  });

  test("preserves excerpt order and emits one line per excerpt (scrollable)", () => {
    const lines = formatSources(excerpts);
    // title + blank + 2 entries.
    expect(lines).toHaveLength(4);
    expect(lines[2]).toContain("Frankenstein");
    expect(lines[3]).toContain("Dom Casmurro");
  });

  test("localizes the title and empty message for pt-BR", () => {
    const pt = stringsFor("pt-BR").sources;
    expect(formatSources([], pt)).toContain(pt.empty);
    expect(formatSources(excerpts, pt).join("\n")).toContain("Fontes");
  });
});
