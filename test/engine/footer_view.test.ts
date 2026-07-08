import { describe, expect, test } from "bun:test";
import { formatFooter } from "../../src/engine/footer_view";
import { stringsFor } from "../../src/engine/strings";

// formatFooter composes the persistent footer's single line, adapting to width:
// the full key-hint tail when the terminal is wide, and a compact form ending in
// a discoverable "? help" pointer when it would overflow. Asserted here without a
// TTY. The 80-col floor (#13) is the tightest real case.

const en = stringsFor("en").footer;
const pt = stringsFor("pt-BR").footer;

const base = {
  strings: en,
  categoryLabel: "random",
  themeName: "slate",
  locale: "en",
  durationSeconds: 30,
  ready: true,
};

describe("formatFooter", () => {
  test("wide terminal shows the full key-hint tail", () => {
    const line = formatFooter({ ...base, width: 220 });
    expect(line).toContain(en.hints); // "Tab next · ? help · …"
    expect(line).toContain("Duration 30s");
    expect(line).toContain("Category random");
    expect([...line].length).toBeLessThanOrEqual(220);
  });

  test("at the 80-col floor the full tail is dropped for a ? help pointer", () => {
    const line = formatFooter({ ...base, width: 80 });
    expect([...line].length).toBeLessThanOrEqual(80);
    expect(line).toContain(en.helpHint); // "? help"
    expect(line).not.toContain("Tab next"); // full tail gone
    // The core config stays visible — the compact form drops the tail, not state.
    expect(line).toContain("Duration 30s");
    expect(line).toContain("Locale en");
  });

  test("never clips mid-hint: the line is a clean join, no trailing ellipsis", () => {
    for (const width of [80, 100, 120, 220]) {
      const line = formatFooter({ ...base, width });
      expect([...line].length).toBeLessThanOrEqual(width);
      expect(line).not.toContain("…");
    }
  });

  test("pt-BR compact form fits 80 cols with the localized help pointer", () => {
    const line = formatFooter({
      strings: pt,
      categoryLabel: "aleatório",
      themeName: "slate",
      locale: "pt-BR",
      durationSeconds: 30,
      ready: true,
      width: 80,
    });
    expect([...line].length).toBeLessThanOrEqual(80);
    expect(line).toContain(pt.helpHint); // "? ajuda"
    expect(line).not.toContain("Tab próximo");
  });

  test("the duration gate only appears before a run (ready) — wide enough to fit", () => {
    const ready = formatFooter({ ...base, width: 220, ready: true });
    expect(ready).toContain(en.durationHint); // "1/2/3 duration"
    const running = formatFooter({ ...base, width: 220, ready: false });
    expect(running).not.toContain(en.durationHint);
  });

  test("the help pointer survives even when state fields must be dropped", () => {
    // A pathological narrow width below the real floor: the ? help pointer must
    // still be present and the line must not overflow.
    const line = formatFooter({ ...base, width: 20 });
    expect([...line].length).toBeLessThanOrEqual(20);
    expect(line).toContain(en.helpHint);
  });
});
