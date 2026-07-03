import { describe, expect, test } from "bun:test";
import { DEFAULT_THEME, isThemeName, nextTheme, THEMES } from "../../src/engine/theme";

describe("theme identity", () => {
  test("THEMES lists slate and rush in cycle order", () => {
    expect(THEMES).toEqual(["slate", "rush"]);
  });

  test("default theme is slate", () => {
    expect(DEFAULT_THEME).toBe("slate");
  });

  test("nextTheme cycles slate → rush → slate", () => {
    expect(nextTheme("slate")).toBe("rush");
    expect(nextTheme("rush")).toBe("slate");
  });

  test("isThemeName accepts known names, rejects everything else", () => {
    expect(isThemeName("slate")).toBe(true);
    expect(isThemeName("rush")).toBe(true);
    expect(isThemeName("neon")).toBe(false);
    expect(isThemeName(42)).toBe(false);
    expect(isThemeName(undefined)).toBe(false);
  });
});
