import { describe, expect, test } from "bun:test";
import { composeFrame, overlayScrollMax, type ViewState } from "../../src/engine/frame";
import { createSession, finish, typeChar } from "../../src/engine/session_state";
import { stringsFor } from "../../src/engine/strings";
import { rowsText } from "../../src/engine/view_row";
import type { StoredSession } from "../../src/storage/session_store";

// composeFrame is the whole screen as pure data — the one call per screen that
// replaces the shell's draw(). Asserted here without a TTY: no renderer, no
// palette, no store. Text is read back through rowsText; blank panes are [].

function vs(over: Partial<ViewState> = {}): ViewState {
  return {
    state: createSession("the quick brown fox jumps", 30),
    now: 0,
    overlay: null,
    overlayScroll: 0,
    category: "random",
    locale: "en",
    strings: stringsFor("en"),
    excerpts: [],
    history: [],
    themeName: "slate",
    width: 80,
    height: 24,
    ...over,
  };
}

const text = (rows: Parameters<typeof rowsText>[0]) => rowsText(rows).join("\n");

describe("composeFrame — ready", () => {
  test("header counts down, surface shows the excerpt, race strip is blank", () => {
    const frame = composeFrame(vs());
    expect(text(frame.header)).toBe("30s  ·  ready");
    expect(text(frame.surface)).toContain("the quick brown fox");
    expect(frame.raceStrip).toEqual([]); // no race until the run starts
  });

  test("footer shows the active config and the duration gate", () => {
    const footer = text(composeFrame(vs()).footer);
    expect(footer).toContain("Duration 30s");
    expect(footer).toContain("Theme slate");
    expect(footer).toContain("Locale en");
  });

  test("the race strip anchors just under the typing surface", () => {
    expect(composeFrame(vs()).raceStripTop).toBe(19); // SURFACE_TOP + 16 + 1
  });
});

describe("composeFrame — active", () => {
  const active = () => vs({ state: typeChar(createSession("the quick brown fox", 30), "t", 0), now: 3000 });

  test("header switches to typing and the countdown advances", () => {
    expect(text(composeFrame(active()).header)).toBe("27s  ·  typing");
  });

  test("the race strip appears with three labeled lanes", () => {
    const lanes = rowsText(composeFrame(active()).raceStrip);
    expect(lanes).toHaveLength(3);
    expect(lanes[0]).toContain("Slow");
    expect(lanes[1]).toContain("You");
    expect(lanes[2]).toContain("Fast");
  });

  test("the countdown turns urgent in the last five seconds", () => {
    const frame = composeFrame(vs({ state: typeChar(createSession("abc", 30), "a", 0), now: 27000 }));
    expect(frame.header[0]![0]).toMatchObject({ role: "wrong", text: "3s" });
  });
});

describe("composeFrame — finished", () => {
  const finished = () => {
    let s = typeChar(createSession("test", 30), "t", 1000);
    s = typeChar(s, "e", 1100);
    s = finish(s, 31000);
    return vs({ state: s, now: 31000 });
  };

  test("surface becomes the results panel", () => {
    const surface = text(composeFrame(finished()).surface);
    expect(surface).toContain("WPM");
    expect(surface).toContain("Accuracy");
    expect(surface).toContain("Completion");
  });

  test("the race strip is cleared once the run ends", () => {
    expect(composeFrame(finished()).raceStrip).toEqual([]);
  });
});

describe("composeFrame — overlays", () => {
  const entry = { title: "Frankenstein", author: "Mary Shelley", source: "Project Gutenberg" };

  test("help overlay takes over the surface and the footer shows its close hint", () => {
    const frame = composeFrame(vs({ overlay: "help" }));
    expect(text(frame.surface)).toContain("Keybindings");
    expect(text(frame.footer)).toBe(stringsFor("en").help.closeHint);
    expect(frame.raceStrip).toEqual([]); // overlays blank the strip
  });

  test("sources overlay lists the excerpt attributions", () => {
    const frame = composeFrame(vs({ overlay: "sources", excerpts: [entry] }));
    expect(text(frame.surface)).toContain("Frankenstein — Mary Shelley · Project Gutenberg");
  });

  test("profile overlay charts the history handed in", () => {
    const history: StoredSession[] = [
      { id: "1", finishedAt: "2026-07-01T00:00:00Z", metrics: { wpm: 40, accuracy: 90 } },
      { id: "2", finishedAt: "2026-07-02T00:00:00Z", metrics: { wpm: 80, accuracy: 96 } },
    ];
    const surface = text(composeFrame(vs({ overlay: "profile", history })).surface);
    expect(surface).toContain("Profile");
    expect(surface).toMatch(/WPM.*best 80/s);
  });

  test("an overlay still draws the header (the session keeps running underneath)", () => {
    expect(text(composeFrame(vs({ overlay: "help" })).header)).toBe("30s  ·  ready");
  });

  test("scrolling a long overlay drops the title row out of the window", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ ...entry, title: `Book ${i}` }));
    const top = composeFrame(vs({ overlay: "sources", excerpts: many }));
    const scrolled = composeFrame(vs({ overlay: "sources", excerpts: many, overlayScroll: 5 }));
    expect(rowsText(top.surface)[0]).toBe("Sources");
    expect(rowsText(scrolled.surface)[0]).not.toBe("Sources");
  });
});

describe("composeFrame — terminal too small", () => {
  test("every pane but the notice goes blank below the 80x24 floor", () => {
    const frame = composeFrame(vs({ width: 40, height: 10 }));
    expect(frame.header).toEqual([]);
    expect(frame.raceStrip).toEqual([]);
    expect(frame.footer).toEqual([]);
    expect(text(frame.surface)).toContain("80");
  });
});

describe("overlayScrollMax", () => {
  test("is 0 for a non-scrollable overlay (profile) and with no overlay", () => {
    expect(overlayScrollMax(vs({ overlay: "profile" }))).toBe(0);
    expect(overlayScrollMax(vs())).toBe(0);
  });

  test("is 0 when the content already fits the overlay height", () => {
    expect(overlayScrollMax(vs({ overlay: "help" }))).toBe(0); // 15 rows < 20
  });

  test("bounds the scroll to the content overflow", () => {
    const many = Array.from(
      { length: 60 },
      (_, i) => ({ title: `Book ${i}`, author: "A", source: "S" }),
    );
    // title + blank + 60 entries = 62 rows; overlay height at 24 rows is 20.
    expect(overlayScrollMax(vs({ overlay: "sources", excerpts: many }))).toBe(62 - 20);
  });
});
