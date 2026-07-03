// Pure theme identity — the name of the active color theme and how it cycles.
// Kept free of any RGBA/@opentui import so it stays below the seam: the storage
// layer validates/persists a ThemeName, the input mapper cycles it, and only
// the shell (`shell/theme.ts`) turns a name into an actual palette of colors.

export type ThemeName = "slate" | "rush";

/** All themes in cycle order — `t` steps through this list. */
export const THEMES: readonly ThemeName[] = ["slate", "rush"];

export const DEFAULT_THEME: ThemeName = "slate";

/** Type guard: is `value` one of the known theme names? */
export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** Next theme in cycle order, wrapping around (unknown names restart the cycle). */
export function nextTheme(current: ThemeName): ThemeName {
  const i = THEMES.indexOf(current);
  return THEMES[(i + 1) % THEMES.length]!;
}
