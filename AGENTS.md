# AGENTS.md — tuiper

Terminal (TUI) typing trainer — a faithful clone of [frank_type](https://github.com/akitaonrails/frank_type) (Rails 8 typing app, MIT © 2026 Fabio Akita), reproducing its behavior exactly with a native terminal presentation.

**Stack:** TypeScript on **Bun**, TUI via **OpenTUI** (`@opentui/core`). Local-first — no server, no accounts, no network. History/prefs in local JSON.

**Design source of truth:** `docs/PRD.md` (problem, 54 user stories, exact metric/digraph/band/race formulas, seam design, test plan). OpenTUI runtime validation: `prototype-spike/NOTES.md` (throwaway; deletable once absorbed).

## Architecture

`docs/PRD.md` records the original design; `docs/adr/` records the decisions taken since (read the ADRs touching whatever you're about to change). `CONTEXT.md` is the domain glossary — use its terms.

- **One primary test seam: the engine boundary.** All ported frank_type logic is pure TypeScript (data in → data out, no OpenTUI/TTY/fs). The OpenTUI shell above it is thin wiring. No module under `src/engine/` or `src/corpus/` imports `@opentui/core` — keep it that way.
- **Pure below the seam** (golden/snapshot tested):
  - engine modules — `metrics`, `session_state`, `speed_band`, `race_progress`, `deletion`, digraph summary, `text_normalizer`, `session_store` compaction;
  - the **input-intent mapper** `(KeyEvent, InputState) → Command` (`input_intent.ts`). `InputState` is `{ state, overlay, pageSize }` — overlay keys cross this seam too, so there is exactly one input model and no key interpretation in the shell;
  - the **view seam** — view mappers (`*_view.ts`) emit **Styled Rows** (`Row[]`, `view_row.ts`), each **Span** carrying color *intent* (a **Role**, or a continuous `heat`), never a color. `composeFrame(ViewState) → Frame` (`frame.ts`) assembles the whole screen as one `Row[]` per pane; `layout.ts` owns the pane row budgets, `overlay.ts` the overlay type.
- **Above the seam** (few headless smokes + manual probe only): OpenTUI lifecycle glue (`createCliRenderer`, `.on()` subscriptions, `.start/.stop`), and the **Paint** adapter (`shell/theme.ts`) that resolves role intent to `RGBA` in the active **Palette**. `draw()` is just `composeFrame` + paint each pane.
- **Storage is an injected port** — a read/write-JSON interface; file adapter in the app, in-memory fake in tests.

## Conventions

- Reproduce frank_type's formulas/constants **byte-for-byte** — verify with golden-value tests, never approximate.
- Keep OpenTUI out of pure modules; the shell only translates engine state ↔ terminal.
- TDD: red → green → refactor. See the four test levels in `docs/PRD.md`.
- A screen's color decision belongs below the seam as a **Role**, never as a color picked in the shell. Adding a Role fails typecheck until the resolver in `shell/theme.ts` gives it a color — that's the intended way to extend it.
- Assert view output on `Row[]` (roles included), not only on `rowsText()` — the roles are the part that used to be untestable. See ADR-0002.

## Dev environment

- Bun 1.3.14 at `C:\Users\49768117\.bun\bin\bun.exe` (not on permanent PATH — prefix or add to PATH).
- `gh` CLI via scoop at `C:\Users\49768117\scoop\apps\gh\current\bin\gh.exe`. `git` via scoop (PowerShell PATH, not bash).
- OpenTUI 0.4.2 ships native `opentui.dll` as an auto-installed optional dependency (no build step; all OS/arch shipped).

## Agent skills

### Issue tracker

Issues and PRDs live as GitHub issues at `github.com/marcelocg/tuiper` (via `gh` CLI). External PRs are **not** a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles map to identically-named labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Verifying the real app

`bun test` + `bun run typecheck` cover everything below the seam; nothing there exercises `src/shell/app.ts`. The `verify` skill (`.claude/skills/verify/`) is that missing test — it drives the real app in a pseudo-terminal and asserts on rendered frames. Run it after any change to the shell or to behavior that must stay byte-for-byte.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root (created lazily by `/domain-modeling`). See `docs/agents/domain.md`.
