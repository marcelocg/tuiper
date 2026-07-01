# OpenTUI Spike — Verdicts (throwaway prototype)

**Question:** Does OpenTUI (`@opentui/core`) support the 5 runnable unknowns needed for the tuiper typing TUI, and how?
**Env:** Bun 1.3.14, `@opentui/core@0.4.2`, native `@opentui/core-win32-x64/opentui.dll` (auto-installed optionalDependency; **no build step**; darwin/linux/win + x64/arm64 all shipped). Runtime = Bun (uses FFI into a Zig shared lib).

**Boot pattern:**
```ts
const renderer = await createCliRenderer({ targetFps: 10, useKittyKeyboard: {}, exitOnCtrlC: false });
renderer.keyInput.on("keypress", (e) => { const t = performance.now(); /* stamp on receipt */ });
renderer.keyInput.on("paste", (e) => { /* discard e.bytes */ });
renderer.on("resize", (cols, rows) => { /* re-wrap */ });
renderer.setFrameCallback(async (dt) => { /* 100ms tick */ });
renderer.start();
```

## Scorecard — ALL 5 GREEN

| # | Unknown | Verdict | API | Evidence |
|---|---------|---------|-----|----------|
| 1 | Per-keystroke + timestamp | 🟢 GREEN | `renderer.keyInput` (KeyHandler) `on("keypress", e=>)`; `KeyEvent{name,ctrl,meta,option,shift,eventType,source,repeated,baseCode}` | `probe1_keys_headless.ts` 9/9 keys; `probe1b_kitty.ts` resolves Backspace-family |
| 2 | Per-cell truecolor | 🟢 GREEN | `StyledText`(TextChunk[] each w/ own `fg`+`bg` RGBA); low-level `OptimizedBuffer.setCell(x,y,ch,fg,bg)` | `probe2_truecolor_headless.ts` — read raw fg/bg arrays back, 3 cells distinct 24-bit |
| 3 | 100ms loop, no flicker | 🟢 GREEN | `createCliRenderer({targetFps})`, `setFrameCallback(dt=>)`, `requestRender()`, `start/stop` | native double-buffer + cell diff (only changed cells emitted) |
| 4 | Bracketed paste discard | 🟢 GREEN | separate `on("paste", e=>e.bytes)` event; paste body NEVER emitted as keypress | built-in `?2004h`; StdinParser out-of-band collect (handles chunk-split markers) |
| 5 | Resize | 🟢 GREEN | `on("resize", (cols,rows)=>)`; SIGWINCH auto-registered; `resize(w,h)` programmatic | debounced 100ms; Yoga re-layout |

## Timestamp answer (#1 detail)
`KeyEvent`/`ParsedKey` carries **NO timestamp field**. Stamp on receipt with `performance.now()` / `Bun.nanoseconds()` as the first line of the `keypress` handler — functionally equal to browser `keydown`+`performance.now()`. Confirms handoff design decision #3. Input is per-keystroke (raw mode + byte state machine), NOT line-buffered, NOT batched at human speed.

## Gotchas (adapt in PRD)
1. **Ctrl-Backspace collision (delete-word):** in *legacy* mode plain Backspace (0x7f) and Ctrl-Backspace (0x08) both parse to `name:"backspace", ctrl:false` — indistinguishable. **Fix: enable `useKittyKeyboard`** → Ctrl-Backspace gets `ctrl:true`, Alt-Backspace gets `meta/option:true`. Verified in `probe1b_kitty.ts`. Fallback for non-kitty terminals: treat 0x17 (Ctrl-W) / Alt-Backspace as delete-word.
2. **Esc is delayed ~20ms** (`DEFAULT_TIMEOUT_MS`, stdin-parser) to disambiguate lone-Esc from escape sequences. Esc = restart/close-overlay in our keymap → not on a timing-critical path, fine. Configurable.
3. **Kitty release events:** with `useKittyKeyboard`, `keyrelease` fires and `keypress` also carries `eventType:"release"` — filter to `eventType!=="release"` for typing input (probe3 does this).
4. **Color fallback is 256-color only.** truecolor → nearest `38;5;n` when `!caps.rgb && caps.ansi256`. 16-color terminals are NOT gracefully mapped — matches handoff floor (truecolor preferred, 256 fallback, else degrade). `ansi256IndexToRgb` / `RGBA.fromIndex` + `CliRenderEvents.CAPABILITIES` available for detection.
5. **Ctrl-C not auto-handled** unless `exitOnCtrlC:true` (default). We set `false` and handle quit ourselves (keymap: q / Ctrl-C).
6. **Bundler cross-platform noise:** `bun build` errors on un-installed other-OS optional deps (`core-linux-x64` etc.) — harmless; runtime dynamically loads the correct platform pkg. Confirmed by native FFI executing in headless probes.

## EXIT CRITERIA: all 5 green → proceed to PRD. OpenTUI validated.

## Files (delete after PRD absorbs the decision)
- `probe1_keys_headless.ts` — headless, RAN, 9/9 key discrimination (legacy mode)
- `probe1b_kitty.ts` — headless, RAN, kitty mode disambiguates Backspace family + release events
- `probe2_truecolor_headless.ts` — headless, RAN, per-cell 24-bit fg+bg proven via buffer read-back
- `probe3_interactive.ts` — **run in a real terminal** to eyeball #1 live timing, #3 flicker, #4 paste, #5 resize
