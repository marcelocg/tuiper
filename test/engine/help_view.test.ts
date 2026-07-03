import { describe, expect, test } from "bun:test";
import { formatHelp } from "../../src/engine/help_view";
import { stringsFor } from "../../src/engine/strings";

// formatHelp composes the help overlay's lines: a title, then one row per
// keybinding (universal key literal + localized description). Asserted here
// without a TTY.

describe("formatHelp", () => {
  test("lists every keybinding with its key literal", () => {
    const text = formatHelp().join("\n");
    expect(text).toContain("Keybindings");
    // Universal key literals appear regardless of locale.
    for (const literal of ["Tab", "?", "1/2/3", "c", "t", "l", "p", "s", "Esc", "Bksp", "Ctrl-Bksp", "Ctrl-U", "q / Ctrl-C"]) {
      expect(text).toContain(literal);
    }
  });

  test("pairs literals with the English descriptions", () => {
    const lines = formatHelp();
    expect(lines.some((l) => l.startsWith("Tab") && l.includes("next excerpt"))).toBe(true);
    expect(lines.some((l) => l.startsWith("s") && l.includes("excerpt sources"))).toBe(true);
    expect(lines.some((l) => l.startsWith("q / Ctrl-C") && l.includes("quit"))).toBe(true);
  });

  test("localizes descriptions but keeps key literals for pt-BR", () => {
    const pt = stringsFor("pt-BR").help;
    const text = formatHelp(pt).join("\n");
    expect(text).toContain("Atalhos");
    expect(text).toContain("próximo trecho");
    expect(text).toContain("fontes dos trechos");
    // Key literals are universal — still English glyphs in pt-BR.
    expect(text).toContain("Tab");
    expect(text).toContain("Ctrl-Bksp");
    expect(text).not.toContain("next excerpt");
  });
});
