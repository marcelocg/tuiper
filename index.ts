#!/usr/bin/env bun
import { runApp, cleanup } from "./src/shell/app";
import { startupGuard } from "./src/engine/terminal";
import { localeFromEnv } from "./src/engine/locale";
import { stringsFor } from "./src/engine/strings";

// Pre-boot capability gate (#13): per-keystroke timing needs a raw-mode TTY, so
// refuse a piped/redirected or raw-mode-less start with a clear message instead
// of booting into a broken input loop. Locale here is env-derived only — this
// fires before the app (and its persisted settings) load. The decision is pure;
// the shell just reads the two impure facts and prints the outcome.
const strings = stringsFor(localeFromEnv(process.env.LANG));
const guard = startupGuard(
  {
    // Both facts are read from stdin — that's the keyboard stream the raw-mode
    // gate protects. (stdout can be a TTY while stdin is a pipe: `echo x | tuiper`.)
    isTTY: Boolean(process.stdin.isTTY),
    canSetRawMode: typeof process.stdin.setRawMode === "function",
  },
  strings.terminal,
);
if (!guard.ok) {
  console.error(guard.message);
  process.exit(1);
}

const renderer = await runApp();
process.on("SIGINT", () => cleanup(renderer));
