// Engine-local key event shape. A structural subset of OpenTUI's `ParsedKey`
// so the shell can pass its `KeyEvent` straight through, while the engine
// stays free of any OpenTUI/TTY import (the primary test seam).
export interface KeyEvent {
  /** Key name, e.g. "a", "space", "backspace", "c". */
  readonly name: string;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly option: boolean;
  readonly shift: boolean;
  /** Raw character(s) produced by the key; the glyph to type for printables. */
  readonly sequence: string;
  /** Kitty protocol event type; absent in legacy mode (treated as "press"). */
  readonly eventType?: "press" | "repeat" | "release";
}
