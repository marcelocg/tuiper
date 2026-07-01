# AGENTS.md — tuiper

Terminal (TUI) typing trainer — a faithful clone of [frank_type](https://github.com/akitaonrails/frank_type) (Rails 8 typing app, MIT © 2026 Fabio Akita), reproducing its behavior exactly with a native terminal presentation.

**Stack:** TypeScript on **Bun**, TUI via **OpenTUI** (`@opentui/core`). Local-first — no server, no accounts, no network. History/prefs in local JSON.

**Design source of truth:** `docs/PRD.md` (problem, 54 user stories, exact metric/digraph/band/race formulas, seam design, test plan). OpenTUI runtime validation: `prototype-spike/NOTES.md` (throwaway; deletable once absorbed).

## Architecture (from the PRD)

- **One primary test seam: the engine boundary.** All ported frank_type logic is pure TypeScript (data in → data out, no OpenTUI/TTY/fs). The OpenTUI shell above it is thin wiring.
- **Pure below the seam** (golden/snapshot tested): engine modules (`metrics`, `session_state`, `speed_band`, `race_progress`, `deletion`, digraph summary, `text_normalizer`, `session_store` compaction), the input-intent mapper `(KeyEvent, sessionState) → Command`, and the view mapper `(viewModel) → cells`.
- **Above the seam** (few headless smokes + manual probe only): OpenTUI lifecycle glue (`createCliRenderer`, `.on()` subscriptions, `.start/.stop`).
- **Storage is an injected port** — a read/write-JSON interface; file adapter in the app, in-memory fake in tests.

## Conventions

- Reproduce frank_type's formulas/constants **byte-for-byte** — verify with golden-value tests, never approximate.
- Keep OpenTUI out of pure modules; the shell only translates engine state ↔ terminal.
- TDD: red → green → refactor. See the four test levels in `docs/PRD.md`.

## Dev environment

- Bun 1.3.14 at `C:\Users\49768117\.bun\bin\bun.exe` (not on permanent PATH — prefix or add to PATH).
- `gh` CLI via scoop at `C:\Users\49768117\scoop\apps\gh\current\bin\gh.exe`. `git` via scoop (PowerShell PATH, not bash).
- OpenTUI 0.4.2 ships native `opentui.dll` as an auto-installed optional dependency (no build step; all OS/arch shipped).

## Agent skills

### Issue tracker

Issues and PRDs live as GitHub issues at `github.com/marcelocg/tuiper` (via `gh` CLI). External PRs are **not** a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles map to identically-named labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root (created lazily by `/domain-modeling`). See `docs/agents/domain.md`.
