import type { KeyEvent } from "./key_event";
import type { Command } from "./command";
import { sessionStatus, type SessionState } from "./session_state";
import { isScrollableOverlay, type Overlay } from "./overlay";

// Pure input-intent mapping: (KeyEvent, inputState) -> Command.
// This is the correctness-critical decision — it alone decides whether a key
// TYPES into the excerpt or COMMANDS the app. State-gated per the PRD:
//   - Overlay:  keys never reach the session. Ctrl-C quits; nav keys scroll a
//               scrollable overlay; anything else dismisses it.
//   - Ready:    hotkeys live. 1/2/3 pick the duration; any other printable is
//               the first keystroke (it starts the run and types).
//   - Active:   every printable key is typed input; only control keys command
//               (Ctrl-C quit, Backspace delete). Even "q"/"?"/"1" are typed.
//   - Finished: nothing types; duration re-selection waits for restart (later
//               slice). Only Ctrl-C responds.

const NONE: Command = { kind: "none" };

/** Everything the mapper needs to resolve a key. `pageSize` is the shell's
 *  layout fact (the overlay's page-scroll step) — data in, so the mapper can
 *  emit a fully resolved scroll delta and stay pure. */
export interface InputState {
  readonly state: SessionState;
  readonly overlay: Overlay | null;
  /** Lines a PageUp/PageDown scrolls within an overlay. */
  readonly pageSize: number;
}

export function mapKeyToCommand(key: KeyEvent, input: InputState): Command {
  // Ignore Kitty key-release events for input (spike gotcha #3).
  if (key.eventType === "release") return NONE;

  // An overlay swallows every key — the session never sees them.
  if (input.overlay) return overlayCommand(key, input);

  // Ctrl-C quits from any state (Ctrl-C is handled manually, not by OpenTUI).
  if (isCtrlC(key)) {
    return { kind: "quit" };
  }

  // Tab is a control key in every state (PRD: live even mid-run) — it loads the
  // next excerpt. Excerpts are normalized to spaces, so Tab is never content.
  if (isTab(key)) return { kind: "nextExcerpt" };

  if (sessionStatus(input.state) === "active") {
    // Deletion family. Plain Backspace deletes the previous character;
    // Ctrl/Alt-Backspace deletes the previous word; Ctrl-U deletes to line
    // start. In kitty mode Ctrl-Backspace carries `ctrl` and Alt-Backspace
    // `meta`/`option`, so they're distinguishable from plain Backspace; in
    // legacy mode both collapse to plain Backspace, so Ctrl-W is the
    // delete-word fallback (spike gotcha #1). `c` here is typed input, not a
    // category hotkey — mid-run every printable types.
    if (isBackspace(key)) {
      return hasDeleteModifier(key) ? { kind: "deleteWord" } : { kind: "deleteChar" };
    }
    if (isCtrlChord(key, "u")) return { kind: "deleteToLineStart" };
    if (isCtrlChord(key, "w")) return { kind: "deleteWord" }; // legacy fallback
    if (isPrintable(key)) return { kind: "type", char: key.sequence };
    return NONE;
  }

  // Ready / Finished: `q` quits (mid-run it's typed, handled above); `c` cycles
  // the category filter (then reloads an excerpt); `t` toggles the theme; `l`
  // toggles the UI locale (re-filters the corpus); `p`/`?`/`s` open the profile,
  // help, and sources overlays respectively (shell overlays over the session).
  if (isQuitHotkey(key)) return { kind: "quit" };
  if (isCategoryHotkey(key)) return { kind: "cycleCategory" };
  if (isThemeHotkey(key)) return { kind: "toggleTheme" };
  if (isLocaleHotkey(key)) return { kind: "toggleLocale" };
  if (isProfileHotkey(key)) return { kind: "openProfile" };
  if (isHelpHotkey(key)) return { kind: "openHelp" };
  if (isSourcesHotkey(key)) return { kind: "openSources" };

  // Ready: hotkeys are live. 1/2/3 pick the duration; any other printable is
  // the first keystroke, which starts (and types into) the run. Duration is
  // only selectable here — a finished run has no restart yet (later slice), so
  // changing it post-run would only falsify the results banner.
  if (sessionStatus(input.state) === "ready") {
    const seconds = durationHotkey(key);
    if (seconds !== null) return { kind: "setDuration", seconds };
    if (isPrintable(key)) return { kind: "type", char: key.sequence };
  }

  // Finished: only Ctrl-C, Tab, and `c` (handled above) do anything until
  // restart lands.
  return NONE;
}

