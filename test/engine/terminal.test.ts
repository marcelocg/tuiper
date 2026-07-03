import { describe, expect, test } from "bun:test";
import {
  MIN_COLS,
  MIN_ROWS,
  detectColorSupport,
  prefersTruecolor,
  startupGuard,
  terminalTooSmall,
  terminalTooSmallLines,
} from "../../src/engine/terminal";
import { stringsFor } from "../../src/engine/strings";

const TERM = stringsFor("en").terminal;

describe("terminal floor", () => {
  test("minimum is 80×24", () => {
    expect(MIN_COLS).toBe(80);
    expect(MIN_ROWS).toBe(24);
  });

  test("exactly 80×24 fits (boundary is inclusive)", () => {
    expect(terminalTooSmall(80, 24)).toBe(false);
  });

  test("one column or row short is too small", () => {
    expect(terminalTooSmall(79, 24)).toBe(true);
    expect(terminalTooSmall(80, 23)).toBe(true);
  });

  test("comfortably large fits", () => {
    expect(terminalTooSmall(120, 40)).toBe(false);
  });

  test("too-small screen names the minimum and the current size", () => {
    const lines = terminalTooSmallLines(60, 20, TERM);
    const blob = lines.join("\n");
    expect(blob).toContain("80×24");
    expect(blob).toContain("60×20");
    expect(lines[0]).toBe(TERM.tooSmallTitle);
  });
});

describe("color support detection", () => {
  test("COLORTERM=truecolor is truecolor", () => {
    expect(detectColorSupport({ COLORTERM: "truecolor" })).toBe("truecolor");
    expect(prefersTruecolor({ COLORTERM: "truecolor" })).toBe(true);
  });

  test("COLORTERM=24bit is truecolor (case-insensitive)", () => {
    expect(detectColorSupport({ COLORTERM: "24BIT" })).toBe("truecolor");
  });

  test("anything else falls back to 256-color", () => {
    expect(detectColorSupport({ COLORTERM: "" })).toBe("ansi256");
    expect(detectColorSupport({})).toBe("ansi256");
    expect(detectColorSupport({ COLORTERM: "256color" })).toBe("ansi256");
    expect(prefersTruecolor({ TERM: "xterm-256color" })).toBe(false);
  });
});

describe("startup capability guard", () => {
  test("a raw-mode TTY may start", () => {
    expect(startupGuard({ isTTY: true, canSetRawMode: true }, TERM)).toEqual({ ok: true });
  });

  test("a non-TTY is refused with the not-a-tty message", () => {
    const guard = startupGuard({ isTTY: false, canSetRawMode: false }, TERM);
    expect(guard.ok).toBe(false);
    expect(guard).toMatchObject({ ok: false, message: TERM.notATty });
  });

  test("a TTY without raw mode is refused with the raw-mode message", () => {
    const guard = startupGuard({ isTTY: true, canSetRawMode: false }, TERM);
    expect(guard).toMatchObject({ ok: false, message: TERM.noRawMode });
  });
});
