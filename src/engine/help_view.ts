// Pure view mapping for the help overlay: a HelpStrings table → display lines.
// A title followed by one row per keybinding, each pairing a universal key
// literal (Tab, ?, 1/2/3, …) with a localized description. The shell paints
// these lines; keeping the layout pure lets the overlay be snapshot-asserted
// without a TTY, and the key literals stay identical across locales (only the
// descriptions are translated).

import { stringsFor, type HelpStrings } from "./strings";

const KEY_WIDTH = 12;

/** The keybindings, in display order, as (literal, description-selector) pairs. */
const BINDINGS: ReadonlyArray<readonly [string, (s: HelpStrings) => string]> = [
  ["Tab", (s) => s.nextExcerpt],
  ["?", (s) => s.help],
  ["1/2/3", (s) => s.duration],
  ["c", (s) => s.category],
  ["t", (s) => s.theme],
  ["l", (s) => s.locale],
  ["p", (s) => s.profile],
  ["s", (s) => s.sources],
  ["Esc", (s) => s.closeOverlay],
  ["Bksp", (s) => s.deleteChar],
  ["Ctrl-Bksp", (s) => s.deleteWord],
  ["Ctrl-U", (s) => s.deleteToLineStart],
  ["q / Ctrl-C", (s) => s.quit],
];

/**
 * The help overlay as text lines: a title, a blank spacer, then one row per
 * keybinding (`key.padEnd(KEY_WIDTH) + description`). Labels come from the
 * injected locale table (defaults to English).
 */
export function formatHelp(strings: HelpStrings = stringsFor("en").help): string[] {
  return [
    strings.title,
    "",
    ...BINDINGS.map(([literal, describe]) => literal.padEnd(KEY_WIDTH) + describe(strings)),
  ];
}
