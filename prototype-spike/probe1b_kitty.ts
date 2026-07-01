// PROTOTYPE SPIKE — throwaway. Unknown #1 follow-up: kitty keyboard protocol
// disambiguates the Backspace-family collision seen in legacy mode.
// Kitty CSI-u: ESC [ <keycode> ; <1+modbitmask> u   (shift=1 alt=2 ctrl=4)
import { parseKeypress } from "@opentui/core";

const seqs: { label: string; seq: string }[] = [
  { label: "Backspace (kitty)",       seq: "\x1b[127u" },
  { label: "Ctrl-Backspace (kitty)",  seq: "\x1b[127;5u" },
  { label: "Alt-Backspace (kitty)",   seq: "\x1b[127;3u" },
  { label: "'a' press (kitty)",       seq: "\x1b[97u" },
  { label: "'a' RELEASE (kitty)",     seq: "\x1b[97;1:3u" }, // :3 = release event
  { label: "'a' REPEAT (kitty)",      seq: "\x1b[97;1:2u" }, // :2 = repeat event
];

for (const s of seqs) {
  const k = parseKeypress(s.seq, { useKittyKeyboard: true });
  console.log(
    `${s.label.padEnd(22)} -> ` +
    (k ? `name=${JSON.stringify(k.name)} ctrl=${k.ctrl} meta=${k.meta} option=${k.option} shift=${k.shift} eventType=${k.eventType} baseCode=${k.baseCode} source=${k.source}` : "null")
  );
}
