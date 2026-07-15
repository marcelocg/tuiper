import { describe, expect, test } from "bun:test";
import {
  FOOTER_RESERVE,
  RACE_STRIP_ROWS,
  SURFACE_TOP,
  footerTop,
  overlayHeight,
  raceStripTop,
  surfaceHeight,
} from "../../src/engine/layout";

// Pure screen layout: terminal height -> the row budget of each pane. Extracted
// from the shell so the height math (and its floors) is asserted without a TTY.

describe("surfaceHeight", () => {
  test("reserves the header, the footer band, and the race strip rows", () => {
    // 24 - 2 (header) - 2 (footer band) - 4 (race strip) = 16
    expect(surfaceHeight(24)).toBe(24 - SURFACE_TOP - FOOTER_RESERVE - RACE_STRIP_ROWS);
    expect(surfaceHeight(24)).toBe(16);
  });

  test("never drops below one row on a tiny terminal", () => {
    expect(surfaceHeight(4)).toBe(1);
    expect(surfaceHeight(0)).toBe(1);
  });
});

describe("overlayHeight", () => {
  test("reclaims the race-strip rows (overlays blank the strip)", () => {
    // 24 - 2 - 2 = 20; four rows taller than the typing surface.
    expect(overlayHeight(24)).toBe(20);
    expect(overlayHeight(24) - surfaceHeight(24)).toBe(RACE_STRIP_ROWS);
  });

  test("never drops below one row", () => {
    expect(overlayHeight(2)).toBe(1);
  });
});

describe("raceStripTop", () => {
  test("anchors to the blank row just under the typing surface", () => {
    expect(raceStripTop(24)).toBe(SURFACE_TOP + surfaceHeight(24) + 1);
    expect(raceStripTop(24)).toBe(19);
  });
});

describe("footerTop", () => {
  test("sits on the last terminal row", () => {
    expect(footerTop(24)).toBe(23);
  });

  test("never rides up over the surface on a short terminal", () => {
    expect(footerTop(1)).toBe(SURFACE_TOP + 1);
  });
});
