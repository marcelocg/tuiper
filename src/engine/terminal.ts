// Pure terminal-capability decisions (#13): the size floor, the color-depth
// preference, and the pre-boot raw-mode/TTY gate. Kept free of any OpenTUI/TTY/
// process import so it stays below the seam — the shell reads the impure facts
// (renderer.width/height, process.env, isTTY, setRawMode) and hands them in, and
// these functions decide what to show or whether to run at all. Golden-tested.

import type { TerminalStrings } from "./strings";

/** Minimum terminal size below which the layout breaks; show the too-small
 * screen and pause rendering until the window grows back (PRD story 49). */
export const MIN_COLS = 80;
export const MIN_ROWS = 24;

/** True when the terminal is below the 80×24 floor on either axis. The 80×24
 * boundary itself fits (inclusive) — only strictly smaller is too small. */
export function terminalTooSmall(cols: number, rows: number): boolean {
  return cols < MIN_COLS || rows < MIN_ROWS;
}

/** The too-small screen content: the title, the required-vs-current sizes, and
 * a resize hint. Pure lines the shell paints centered/at the top. */
export function terminalTooSmallLines(
  cols: number,
  rows: number,
  s: TerminalStrings,
): string[] {
  return [
    s.tooSmallTitle,
    `${s.minLabel} ${MIN_COLS}×${MIN_ROWS} · ${s.nowLabel} ${cols}×${rows}`,
    s.tooSmallHint,
  ];
}

/**
 * Terminal color depth. Truecolor is preferred (the heat-map gradient and theme
 * colors render as exact 24-bit values); otherwise the shell snaps to the
 * ansi-256 cube. 16-color terminals are out of scope (PRD) — they degrade from
 * the 256 path rather than getting their own branch.
 */
export type ColorSupport = "truecolor" | "ansi256";

/**
 * Detect color depth from the environment. `COLORTERM` of `truecolor`/`24bit`
 * (case-insensitive) is the de-facto signal for 24-bit support; everything else
 * takes the 256-color fallback. `env` is a plain object (`process.env`) so this
 * stays pure and testable without touching the real environment.
 */
export function detectColorSupport(env: Readonly<Record<string, string | undefined>>): ColorSupport {
  if (/^(truecolor|24bit)$/i.test(env.COLORTERM ?? "")) return "truecolor";
  return "ansi256";
}

/** Convenience predicate: does the environment advertise truecolor? */
export function prefersTruecolor(env: Readonly<Record<string, string | undefined>>): boolean {
  return detectColorSupport(env) === "truecolor";
}

/** The two impure facts the shell reads about stdin/stdout at boot. */
export interface StartupCaps {
  /** Is the output an interactive terminal (`process.stdout.isTTY`)? */
  readonly isTTY: boolean;
  /** Can we enter raw mode (`typeof process.stdin.setRawMode === "function"`)? */
  readonly canSetRawMode: boolean;
}

/** The outcome of the startup gate: run, or refuse with a printable message. */
export type StartupResult = { ok: true } | { ok: false; message: string };

/**
 * Decide whether tuiper can start. Per-keystroke timing needs a raw-mode TTY;
 * a piped/redirected (non-TTY) or raw-mode-less start is refused up front with
 * a clear message rather than booting into a broken input loop (PRD story 51).
 */
export function startupGuard(caps: StartupCaps, s: TerminalStrings): StartupResult {
  if (!caps.isTTY) return { ok: false, message: s.notATty };
  if (!caps.canSetRawMode) return { ok: false, message: s.noRawMode };
  return { ok: true };
}
