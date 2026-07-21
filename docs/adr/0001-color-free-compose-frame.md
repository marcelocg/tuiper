# 1. composeFrame is color-free

- **Status:** Accepted
- **Date:** 2026-07-21
- **Affects:** `src/engine/frame.ts`, `src/engine/view_row.ts`, `src/shell/theme.ts`, `src/shell/app.ts`

## Context

`composeFrame(ViewState) → Frame` decides which screen is showing and lays out
every pane. It sits below the engine seam and is the single entry point for the
app's entire visual output.

The obvious simplification is to hand it the active **Palette** — either as a
`ViewState` field or a second argument — and let it return panes as OpenTUI
`StyledText`, ready to assign to a renderable. One call instead of two, no
`apply` helper in the shell, no intermediate representation.

We deliberately did not do that, and the reasons are not obvious from reading
`frame.ts` alone.

A **Palette** is a record of `RGBA` values, and `RGBA` is a `@opentui/core`
export. Accepting one would pull OpenTUI below the seam — into the module that
composes every screen — against this project's central rule that ported logic
stays pure TypeScript with the OpenTUI shell as thin wiring above it (see
`AGENTS.md`, "Architecture"). Today no `engine/` module imports `@opentui/core`.

There is a second, subtler pull. `ViewState` already carries `themeName`, so it
looks like the theme is halfway across the seam already, and passing the whole
Palette reads like finishing the job. It is not the same thing: `themeName` is
**text**. The footer renders the literal string `Theme slate` so the active
choice is unambiguous, and that string is content, not color.

## Decision

`composeFrame` never receives a **Palette** and never resolves a color.

It returns a **Frame** — one **Styled Row** list per pane — where every **Span**
carries color *intent*: a discrete **Role** (`correct`, `wrong`, `pending`,
`chrome`, `title`, `cursor`) or a continuous `heat` value. The shell's **Paint**
adapter (`paint(rows, palette, truecolor)` in `src/shell/theme.ts`) is the one
place intent becomes `RGBA`.

`ViewState` may carry theme *identity* (`themeName`) because that is text the
footer displays. It must not carry theme *colors*.

## Consequences

**What this buys**

- The **Frame** is plain data, so the whole screen is snapshot-tested without a
  TTY, a renderer, or a palette — 17 `composeFrame` fixtures, one per screen.
  Asserting on an opaque `StyledText` would be materially worse.
- Color decisions concentrate at one seam and are tested there on their own
  terms (role → `RGBA`, heat gradient, the 256-color fallback) rather than being
  re-derived per screen. This is what killed the braille-glyph regex the shell
  previously used to recover a color the view already knew.
- Switching theme is a pure shell concern: swap the palette and repaint the same
  **Frame**. Composition does not re-run and cannot drift between themes.
- Truecolor support stays where it belongs. Whether the heat map gets a 24-bit
  gradient or snaps to the ansi-256 cube is a terminal capability
  (`prefersTruecolor(process.env)`), resolved at paint time — it is not a fact
  about what the screen contains.
- `engine/` keeps zero OpenTUI imports.

**What it costs**

- Rendering is two steps, not one: compose, then paint. The shell carries a
  small `apply` helper that paints a pane or clears the renderable when the pane
  is `[]`.
- An intermediate representation exists (**Row** / **Span**) that a
  `StyledText`-returning design would not need.
- `themeName` in `ViewState` sits awkwardly beside "no palette below the seam"
  and needs its comment to stay honest about being text.

## Revisit if

- OpenTUI's styled-text shape becomes cheap to construct and assert on in a pure
  test, removing the testability argument — the main reason for the split.
- A screen needs a color decision that genuinely depends on the resolved `RGBA`
  (e.g. contrast-aware selection against a computed background). Today every
  such decision is expressible as a **Role**, and `heat` is the sole continuous
  case. A second continuous case would be worth re-examining before adding a
  third.

Adding a **Role** is cheap and is the expected way to extend this: the resolver
in `src/shell/theme.ts` is exhaustive over `Role`, so a new one fails typecheck
until it is given a color. (Verified by adding a role: `tsc` reports
`TS2366: Function lacks ending return statement` against `roleFg` — the generic
form, not a named exhaustiveness error, so read it as "this role has no color
yet".)
