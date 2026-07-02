import { RGBA } from "@opentui/core";
import type { CharCell } from "../engine/typing_view";

// Minimal Slate palette for the walking skeleton. The full two-theme system
// (Slate / Rush, runtime-switchable, persisted) is a later slice.
export const slate = {
  pending: RGBA.fromInts(92, 99, 112, 255),
  correct: RGBA.fromInts(126, 200, 130, 255),
  wrong: RGBA.fromInts(232, 96, 96, 255),
  cursorBg: RGBA.fromInts(200, 206, 216, 255),
  cursorFg: RGBA.fromInts(22, 24, 30, 255),
  chrome: RGBA.fromInts(140, 148, 162, 255),
};

export interface Chunk {
  readonly __isChunk: true;
  readonly text: string;
  readonly fg?: RGBA;
  readonly bg?: RGBA;
}

/** Build a styled terminal chunk, centralizing OpenTUI's chunk shape. */
export function chunk(text: string, fg?: RGBA, bg?: RGBA): Chunk {
  return { __isChunk: true, text, fg, bg };
}

/** Map a laid-out CharCell to a colored terminal chunk. */
export function cellToChunk(cell: CharCell): Chunk {
  if (cell.cursor) {
    return chunk(cell.char, slate.cursorFg, slate.cursorBg);
  }
  const fg =
    cell.status === "correct"
      ? slate.correct
      : cell.status === "wrong"
        ? slate.wrong
        : slate.pending;
  return chunk(cell.char, fg);
}
