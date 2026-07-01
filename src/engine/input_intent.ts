import type { KeyEvent } from "./key_event";
import type { Command } from "./command";
import type { SessionState } from "./session_state";

// Pure input-intent mapping: (KeyEvent, sessionState) -> Command.
// This is the correctness-critical decision — it alone decides whether a key
// TYPES into the excerpt or COMMANDS the app. State-gated per the PRD:
//   - Active run: every printable key is typed input; only control keys
//     command (Ctrl-C quit, Backspace delete). Even "q"/"?" are typed here.
// Later states (ready/finished with live hotkeys) extend this switch.

const NONE: Command = { kind: "none" };

export function mapKeyToCommand(key: KeyEvent, state: SessionState): Command {
  // Ignore Kitty key-release events for input (spike gotcha #3).
  if (key.eventType === "release") return NONE;

  // Ctrl-C quits from any state (Ctrl-C is handled manually, not by OpenTUI).
  if (key.ctrl && !key.meta && !key.option && key.name === "c") {
    return { kind: "quit" };
  }

  if (state.status === "active") {
    // Plain Backspace deletes the previous character. Ctrl/Alt-Backspace
    // (delete-word) belongs to the later deletion slice.
    if (isPlainBackspace(key)) return { kind: "deleteChar" };
    if (isPrintable(key)) return { kind: "type", char: key.sequence };
    return NONE;
  }

  return NONE;
}

function isPlainBackspace(key: KeyEvent): boolean {
  return key.name === "backspace" && !key.ctrl && !key.meta && !key.option;
}

function isPrintable(key: KeyEvent): boolean {
  // Modifier combos (Ctrl/Alt) are commands, never typed input. Shift is fine
  // (it produces uppercase). A printable is a single visible character.
  if (key.ctrl || key.meta || key.option) return false;
  if (key.sequence.length !== 1) return false;
  const code = key.sequence.charCodeAt(0);
  return code >= 0x20 && code !== 0x7f;
}
