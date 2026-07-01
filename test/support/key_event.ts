import type { KeyEvent } from "../../src/engine/key_event";

// Shared KeyEvent builder for engine tests. `sequence` is required; `name`
// defaults to it (correct for printables) and must be overridden for control
// keys, e.g. key({ name: "backspace", sequence: "\x7f" }).
export function key(
  over: Partial<KeyEvent> & { sequence: string },
): KeyEvent {
  return {
    name: over.sequence,
    ctrl: false,
    meta: false,
    option: false,
    shift: false,
    eventType: "press",
    ...over,
  };
}
