# PRD — tuiper: a terminal typing trainer

**One-line:** A terminal (TUI) clone of [frank_type](https://github.com/akitaonrails/frank_type), reproducing its typing-practice behavior exactly (byte-identical metrics) with a native terminal presentation, built in TypeScript on Bun using OpenTUI.

**Provenance:** Ported from Fabio Akita's frank_type (MIT, © 2026 Fabio Akita). tuiper ships MIT, retains Akita's copyright, credits frank_type. Corpus is public-domain prose.

**Status of prerequisites:** OpenTUI validated by a throwaway spike — all 5 runtime unknowns green (see `prototype-spike/NOTES.md`). Design settled across 21 decisions in a grilling session. This PRD synthesizes both.

---

## Problem Statement

A person practicing touch-typing wants the frank_type experience — timed drills on curated public-domain prose, honest WPM/accuracy metrics, a digraph heat map that shows which key-pairs slow them down, adaptive difficulty, and a race against pace-setters — **without leaving the terminal**. frank_type is a web app (Rails + browser); it needs a browser tab, doesn't fit a terminal-centric workflow, and carries web/server/desktop machinery irrelevant to someone who lives in a shell. There is no faithful terminal equivalent that preserves frank_type's exact metrics and feedback model.

## Solution

**tuiper** — a single-binary terminal app that reproduces frank_type's typing trainer:

- Timed sessions (15/30/60s) on the same curated corpus (English + Brazilian Portuguese), with the timer starting on first keystroke and auto-finishing at zero.
- The **same metric engine, byte-for-byte**: WPM, raw WPM, accuracy, mistakes, completion, per-character/word timings, and the digraph latency analysis — all computed with frank_type's exact formulas and constants.
- A **post-run digraph heat map** rendered natively as truecolor cell backgrounds (intensity = heat), plus the top-slow-pairs list.
- **Adaptive excerpt selection** banded on the average WPM of the last five sessions.
- A live **race strip** against a slow (60 WPM) and fast (140 WPM) pace-setter.
- A **profile screen** with braille line charts of WPM and accuracy trends over stored history.
- Two **themes** (Slate, Rush) and two **UI locales** (EN, pt-BR), switchable at runtime and persisted.
- **Local-first, no accounts, no server, no network.** History and preferences live in local JSON files.

The value of frank_type is its timing/metrics engine; tuiper preserves that exactly and reinterprets the visuals with the closest terminal-native primitives.

## User Stories

### Typing a session
1. As a typist, I want a timed drill of 15, 30, or 60 seconds, so that I can practice in bounded bursts.
2. As a typist, I want 30 seconds to be the default duration, so that I can start immediately without configuring.
3. As a typist, I want the timer to start on my first keystroke (not on load), so that setup time doesn't count against my WPM.
4. As a typist, I want a live countdown of remaining seconds, so that I know how much time is left.
5. As a typist, I want the session to end automatically when the timer reaches zero, so that I don't have to stop it manually.
6. As a typist, I want the excerpt text displayed with each character colored by state — pending (dim), correct (bright/green), wrong (red) — so that I can see my accuracy as I type.
7. As a typist, I want a wrong keystroke to color the *expected* character red without shifting the layout, so that the text never reflows and I stay oriented.
8. As a typist, I want a visible cursor block at my current position, so that I know which character I'm on.
9. As a typist, I want long excerpts to word-wrap to my terminal width and the view to scroll as I advance, so that I can always see where I am.
10. As a typist, I want to press Backspace to delete the previous character, so that I can correct a single mistake.
11. As a typist, I want to delete the previous whole word in one action, so that I can correct a mistyped word quickly.
12. As a typist, I want to delete back to the start of the line in one action, so that I can restart a line fast.
13. As a typist, I want pasted text to be rejected, so that I can't accidentally (or deliberately) fake a perfect run.
14. As a typist, I want to type any printable character — including digits and punctuation that are also menu hotkeys — while a run is active, so that the excerpt content is never blocked by shortcuts.

### Metrics and results
15. As a typist, I want my WPM computed as correct characters ÷ 5 over elapsed minutes, so that my score matches frank_type exactly.
16. As a typist, I want a raw WPM (all typed characters, including errors), so that I can compare gross vs. net speed.
17. As a typist, I want an accuracy percentage, so that I know how clean my typing was.
18. As a typist, I want a mistake count, so that I know how many wrong keystrokes I made.
19. As a typist, I want a completion percentage, so that I know how much of the excerpt I covered.
20. As a typist, I want per-character and per-word timings captured, so that fine-grained analysis is possible.
21. As a typist, I want a results screen after each run summarizing all metrics, so that I can review my performance.

### Digraph heat map
22. As a typist, I want a post-run heat map of my slowest adjacent character-pairs, so that I can see which transitions slow me down.
23. As a typist, I want the heat map to appear only after finishing (never during typing), so that it doesn't distract me mid-run.
24. As a typist, I want the slow pairs highlighted in the replayed text with color intensity proportional to slowness, so that I can spot problem clusters visually.
25. As a typist, I want a short ranked list of my top slowest pairs with their latencies, so that I have concrete pairs to practice.
26. As a typist, I want digraph timing measured press-to-press, excluding pairs interrupted by a correction and filtering implausible latencies, so that the analysis reflects genuine typing flow.

### Adaptive difficulty
27. As a typist, I want the app to pick excerpts matched to my recent speed, so that the difficulty tracks my ability.
28. As a returning typist, I want my speed band derived from the average WPM of my last five sessions, so that recent form drives selection.
29. As a first-time typist with no history, I want to start on the slow band, so that I'm not thrown into fast material.
30. As a typist, I want a fresh excerpt each time (not an immediate repeat), so that I don't drill the same text twice in a row.

### Race strip
31. As a typist, I want a live race against a slow (60 WPM) and fast (140 WPM) pace-setter plus my own marker, so that I have something to chase.
32. As a typist, I want the racers to advance smoothly during the run, so that the competition feels live.

### Excerpts and content
33. As a typist, I want to load a different random excerpt on demand, so that I can skip material I don't want.
34. As a typist, I want to filter excerpts by category (sci-fi, fantasy, biography) or pick randomly, so that I can practice on preferred genres.
35. As a typist, I want the corpus to include the same curated English and Brazilian-Portuguese prose as frank_type, so that content quality and tuning match.
36. As a Brazilian-Portuguese typist, I want accents and diacritics preserved in pt-BR excerpts, so that I practice real Portuguese.
37. As an English typist, I want English text normalized to ASCII, so that I'm not tripped by exotic glyphs.

### Profile and history
38. As a returning typist, I want my finished sessions saved locally, so that I can track progress over time.
39. As a returning typist, I want a profile screen with a WPM trend chart, so that I can see whether I'm improving.
40. As a returning typist, I want an accuracy trend chart, so that I can see whether I'm getting cleaner.
41. As a returning typist, I want summary stats (best, average, recent), so that I have headline numbers at a glance.
42. As a long-term typist, I want old sessions compacted into daily summaries beyond a recent-detail window, so that history stays useful without growing unbounded.

### Interface, themes, locale
43. As a typist, I want a help overlay listing all keybindings, so that I can learn the controls.
44. As a typist, I want to switch between two color themes at runtime, so that I can pick what I like.
45. As a typist, I want to switch the UI language between English and Brazilian Portuguese, so that I can use my language.
46. As a typist, I want my theme, locale, last duration, and category remembered between runs, so that I don't reconfigure each launch.
47. As a typist, I want a sources screen listing the attribution for each excerpt, so that I can see the public-domain provenance.
48. As a typist, I want a footer showing current duration, category, theme, and locale plus key hints, so that state and controls are always visible.

### Robustness and distribution
49. As a typist on a small terminal, I want a clear "terminal too small" message below a minimum size, so that I'm not shown a broken layout.
50. As a typist on a terminal without truecolor, I want colors to degrade to 256-color, so that the app still looks reasonable.
51. As a typist launching in a non-TTY or dumb terminal, I want a clear error explaining raw-mode input is required, so that I understand why it won't run.
52. As a user, I want to install tuiper as a self-contained binary for my OS, so that I don't need to install a runtime.
53. As a developer, I want to install tuiper from npm and run it via the CLI, so that I can use my existing toolchain.
54. As a user, I want to quit cleanly with `q` or Ctrl-C, so that I can exit without a stuck terminal.

## Implementation Decisions

### Runtime and framework
- **Language/runtime:** TypeScript on **Bun**. UI via **OpenTUI** (`@opentui/core`, validated at 0.4.2).
- **Renderer boot (from spike):** `createCliRenderer({ targetFps: 10, useKittyKeyboard: {}, exitOnCtrlC: false })`, then subscribe `keyInput.on("keypress")`, `keyInput.on("paste")`, `on("resize")`, drive animation via `setFrameCallback`, and `start()`. `targetFps: 10` gives the ~100ms tick frank_type uses; the native renderer double-buffers and diffs cells (no flicker).

### Architecture and seams
- **One primary test seam: the engine boundary.** All ported logic is pure TypeScript (data in → data out, no OpenTUI/TTY/fs). The OpenTUI shell above it is thin wiring.
- **Modules ported ~1:1** from frank_type `app/javascript/lib`: `typing/metrics`, `typing/session_state`, `typing/speed_band`, `typing/race_progress`, `typing/deletion`, and the digraph summarization (in `metrics`). `services/typing/text_normalizer.rb` is ported from Ruby to TS. `storage/session_store` is ported with its compaction logic intact.
- **Input-intent mapping is a pure function below the seam:** `(KeyEvent, sessionState) → Command`. It encodes the state-gated input rule and the delete-mode resolution; it never touches OpenTUI. This keeps the correctness-critical decision logic testable.
- **View mapping is pure where practical:** `(viewModel) → cells/StyledText`, so screens can be rendered to an in-memory buffer and asserted.
- **Storage is an injected port:** the store logic depends on a read/write-JSON interface, not `fs` directly. Real app injects a file adapter; tests inject an in-memory fake.

### Session engine (exact behavior)
- Timer starts on first `type`. Elapsed excludes paused time. Auto-finish when remaining seconds ≤ 0.
- **Pause/resume logic is retained but has no trigger in v1** (blur-pause dropped). The state machine keeps `pause()/resume()` dormant for a future release.
- Metric formulas (verbatim), with `minutes = max(elapsedMs/60000, 1/60000)`:
  ```
  wpm        = round((correctChars / 5) / minutes)
  rawWpm     = round((typedChars   / 5) / minutes)
  accuracy   = typedChars === 0 ? 100 : max(0, round((typedChars - mistakes) / typedChars * 100))
  completion = targetLen  === 0 ? 0   : round(correctChars / targetLen * 100)
  ```
- **Text normalization for comparison:** target and typed characters compared after `.normalize("NFC").toLowerCase()`.

### Digraph analysis (exact constants)
- `ACTIONABLE_PAIR_LIMIT = 3`, `MAX_HEATED_SAMPLE_LIMIT = 18`, `MAX_HEATED_SAMPLE_RATIO = 0.08`, `MIN_HEATED_SAMPLE_LIMIT = 3`.
- Press-to-press latency per pair; filter latencies to 30–1200 ms; exclude pairs with a backspace between them; median baseline; rank the top slow pairs; assign heat 0–1.

### Adaptive banding (exact)
- Average WPM of the most recent 5 sessions → band: `< 75` slow, `75–139` medium, `≥ 140` fast. No history → slow.
- Random excerpt matching selected category **and** band, excluding the current excerpt; fallback to any excerpt if no band/category match.

### Race (exact)
- Constants: slow racer 60 WPM, fast racer 140 WPM.
  ```
  elapsedRatio = clamp(elapsedMs / max(durationSeconds * 1000, 1))
  progress_x   = clamp(elapsedRatio * (speed_x / max(slow, user, fast, 1)))
  ```
- Rendered as three labeled horizontal lanes with a moving glyph at `progress * trackWidth`.

### Input handling (from spike gotchas)
- **`useKittyKeyboard` enabled** so delete-word works: in legacy mode Backspace (0x7f) and Ctrl-Backspace (0x08) both parse to `name:"backspace", ctrl:false` — indistinguishable. Kitty mode gives Ctrl-Backspace `ctrl:true` and Alt-Backspace `meta/option:true`. **Non-kitty fallback:** treat Ctrl-W (0x17) / Alt-Backspace as delete-word.
- **Filter Kitty key-release events:** with kitty mode, ignore events where `eventType === "release"` for typing input.
- **Timestamp:** `KeyEvent` carries no timestamp — stamp `performance.now()` (or `Bun.nanoseconds()`) on the first line of the keypress handler. Input is per-keystroke, not batched at human speed.
- **Paste:** OpenTUI emits a separate `paste` event (bracketed paste `?2004h`); its body is never emitted as keypresses. Discarding a paste = ignoring the event.
- **Esc** is delayed ~20 ms to disambiguate lone-Esc from escape sequences; acceptable since Esc = restart/close-overlay (not timing-critical).
- **Ctrl-C** handled manually (`exitOnCtrlC: false`); `q` and Ctrl-C both quit.

### Keymap and input mode
- Keys: `Tab` next excerpt · `Esc` restart run / close overlay · `?` help · `1`/`2`/`3` duration 15/30/60 · `c` cycle category · `t` theme · `l` locale · `p` profile · `s` sources · `q`/`Ctrl-C` quit · `Backspace` delete char · `Ctrl/Alt-Backspace` delete word · `Ctrl-U` delete to line start.
- **State-gated input** (pure `(KeyEvent, sessionState) → Command`):
  - **Ready / Finished:** hotkeys live.
  - **Active run:** every printable key is typed input; only control keys command (`Esc`, `Tab`, Backspace-family, `Ctrl-C`, `Ctrl-U`). `?` mid-run is input, not help.

### Rendering
- **Typing surface:** per-cell colors — dim pending, green correct, red on error showing the expected char (fixed layout, never reflow); block cursor. Word-wrap to terminal width; scroll the viewport to keep the cursor visible.
- **Heat map (post-run):** re-render excerpt with truecolor cell **backgrounds** interpolated by heat 0–1; 256-color fallback via nearest-index mapping when truecolor is unavailable; plus a textual top-slow-pairs list. `hsvToRgb` available for the gradient; `ansi256IndexToRgb` for fallback.
- **Race strip:** three labeled lanes, moving glyph, updated on the 100 ms tick.
- **Profile:** braille line charts for WPM and accuracy trends (light/hand-rolled renderer, avoid heavy deps) plus summary stats.
- **Themes:** two palettes (Slate, Rush) mapping frank_type's CSS-variable roles to terminal colors; runtime switch; persisted.
- **Terminal floor:** minimum 80×24 — below it, show a "terminal too small" message and pause rendering until resized; require a raw-mode TTY, else exit with a clear message.

### Content and corpus
- Corpus copied **verbatim** from frank_type: YAML organized as `{en, pt-BR} × {biography, fantasy, scifi} × {fast, medium, slow}`. Per-excerpt fields: `id`, `title`, `author`, `source`, `category`, `speed_band`, `normalized_text`.
- **Normalizer port:** NFC + lowercase for comparison; English transliterated to ASCII; Brazilian Portuguese preserves accents (no transliteration). Requires a JS diacritic-stripping approach for English.

### Storage
- Cross-platform data directory: `$XDG_DATA_HOME/tuiper` (→ `~/.local/share/tuiper`) on Linux/macOS; `%APPDATA%\tuiper` on Windows.
- Files: `sessions.json` (history) and `settings.json` (theme, locale, last duration, last category).
- **Schema identical** to frank_type's `frank_type.sessions.v1`: keep 30 full session records + 90 daily summaries, max 120 total; daily summaries keyed `summary-YYYY-MM-DD` with `sampleCount`-weighted averages for WPM/rawWPM/accuracy and summed mistakes/typedCharacters.
- **Atomic writes** (temp file + rename) to prevent corruption on crash.

### Localization
- UI-string tables per language (EN, pt-BR) covering menus, stats labels, help, and messages. Default locale from `$LANG`; runtime switch; persisted. Corpus filtered to the active locale.

### Distribution and licensing
- Ship both a `bun build --compile` **self-contained binary** (Linux/macOS/Windows, primary) and an **npm package**; CI builds all three platforms. (Note: `bun build` warns on un-installed other-OS optional native deps — harmless; the correct platform package loads at runtime.)
- MIT license; retain Akita's copyright notice in `LICENSE`; credit frank_type in the README.

## Testing Decisions

**What makes a good test here:** it asserts external behavior (the numbers a user sees, the commands a keystroke produces, the cells a screen renders) — never internal wiring. The engine's determinism makes golden-value assertions the backbone: a scripted keystroke-and-timestamp sequence in, exact metric/digraph/band/race numbers out.

**Level 1 — Engine golden-value unit tests (primary).** TDD every ported module: `metrics` (wpm/rawWpm/accuracy/mistakes/completion), digraph summarization (against the fixed constants and filters), `session_state` lifecycle (start-on-first-key, elapsed excluding pause, auto-finish, deletion effects), `speed_band` (5-session average → band, cold-start slow), `race_progress` (clamped ratios), `deletion` (char/word/to-line-start counts), `text_normalizer` (EN→ASCII, pt-BR preserved, NFC+lowercase), and `session_store` compaction (30/90/120 caps, weighted daily summaries). Where frank_type has existing JS tests, port them verbatim; otherwise hand-derive expected values from the formulas.

**Level 1 — Input-intent mapping unit tests.** The pure `(KeyEvent, sessionState) → Command` function is correctness-critical (it decides whether a key types or commands). Golden-test the state-gated rule in every state (Ready/Finished vs Active), the delete-mode resolution, kitty vs. legacy Backspace disambiguation, and paste rejection.

**Level 2 — View snapshot tests.** Render key screens (typing surface with mixed correct/wrong/pending, heat-map overlay, race strip, braille charts) to an in-memory `OptimizedBuffer` and snapshot the cell grid (characters + colors). Buffer read-back was proven headless in the spike (`probe2`). Catches layout/color regressions without a real TTY.

**Level 3 — Headless integration smoke tests (few).** Boot `createCliRenderer` headless, inject a synthetic keypress sequence, and assert on the resulting stored session (via the in-memory storage fake) and/or the final buffer. A handful, covering the end-to-end path key → engine → store → render.

**Level 4 — Manual / interactive probe (not automated).** Keep a `probe3`-style interactive harness for the genuinely un-unit-testable residue: flicker, real-terminal truecolor, live timing feel, and kitty-vs-legacy behavior across terminals (tmux, ssh, Windows Terminal).

**Prior art:** the throwaway probes in `prototype-spike/` (`probe1`/`probe1b` key discrimination, `probe2` buffer read-back, `probe3` interactive) demonstrate the headless-render and event-injection patterns the automated tests build on. frank_type's own `test/` suite is prior art for the engine golden values.

## Out of Scope

- **Accounts, authentication, servers, networking, cloud sync.** tuiper is local-only, matching frank_type's no-auth/no-server stance.
- **Blur-pause** (pause on focus loss). The pause/resume state logic is retained but has no trigger in v1; revisit after release, possibly via terminal focus reporting (DECSET 1004).
- **All web/desktop packaging from frank_type:** PWA manifest, service worker, Electron wrapper, Docker/compose/Kamal, Rails server/controllers/importmap/Tailwind/ERB views.
- **Pixel-parity visuals:** the CSS glow heat map and SVG line charts are reinterpreted with terminal primitives (color-cell intensity, braille), not mimicked exactly.
- **16-color terminals:** not gracefully mapped; truecolor preferred, 256-color fallback, otherwise degraded.
- **New corpus authoring or additional languages** beyond the copied EN + pt-BR content.
- **Anti-cheat beyond paste rejection:** OS key-repeat is accepted as-is (the 30 ms digraph floor already filters the fastest noise).

## Further Notes

- **Spike evidence:** `prototype-spike/NOTES.md` holds full verdicts, the verified boot pattern, and API references. The `prototype-spike/` directory is throwaway and may be deleted once this PRD is accepted (its decisions are captured here).
- **Environment:** Bun 1.3.14 installed at `C:\Users\49768117\.bun\bin\bun.exe` (not on permanent PATH — prefix or add to PATH). OpenTUI 0.4.2 ships a native `opentui.dll` for win32-x64 as an auto-installed optional dependency (no build step); darwin/linux/win × x64/arm64 all shipped.
- **Original design record:** the 21 locked decisions and full frank_type feature inventory (with exact formulas) are in `C:\Users\49768117\AppData\Local\Temp\tuiper-handoff-spike.md`, kept for reference.
- **Not yet a git repository.** Initialize before issue-tracker setup and implementation.
