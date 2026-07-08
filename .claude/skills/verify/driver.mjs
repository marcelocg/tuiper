// Headless ConPTY smoke for the tuiper TUI — the one test above the engine seam.
//
// Allocates an 80x24 pseudo-terminal via node-pty, launches `bun index.ts`,
// feeds a scripted keystroke sequence, captures rendered frames as text, and
// asserts on the panels src/shell/app.ts draws (footer, overlays, typing,
// results). Runs under Node (node-pty is a Node native addon, prebuilt — no
// build step); the child under test runs under Bun inside the PTY, which gives
// it the raw-mode TTY the app's startupGuard requires.
//
// Usage (from this directory):
//   npm install
//   node driver.mjs                 # bun must be on PATH, or:
//   TUIPER_BUN=/path/to/bun.exe node driver.mjs
//
// Exit 0 = PASS (all hard checks + clean app exit). Exit 1 = FAIL.
// Frames + summary.json land in ./frames/ for inspection.
import { spawn } from "node-pty";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = process.env.TUIPER_REPO || resolve(HERE, "..", "..", ".."); // <repo>/.claude/skills/verify → <repo>

// node-pty's Windows ConPTY backend does NOT resolve PATH — it needs an absolute
// path to the executable, or it throws "File not found". Resolve `bun` from PATH
// ourselves (or take TUIPER_BUN verbatim).
function resolveBun() {
  if (process.env.TUIPER_BUN) return process.env.TUIPER_BUN;
  const exe = process.platform === "win32" ? "bun.exe" : "bun";
  for (const dir of (process.env.PATH || "").split(delimiter)) {
    if (dir && existsSync(join(dir, exe))) return join(dir, exe);
  }
  return exe; // fall back — node-pty will surface a clear error if unfound
}
const BUN = resolveBun();
const OUT = join(HERE, "frames");
// Isolated, empty data dir so boot is deterministic: no persisted settings
// (locale/theme) and no history leak between runs. dataDir() reads %APPDATA% on
// Windows and $XDG_DATA_HOME elsewhere — override both. Fresh each run → boot is
// en (from LANG) + slate (default theme) + "No sessions yet".
const DATA = join(HERE, "_data");
for (const d of [OUT, DATA]) {
  try {
    rmSync(d, { recursive: true, force: true });
  } catch {}
  mkdirSync(d, { recursive: true });
}

// --- strip OSC/DCS/CSI/control codes so assertions run on the visible text ---
const strip = (s) =>
  s
    .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b[PX^_][\s\S]*?\x1b\\/g, "")
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b[@-Z\\-_]/g, "")
    .replace(/[\x00-\x08\x0b-\x1f]/g, ""); // keep \n (0x0a)

let raw = "";
let mark = 0;
const frames = [];
const checks = [];

const pty = spawn(BUN, ["index.ts"], {
  name: "xterm-256color",
  cols: 80,
  rows: 24,
  cwd: REPO,
  env: {
    ...process.env,
    COLORTERM: "truecolor",
    LANG: "en_US.UTF-8",
    APPDATA: DATA,
    XDG_DATA_HOME: DATA,
  },
});
pty.onData((d) => {
  raw += d;
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const press = async (bytes, ms = 600) => {
  pty.write(bytes);
  await sleep(ms);
};
const snap = (label) => {
  const delta = strip(raw.slice(mark));
  mark = raw.length;
  const all = strip(raw);
  frames.push(label);
  try {
    writeFileSync(join(OUT, `${label}.txt`), delta);
  } catch {}
  return all;
};
// Checks run against the FULL accumulated text (panels are fully painted on
// first draw; cell-diff deltas alone can be partial). hard=false → soft (noted,
// never fails) for change-deltas the renderer may only partially re-emit.
const want = (label, hay, needle, hard = true) =>
  checks.push({ label, needle, ok: hay.includes(needle), hard });

const ESC = "\x1b";
const TAB = "\t";

const done = (tag, exitCode) => {
  const hardFails = checks.filter((c) => c.hard && !c.ok);
  const verdict = tag === "appExit" && exitCode === 0 && hardFails.length === 0 ? "PASS" : "FAIL";
  writeFileSync(
    join(OUT, "summary.json"),
    JSON.stringify(
      { verdict, tag, exitCode, rawBytes: raw.length, frames, checks },
      null,
      2,
    ),
  );
  writeFileSync(join(OUT, "_final.txt"), strip(raw));
  const line = (c) => `${c.ok ? "PASS" : c.hard ? "FAIL" : "soft"}  ${c.label}: "${c.needle}"`;
  console.log(`VERDICT ${verdict}  (exit=${exitCode}, tag=${tag}, ${raw.length}B)`);
  console.log(checks.map(line).join("\n"));
  try {
    pty.kill();
  } catch {}
  process.exit(verdict === "PASS" ? 0 : 1);
};
pty.onExit(({ exitCode }) => done("appExit", exitCode));
const HARD_CAP = setTimeout(() => done("timeout", "none"), 60000);

(async () => {
  // 1. boot → ready frame (deterministic: en + slate + no history)
  await sleep(2600);
  let f = snap("01-ready");
  want("boot-theme", f, "Theme");
  want("boot-themeName", f, "slate");
  want("boot-ready", f, "ready");
  want("boot-locale-en", f, "Locale en");
  // The full key-hint tail ("Tab next · ? help · …") overflows 80 cols and is
  // truncated at the min width — assert the part that fits (the duration gate).
  want("boot-footer", f, "1/2/3 duration");

  // 2. ready-state hotkey tour (duration/category/theme/locale are change-deltas → soft)
  f = await press("3").then(() => snap("02-dur60"));
  want("dur-60", f, "60s", false);
  f = await press("1").then(() => snap("03-dur15"));
  want("dur-15", f, "15s", false);
  f = await press("c").then(() => snap("04-scifi"));
  want("cat-scifi", f, "scifi", false);
  f = await press("t").then(() => snap("05-rush"));
  want("theme-rush", f, "rush", false);
  f = await press("l").then(() => snap("06-ptbr"));
  want("locale-ptbr", f, "pt-BR", false);
  await press("l"); // back to en for readable results assertions
  snap("07-en");

  // 3. overlays (full panels → hard). open, capture, Esc to close.
  f = await press("p").then(() => snap("08-profile"));
  want("overlay-profile", f, "Profile");
  await press(ESC);
  f = await press("s").then(() => snap("09-sources"));
  want("overlay-sources", f, "Sources");
  await press(ESC);
  f = await press("?").then(() => snap("10-help"));
  want("overlay-help", f, "Keybindings");
  await press(ESC);

  // 4. next excerpt, then type → active run (feedback + race strip)
  await press(TAB);
  snap("11-next");
  await press("1"); // 15s so the run finishes quickly
  f = await press("the quick brown fox jumps", 900).then(() => snap("12-typing"));
  want("typing-active", f, "typing");

  // 5. let the timer expire → results panel (metrics + heat map)
  await sleep(16000);
  f = snap("13-results");
  want("results-wpm", f, "WPM");
  want("results-accuracy", f, "Accuracy");
  want("results-completion", f, "Completion");

  // 6. quit — onExit fires done("appExit", 0)
  clearTimeout(HARD_CAP);
  await press("q", 1500);
  done("noExitAfterQuit", "none"); // only reached if the app failed to exit
})();
