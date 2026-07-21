# CONTEXT.md — tuiper domain language

The ubiquitous language for tuiper. Terms here are the canonical names for domain
concepts; use them in code, tests, comments, and design discussion. Architecture
vocabulary (module, interface, seam, adapter, depth, leverage, locality) comes from
the `/codebase-design` skill and is deliberately kept separate from the domain nouns
below.

## The view seam

**Styled Row** — the unit the pure view mappers emit across the view seam: one screen
line as a list of **Span**s. Replaces the older bare `string[]` / scalar `string`
outputs so that color intent is decided below the seam (where it is snapshot-tested),
not re-derived in the shell. Lives in `src/engine/view_row.ts`.

**Span** — a run of text carrying its color intent, never a concrete color. Two arms:
a discrete `{ text, role: Role }` or a continuous `{ text, heat: number }` (the digraph
heat-map replay). The continuous arm is the single exception to role-based coloring.

**Role** — the closed set of semantic color intents a Span can carry:
`correct | wrong | pending | chrome | title | cursor`. Total by construction — the
**Paint** resolver must handle every role, so a missing color fails typecheck (same
discipline as the `strings.ts` locale tables). `title` currently resolves to the same
color as `correct`; it stays a distinct role so a theme can diverge later.

**Paint** — the adapter above the view seam that resolves `Row[] → StyledText`: it maps
each Span's `role` (or `heat` value) to a concrete `RGBA` in the active **Palette** and
assembles the OpenTUI `StyledText`. The one place terminal color is realized. Lives in
`src/shell/theme.ts`. Kept assembly-only; layout (windowing, width-clipping) is a
separate pure step (`windowClip`) below the seam.

**Palette** — the shell-side realization of a theme (`slate` / `rush`): the `RGBA`
values Paint resolves roles into. The engine chooses *which* theme is active
(`ThemeName`); the Palette supplies its colors.

**Frame** — the whole screen as pure data: one **Styled Row** list per pane
(`header`, `surface`, `raceStrip`, `footer`) plus the race strip's anchor row. A
blank pane is `[]`. Produced by `composeFrame`, consumed by the shell, which
paints each pane onto its renderable. Lives in `src/engine/frame.ts`.

**ViewState** — everything `composeFrame` needs to decide and lay out the screen:
the session, the active **Overlay** and its scroll offset, category, locale,
strings, corpus attributions, history, theme name, and terminal size. Pure inputs
only — the shell stamps `now`, reads `history` (profile only), and supplies the
terminal size; no store, renderer, or **Palette** crosses this seam. `composeFrame`
is therefore *color-free*: it emits role intent, never color — see
[ADR-0001](docs/adr/0001-color-free-compose-frame.md), which records why the
Palette is deliberately kept out (`themeName` is text the footer shows, not color).

**Overlay** — a full-screen panel drawn over the session without pausing it:
`profile` (fixed layout, history trends), `help`, or `sources` (both scrollable).
Overlays blank the race strip and reclaim its rows.
