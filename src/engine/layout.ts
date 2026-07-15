// Pure screen layout: terminal height -> each pane's row budget and anchor row.
// The shell owns the terminal; this module owns how its rows are divided. Kept
// below the seam so the height math (and its one-row floors) is asserted without
// a TTY — composeFrame consumes it, the shell only positions renderables.

/** First row of the typing surface (the header occupies the rows above it). */
export const SURFACE_TOP = 2;

/** Rows held back at the bottom: a blank line + the footer. */
export const FOOTER_RESERVE = 2;

/** Blank spacer + three race lanes, reserved always so the surface never
 *  reflows when the race strip appears mid-run. */
export const RACE_STRIP_ROWS = 4;

/** Rows available to the typing / results surface. */
export function surfaceHeight(terminalHeight: number): number {
  return Math.max(1, terminalHeight - SURFACE_TOP - FOOTER_RESERVE - RACE_STRIP_ROWS);
}

/**
 * Rows available to a full-screen overlay. Overlays blank the race strip, so
 * unlike the typing surface they reclaim those rows — the extra height keeps the
 * help/sources panels from clipping their tail on shorter terminals.
 */
export function overlayHeight(terminalHeight: number): number {
  return Math.max(1, terminalHeight - SURFACE_TOP - FOOTER_RESERVE);
}

/** Anchor row of the race strip: the blank row just under the surface. */
export function raceStripTop(terminalHeight: number): number {
  return SURFACE_TOP + surfaceHeight(terminalHeight) + 1;
}

/** Anchor row of the footer: the last terminal row, never over the surface. */
export function footerTop(terminalHeight: number): number {
  return Math.max(SURFACE_TOP + 1, terminalHeight - 1);
}