/**
 * Keys while an overlay is up. Kitty release/repeat events are both ignored —
 * unlike the session, which types on repeat — so holding the key that opened the
 * overlay can't immediately close it. Note the ordering: `repeat` is dropped
 * BEFORE the Ctrl-C check, so a repeat Ctrl-C inside an overlay does nothing.
 * Nav keys are consumed by a scrollable overlay even when its content fits, so
 * they never fall through and close it.
 */
function overlayCommand(key: KeyEvent, input: InputState): Command {
  if (key.eventType === "repeat") return NONE;
  if (isCtrlC(key)) return { kind: "quit" };

  if (isScrollableOverlay(input.overlay)) {
    const delta = scrollDelta(key, input.pageSize);
    if (delta !== 0) return { kind: "scrollOverlay", delta };
  }
  // Esc, q, or any other key dismisses. Profile is a fixed layout, so every key
  // lands here.
  return { kind: "closeOverlay" };
}

/** Signed scroll step a key requests within a scrollable overlay (0 = none). */
function scrollDelta(key: KeyEvent, pageSize: number): number {
  switch (key.name) {
    case "up":
      return -1;
    case "down":
      return 1;
    case "pageup":
      return -pageSize;
    case "pagedown":
      return pageSize;
    default:
      if (key.sequence === "k") return -1;
      if (key.sequence === "j") return 1;
      return 0;
  }
}

/** Ctrl-C (no other modifiers) — quits from any state. */
function isCtrlC(key: KeyEvent): boolean {
  return key.ctrl && !key.meta && !key.option && key.name === "c";
}

/** 1 / 2 / 3 select the 15 / 30 / 60-second drill length (no modifiers). */
function durationHotkey(key: KeyEvent): number | null {
  if (key.ctrl || key.meta || key.option) return null;
  switch (key.sequence) {
    case "1":
      return 15;
    case "2":
      return 30;
    case "3":
      return 60;
    default:
      return null;
  }
}

function isTab(key: KeyEvent): boolean {
  return key.name === "tab" && !key.ctrl && !key.meta && !key.option;
}

/** `c` (no modifiers) cycles the excerpt category. Ctrl-C is caught earlier. */
function isCategoryHotkey(key: KeyEvent): boolean {
  return key.sequence === "c" && !key.ctrl && !key.meta && !key.option;
}

/** `t` (no modifiers) toggles the theme. Mid-run it's typed, not a hotkey. */
function isThemeHotkey(key: KeyEvent): boolean {
  return key.sequence === "t" && !key.ctrl && !key.meta && !key.option;
}

/** `l` (no modifiers) toggles the UI locale. Mid-run it's typed, not a hotkey. */
function isLocaleHotkey(key: KeyEvent): boolean {
  return key.sequence === "l" && !key.ctrl && !key.meta && !key.option;
}

/** `p` (no modifiers) opens the profile screen. Mid-run it's typed, not a hotkey. */
function isProfileHotkey(key: KeyEvent): boolean {
  return key.sequence === "p" && !key.ctrl && !key.meta && !key.option;
}

/** `?` (no modifiers) opens the help overlay. Mid-run it's typed, not a hotkey. */
function isHelpHotkey(key: KeyEvent): boolean {
  return key.sequence === "?" && !key.ctrl && !key.meta && !key.option;
}

/** `s` (no modifiers) opens the sources screen. Mid-run it's typed, not a hotkey. */
function isSourcesHotkey(key: KeyEvent): boolean {
  return key.sequence === "s" && !key.ctrl && !key.meta && !key.option;
}

/** `q` (no modifiers) quits from ready/finished. Mid-run it's typed input. */
function isQuitHotkey(key: KeyEvent): boolean {
  return key.sequence === "q" && !key.ctrl && !key.meta && !key.option;
}

function isBackspace(key: KeyEvent): boolean {
  return key.name === "backspace";
}

/** Ctrl/Alt(/Cmd)-Backspace → delete-word; any of these modifiers qualifies. */
function hasDeleteModifier(key: KeyEvent): boolean {
  return key.ctrl || key.meta || key.option;
}

/** A bare Ctrl-<letter> chord (no Alt/Cmd), e.g. Ctrl-U / Ctrl-W. */
function isCtrlChord(key: KeyEvent, name: string): boolean {
  return key.ctrl && !key.meta && !key.option && key.name === name;
}

function isPrintable(key: KeyEvent): boolean {
  // Modifier combos (Ctrl/Alt) are commands, never typed input. Shift is fine
  // (it produces uppercase). A printable is a single visible character.
  if (key.ctrl || key.meta || key.option) return false;
  if (key.sequence.length !== 1) return false;
  const code = key.sequence.charCodeAt(0);
  return code >= 0x20 && code !== 0x7f;
}
