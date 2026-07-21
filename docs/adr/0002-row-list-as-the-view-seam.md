# 2. `Row[]` is the view seam, with a single Paint adapter

- **Status:** Accepted
- **Date:** 2026-07-21
- **Affects:** `src/engine/view_row.ts`, `src/shell/theme.ts`, every `src/engine/*_view.ts`
- **Related:** [ADR-0001](0001-color-free-compose-frame.md) (composeFrame is color-free) depends on this

## Context

Pure view mappers emit **Styled Rows** — `Row[]`, where each **Span** carries
color intent — and a single **Paint** adapter turns them into OpenTUI
`StyledText`.

Our own design rule says: *one adapter means a hypothetical seam, two adapters
means a real one.* Applied mechanically here, the rule argues against this
design. `paint` has exactly one realization and exactly one call site (the
`apply` helper in `src/shell/app.ts`). Nothing varies across it. By that test,
`Row[]` is ceremony and the views should just return `StyledText`.

We kept it anyway, and it is worth being explicit about why, because a reviewer
applying the heuristic correctly will arrive at the opposite conclusion.

Two ways to make the seam "legitimate" were considered and rejected:

- **Invent a second adapter** — an ANSI or plain-text renderer — so the rule is
  satisfied. That is fabricating a requirement to justify a structure. The
  project once had exactly that (`renderRaceStrip`, a plain-text lane renderer)
  and it sat dead in `src/` until it was deleted.
- **Count `rowsText` as the second adapter.** It maps `Row[] → string[]` and is
  used in 43 places across 8 test files (and nowhere in `src/`). But it is a
  *projection* for assertions, not a rendering target — it drops the roles
  rather than realizing them. Calling it an adapter would be relabeling to
  satisfy a rule.

## Decision

`Row[]` is the seam. **Tests cross it directly; production crosses it via the
single `paint` adapter.** Those are the two sides — not two rendering targets.

We accept a seam with one adapter here because its justification is not
substitutability but *what it moves below the line*: color intent. That is a
different reason from the one the "two adapters" rule is about, and it holds
independently.

Supporting choices, recorded because each has a plausible alternative:

- **`Role` is a closed union**, not open string tags, so resolution is total and
  a new role fails typecheck until given a color.
- **`heat` is a discriminated arm** of `Span` (`{ text, heat }`), not an optional
  field on every span. Heat is the sole continuous case; an optional `heat?`
  would dangle `undefined` on every other span to serve one screen.
- **`rowsText` is a projection, not an adapter.** It exists so a test can assert
  text and color intent separately.

## Consequences

**The deletion test.** Delete `Row[]` and have views return `StyledText`:
every view module needs a `Palette`, so color decisions move back above the seam
into per-screen code, where they can only be tested through a TTY. That is
precisely the state this replaced — the shell was sniffing braille glyphs with
`/[⠀-⣿]/` to recover a color the view already knew. Complexity does not vanish;
it reappears across every view module. The seam earns its keep.

It also carries [ADR-0001](0001-color-free-compose-frame.md): `composeFrame` can
only be color-free because there is a color-free representation for it to
return. Removing this seam removes that one.

**Costs, honestly.** An intermediate representation exists that a direct
`StyledText` design would not need. `paint` is indirection with one
implementation. Contributors who know the "two adapters" rule will reasonably
question it — hence this ADR.

## Revisit if

- A second **rendering** target genuinely appears (an HTML export, an ANSI
  recorder, a web frontend). That strengthens the seam; nothing changes but the
  justification.
- Assertions stop reading `Row[]` and drift to `rowsText` everywhere, so nothing
  actually verifies roles. The seam's whole justification is that color intent is
  tested below it — if the tests stop doing that, the structure is no longer
  paying for itself and returning `StyledText` directly becomes the honest call.

  As of this ADR both sides are covered: roles are asserted where they are
  *emitted* (`sources`/`help` titles, `results` metrics, `heatmap` slow pairs,
  `profile` chart rows, `race` lane glyphs, the `frame` countdown) and where they
  are *resolved* (`test/shell/theme.test.ts`, role → `RGBA`). If a future reader
  finds that no longer true, this decision is due for review.
