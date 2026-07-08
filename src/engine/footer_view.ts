// Pure view mapping for the persistent footer: the active config (duration /
// category / theme / locale) plus a key-hint tail, composed into one line that
// adapts to terminal width. Wide terminals show the full hint tail; at the
// 80-col floor (#13) the tail is dropped for a compact, discoverable "? help"
// pointer so nothing clips off-screen mid-hint. Kept pure and below the seam so
// the width tiers are golden-tested without a TTY; the shell just paints the
// returned string in chrome.

import type { FooterStrings } from "./strings";

const SEP = " · ";

/** Visible width in terminal cells (code points; footer text is width-1 glyphs). */
const cells = (s: string): number => [...s].length;

/** Join non-empty segments with the middot separator. */
const join = (segments: readonly string[]): string => segments.filter((s) => s).join(SEP);

export interface FooterViewInput {
  readonly strings: FooterStrings;
  /** Localized category display name (e.g. "random", "aleatório"). */
  readonly categoryLabel: string;
  /** Stable theme identifier (slate / rush). */
  readonly themeName: string;
  /** Stable locale identifier (en / pt-BR). */
  readonly locale: string;
  readonly durationSeconds: number;
  /** Ready state → show the `1/2/3 duration` gate (locked once a run starts). */
  readonly ready: boolean;
  /** Terminal width in columns. */
  readonly width: number;
}

/**
 * The footer line for a given width. The four config fields sit on the left; the
 * right end shows the full key-hint tail when it fits, else a `? help` pointer.
 * Candidates run widest-first — the first that fits within `width` wins — so the
 * bar degrades gracefully: full tail → pointer → drop the duration gate → shed
 * config fields from the right. The `? help` pointer is never dropped (it is the
 * one guaranteed path to discovering every binding), so the bar always stays
 * discoverable and never clips a hint mid-word.
 */
export function formatFooter(input: FooterViewInput): string {
  const { strings: f, categoryLabel, themeName, locale, durationSeconds, ready, width } = input;

  // Config fields in visual (left-to-right) order; shed from the right when tight.
  const state = [
    `${f.duration} ${durationSeconds}s`,
    `${f.category} ${categoryLabel}`,
    `${f.theme} ${themeName}`,
    `${f.locale} ${locale}`,
  ];
  const gate = ready ? f.durationHint : "";

  // Widest → narrowest. Each keeps the help pointer once the full tail is gone.
  const candidates = [
    join([...state, gate, f.hints]), // full tail (wide terminals)
    join([...state, gate, f.helpHint]), // full config + gate + pointer
    join([...state, f.helpHint]), // drop the duration gate
    join([...state.slice(0, 3), f.helpHint]), // drop locale
    join([...state.slice(0, 2), f.helpHint]), // drop theme
    join([state[0]!, f.helpHint]), // duration + pointer
    f.helpHint, // pointer alone — always fits at any sane width
  ];

  for (const line of candidates) {
    if (cells(line) <= width) return line;
  }
  return f.helpHint; // last resort (width below even the bare pointer)
}
