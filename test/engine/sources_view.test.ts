import { describe, expect, test } from "bun:test";
import { formatSources, type SourceEntry } from "../../src/engine/sources_view";
import { rowsText, span } from "../../src/engine/view_row";
import { stringsFor } from "../../src/engine/strings";

// formatSources composes the sources screen as Styled Rows: a title row then one
// attribution row per excerpt (title — author · source). Asserted here without a
// TTY; the plain text is read back through rowsText, and the title carries the
// `title` role so Paint emphasizes it below the seam.

const excerpts: SourceEntry[] = [
  { title: "Frankenstein", author: "Mary Shelley", source: "Project Gutenberg" },
  { title: "Dom Casmurro", author: "Machado de Assis", source: "Domínio Público" },
];

describe("formatSources", () => {
  test("empty corpus shows a single guidance line, no entries", () => {
    const lines = rowsText(formatSources([]));
    expect(lines).toContain(stringsFor("en").sources.empty);
    expect(lines.join("\n")).not.toContain("—");
  });

  test("renders one attribution line per excerpt with title, author, source", () => {
    const text = rowsText(formatSources(excerpts)).join("\n");
    expect(text).toContain("Sources");
    expect(text).toContain("Frankenstein — Mary Shelley · Project Gutenberg");
    expect(text).toContain("Dom Casmurro — Machado de Assis · Domínio Público");
  });

  test("preserves excerpt order and emits one row per excerpt (scrollable)", () => {
    const lines = rowsText(formatSources(excerpts));
    // title + blank + 2 entries.
    expect(lines).toHaveLength(4);
    expect(lines[2]).toContain("Frankenstein");
    expect(lines[3]).toContain("Dom Casmurro");
  });

  test("the title row carries the title role", () => {
    expect(formatSources(excerpts)[0]).toEqual([span("title", "Sources")]);
  });

  test("localizes the title and empty message for pt-BR", () => {
    const pt = stringsFor("pt-BR").sources;
    expect(rowsText(formatSources([], pt))).toContain(pt.empty);
    expect(rowsText(formatSources(excerpts, pt)).join("\n")).toContain("Fontes");
  });
});
