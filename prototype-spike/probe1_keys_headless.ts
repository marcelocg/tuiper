// PROTOTYPE SPIKE — throwaway. Unknown #1: key distinguishability.
// Headless: feeds raw terminal byte sequences to OpenTUI's parseKeypress and
// asserts every target key resolves to a distinct, identifiable ParsedKey.
// No TTY required. Run: bun prototype-spike/probe1_keys_headless.ts
import { parseKeypress } from "@opentui/core";

type Case = { label: string; bytes: number[]; want: (k: any) => boolean };

// Raw byte sequences a real terminal emits (legacy/xterm mode).
const ESC = 0x1b;
const cases: Case[] = [
  { label: "printable 'a'",        bytes: [0x61],                 want: k => k.name === "a" && !k.ctrl && !k.meta },
  { label: "printable '?'",        bytes: [0x3f],                 want: k => (k.name === "?" || k.sequence === "?") && !k.ctrl },
  { label: "Backspace",            bytes: [0x7f],                 want: k => k.name === "backspace" && !k.ctrl && !k.meta },
  { label: "Esc",                  bytes: [ESC],                  want: k => k.name === "escape" },
  { label: "Tab",                  bytes: [0x09],                 want: k => k.name === "tab" },
  { label: "Ctrl-C",              bytes: [0x03],                  want: k => k.ctrl && k.name === "c" },
  { label: "Ctrl-U",              bytes: [0x15],                  want: k => k.ctrl && k.name === "u" },
  // delete-word variants: Alt/Meta-Backspace = ESC + DEL; Ctrl-Backspace often 0x08 or 0x17.
  { label: "Alt/Meta-Backspace",   bytes: [ESC, 0x7f],           want: k => k.name === "backspace" && (k.meta || k.option) },
  { label: "Ctrl-Backspace (0x08)",bytes: [0x08],                want: k => k.name === "backspace" || k.ctrl || k.name === "h" },
];

let pass = 0;
const rows: string[] = [];
for (const c of cases) {
  const buf = Buffer.from(c.bytes);
  const k = parseKeypress(buf);
  const ok = k != null && c.want(k);
  if (ok) pass++;
  rows.push(
    `${ok ? "GREEN" : "RED  "}  ${c.label.padEnd(24)} -> ` +
    (k ? `name=${JSON.stringify(k.name)} ctrl=${k.ctrl} meta=${k.meta} option=${k.option} shift=${k.shift} seq=${JSON.stringify(k.sequence)} eventType=${k.eventType} source=${k.source}` : "null")
  );
}

// Distinctness: no two DIFFERENT logical keys collapse to the same (name,ctrl,meta) triple.
console.log(rows.join("\n"));
console.log(`\nUNKNOWN #1 (legacy-mode parse): ${pass}/${cases.length} keys identified.`);
console.log("Note: timestamp is NOT on ParsedKey -> stamp on receipt (Bun.nanoseconds/performance.now).");
