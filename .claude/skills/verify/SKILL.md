---
name: verify
description: Run / smoke / verify / screenshot the tuiper TUI headlessly. Drives the real app in a pseudo-terminal via node-pty and asserts on rendered frames — the one test above the engine seam. Use to verify a change to src/shell/app.ts or any end-to-end behavior.
---

# Verify tuiper (headless TUI smoke)

tuiper is a Bun + `@opentui/core` terminal app whose entry `index.ts` refuses a
non-TTY start (`startupGuard`) and then renders an interactive full-screen UI.
Unit tests (`bun test`, 267 cases) cover everything **below** the engine seam;
nothing exercises `src/shell/app.ts` — the OpenTUI wiring. **`driver.mjs` is that
missing test:** it allocates an 80×24 pseudo-terminal with `node-pty`, launches
`bun index.ts` inside it (the PTY supplies the raw-mode TTY the guard needs),
feeds a scripted keystroke sequence, and asserts on the panels the shell paints.

Paths below are relative to the repo root.

## Prerequisites

- **Bun** (runs the app under test). Not required on PATH — the driver resolves
  it from PATH, or set `TUIPER_BUN` to the absolute path
  (`C:\Users\49768117\.bun\bin\bun.exe` on this machine).
- **Node** (runs the driver; `node-pty` is a Node native addon). Node 26 verified.
- `node-pty@^1.1.0` — installs a **prebuilt** binary (prebuildify); **no**
  Visual Studio / node-gyp build needed. `npm`'s allow-scripts warning is
  harmless: the module loads from `prebuilds/` regardless.

## Run (agent path) — the driver

```bash
cd .claude/skills/verify
npm install
node driver.mjs          # bun on PATH; or: TUIPER_BUN="C:/Users/49768117/.bun/bin/bun.exe" node driver.mjs
```

Exit **0 = PASS**, **1 = FAIL**. It prints a per-check table and writes evidence
to `.claude/skills/verify/frames/`:

- `frames/NN-<label>.txt` — the cleaned (ANSI-stripped) delta captured at each step
- `frames/_final.txt` — the full cleaned frame stream
- `frames/summary.json` — verdict + every check

What it drives and asserts (hard checks unless noted):

1. **Boot** → `ready` frame: footer shows `Theme slate`, `Locale en`, the
   `1/2/3 duration` gate; header `ready`.
2. **Hotkey tour** (ready state): `3`/`1` duration, `c`→`scifi`, `t`→`rush`,
   `l`→`pt-BR` then back. (Duration/category deltas are **soft** — see gotchas.)
3. **Overlays**: `p`→`Profile`, `s`→`Sources`, `?`→`Keybindings` (each opened,
   captured, `Esc`-closed).
4. **Typing**: `Tab` new excerpt, `1` (15s), type a sample → header `typing`.
5. **Results**: wait out the 15s timer → results panel with `WPM` / `Accuracy` /
   `Completion` (+ heat map).
6. **Quit**: `q` → the app exits 0.

Runtime ≈ 30s (dominated by the 15s drill). Edit the `press(...)` sequence in
`driver.mjs` to drive a different flow.

## Quick pre-check (no harness): the non-TTY guard

Reachable from any shell — verifies `index.ts` → `startupGuard` (PRD story 51):

```bash
printf '' | "C:/Users/49768117/.bun/bin/bun.exe" index.ts   # from repo root
# → prints "tuiper needs an interactive terminal (TTY)..." and exits 1
```

## Gotchas (learned building this)

- **node-pty needs an ABSOLUTE exe path on Windows.** Its ConPTY backend does
  not resolve PATH — passing `"bun"` throws `Error: File not found`. The driver
  resolves `bun` from PATH itself (`resolveBun()`); `TUIPER_BUN` overrides.
- **Isolate the data dir or boot is non-deterministic.** The app persists
  `settings.json` (theme + locale) under `%APPDATA%\tuiper` / `$XDG_DATA_HOME`.
  A prior `l` toggle makes the next boot come up in **pt-BR**, breaking en
  assertions. The driver points `APPDATA` + `XDG_DATA_HOME` at a fresh
  `./_data` each run → deterministic `en` + `slate` + "No sessions yet".
- **Assert on the full accumulated frame, not per-key deltas.** OpenTUI emits
  cell **diffs**, so a footer change like `30s`→`15s` re-emits only the changed
  cells — the delta may not contain the whole word. Panels (overlays, results)
  are fully painted on first draw, so those substrings are reliable; duration/
  category change-checks are marked **soft**.
- **The footer hint bar overflows 80 cols and is truncated** at the documented
  minimum width — `Tab next · ? help · …` is clipped, so it's a bad assertion
  anchor (and a real minor UX note: at 80×24 the full hint line isn't visible).
- **Kitty keyboard**: the app enables `useKittyKeyboard`, but ConPTY isn't a
  kitty terminal, so OpenTUI falls back to legacy encoding — plain byte writes
  (`\x1b` Esc, `\t` Tab, `\x7f` Backspace) reach it fine.
- **Driver runs under Node; the app under Bun** (node-pty is a Node addon). The
  child inherits the PTY, not the Node runtime.

## Troubleshooting

- `Error: File not found` from `windowsPtyAgent.js` → bun path didn't resolve;
  set `TUIPER_BUN` to the absolute `bun.exe`.
- Boot assertions fail with pt-BR words (`Tema`, `pronto`) → the `_data`
  isolation didn't take; confirm `APPDATA`/`XDG_DATA_HOME` are being set (a real
  `%APPDATA%\tuiper\settings.json` is leaking in).
- Hang (no exit) → `node-pty` keeps the loop alive; the driver has a 60s hard cap
  and force-kills, but if you edit it, always `pty.kill()` + `process.exit()`.

## Human path

`bun run index.ts` in a real ≥80×24 terminal. Useless headless (needs a TTY) —
that's exactly why the driver exists.

## Below the seam (not a substitute)

`bun test` + `bun run typecheck` cover the pure engine/mappers. They are CI's
job; they do not exercise `app.ts`. This driver does.
