// Deletion port — the word/line-start count logic from frank_type's
// `app/javascript/lib/typing/deletion.js`, reproduced byte-for-byte.
//
// `previousWordDeletionCount` is verbatim from frank_type (word boundaries are
// read off the TARGET text, not the typed input, so a mistyped word still
// deletes cleanly). `toIndexDeletionCount` mirrors frank_type's
// `session.backspaceToIndex` clamp used for the line-start delete.
//
// The browser `backwardDeletionIntent(event)` is NOT ported here: it keys off
// DOM `metaKey/altKey/ctrlKey`, whose terminal meaning diverges (Alt-Backspace
// surfaces as meta/option in kitty, Cmd-Backspace never reaches a TTY). tuiper
// resolves the terminal keymap in `input_intent` instead; this module keeps the
// pure, width-independent counts the engine applies.

/**
 * How many characters a delete-previous-word removes, ending at `cursor`.
 * Skips trailing whitespace, then the run of non-whitespace before it — exactly
 * frank_type's `previousWordDeletionCount`. `text` is the target excerpt.
 */
export function previousWordDeletionCount(text: string, cursor = text.length): number {
  let index = Math.min(Math.max(cursor, 0), text.length);

  while (index > 0 && isWhitespace(text[index - 1]!)) index -= 1;
  while (index > 0 && !isWhitespace(text[index - 1]!)) index -= 1;

  return cursor - index;
}

/**
 * Characters to delete to reach `index` from `cursor`, clamped to [0, cursor] —
 * mirrors frank_type's `backspaceToIndex`. Used for delete-to-line-start once
 * the shell has resolved the visual line-start index for the terminal width.
 */
export function toIndexDeletionCount(cursor: number, index: number): number {
  const targetIndex = Math.min(Math.max(index, 0), cursor);
  return cursor - targetIndex;
}

function isWhitespace(character: string): boolean {
  return /\s/.test(character);
}
