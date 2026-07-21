// The Frame — the whole screen as pure data, one Row[] per pane.
//
// composeFrame is the seam above every view mapper: given a ViewState (session,
// overlay, locale, terminal size, …) it decides which screen is showing, lays
// each pane out to its row budget, and returns the four panes as Styled Rows.
// It is COLOR-FREE: rows carry role intent only, so the shell's Paint adapter
// realizes color in the active palette. Nothing here touches OpenTUI, the
// renderer, storage, or the clock — the shell hands `now` and `history` in.
//
// That makes the entire visual output snapshot-testable without a TTY: one
// composeFrame call per screen. See CONTEXT.md ("The view seam").

import { calculateMetrics } from "./metrics";
import { formatFooter } from "./footer_view";
import { formatHelp } from "./help_view";
import { formatProfile } from "./profile_view";
import { formatResultPanel } from "./results_view";
import { formatSources, type SourceEntry } from "./sources_view";
import { computeHeatCells, formatSlowPairs } from "./heatmap_view";
import { LABEL_WIDTH, raceRows } from "./race_view";
import { buildProfile } from "./profile";
import { buildResult } from "./session_result";
import {
  correctCharacters,
  elapsedMs,
  remainingSeconds,
  sessionStatus,
  type SessionState,
} from "./session_state";
import { terminalTooSmall, terminalTooSmallLines } from "./terminal";
import { computeCells, cursorRow, visibleWindow, wordWrap } from "./typing_view";
import { cellsToRows, span, windowClip, type Row } from "./view_row";
import { overlayHeight, raceStripTop, surfaceHeight } from "./layout";
import type { Overlay } from "./overlay";
import type { Locale } from "./locale";
import type { UIStrings } from "./strings";
import type { ThemeName } from "./theme";
import type { StoredSession } from "../storage/session_store";

/** Everything composeFrame needs to draw the screen. Pure inputs only: the
 *  shell stamps `now`, reads `history` (profile only), and supplies the terminal
 *  size — no store, renderer, or palette crosses this seam. */
export interface ViewState {
  readonly state: SessionState;
  /** Monotonic timestamp for the countdown / live metrics (shell-stamped). */
  readonly now: number;
  readonly overlay: Overlay | null;
  /** Top visible line of the active scrollable overlay. */
  readonly overlayScroll: number;
  readonly category: string;
  readonly locale: Locale;
  readonly strings: UIStrings;
  /** Active-locale corpus, for the sources overlay (only attribution fields are
   *  read, so an Excerpt satisfies this structurally). */
  readonly excerpts: readonly SourceEntry[];
  /** Local history, read by the shell only while the profile overlay is up. */
  readonly history: readonly StoredSession[];
  /** Stable theme identifier shown in the footer (not a color). */
  readonly themeName: ThemeName;
  readonly width: number;
  readonly height: number;
}

/** The screen as pure data: one Row[] per pane ([] = blank), plus the race
 *  strip's anchor row. The shell paints each pane onto its renderable. */
export interface Frame {
  readonly header: Row[];
  readonly surface: Row[];
  readonly raceStrip: Row[];
  readonly footer: Row[];
  readonly raceStripTop: number;
}

/** Countdown / status line above the typing surface. */
function headerRows(vs: ViewState): Row[] {
  const status = sessionStatus(vs.state);
  if (status === "finished") {
    return [
      [
        span("correct", vs.strings.header.done(vs.state.durationSeconds)),
        span("chrome", vs.strings.header.quitHint),
      ],
    ];
  }
  const secs = remainingSeconds(vs.state, vs.now);
  const label = status === "active" ? vs.strings.header.typing : vs.strings.header.ready;
  return [[span(secs <= 5 ? "wrong" : "chrome", `${secs}s`), span("chrome", `  ·  ${label}`)]];
}

/**
 * The live race strip: three labeled lanes (Slow 60 / You / Fast 140) with a
 * glyph advancing on each 100ms tick. The user's live WPM drives their marker,
 * computed from the same metrics the results panel uses so the chase matches the
 * final number.
 */
function raceStripRows(vs: ViewState): Row[] {
  const elapsed = elapsedMs(vs.state, vs.now);
  const userWpm = calculateMetrics({
    typedEvents: vs.state.events,
    correctCharacters: correctCharacters(vs.state),
    elapsedMs: elapsed,
    targetText: vs.state.target,
  }).wpm;
  // Localized lane labels vary in width (e.g. "Fast" vs "Rápido"), so pad every
  // lane to the widest label in the active locale — the track starts aligned.
  const labelWidth = Math.max(
    LABEL_WIDTH,
    ...Object.values(vs.strings.race).map((label) => label.length),
  );
  const trackWidth = Math.max(1, vs.width - labelWidth - 1);
  return raceRows(
    { elapsedMs: elapsed, durationSeconds: vs.state.durationSeconds, userWpm },
    trackWidth,
    vs.strings.race,
    labelWidth,
  );
}

/** The terminal-too-small notice, in chrome. */
function tooSmallRows(vs: ViewState): Row[] {
  return terminalTooSmallLines(vs.width, vs.height, vs.strings.terminal).map((line) => [
    span("chrome", line),
  ]);
}

/** The current session laid out on the typing surface. */
function typingSurface(vs: ViewState, height: number): Row[] {
  const lines = wordWrap(computeCells(vs.state), vs.width);
  // Cursor-biased scroll decides the top line; windowClip fits it to the surface.
  const win = visibleWindow(lines.length, cursorRow(lines), height);
  return windowClip(cellsToRows(lines), { top: win.start, width: vs.width, height });
}

/**
 * Post-run panel: the five headline metrics, the ranked slow-pairs list, then
 * the excerpt replayed as a digraph heat map (per-cell heat). The heat map
 * appears only here — never during a run (PRD story 23).
 */
function resultsPanel(vs: ViewState, height: number): Row[] {
  const result = buildResult(vs.state, vs.now);
  // Accumulate rows — the row count is the single source of truth for the
  // remaining heat-map budget, so no hand-kept line math can drift out of sync
  // with what is emitted.
  const rows: Row[] = [];

  rows.push(...formatResultPanel(result, vs.strings.results));

  const slowPairs = formatSlowPairs(result.digraphs.rankedPairs);
  if (slowPairs.length > 0) {
    rows.push([], [span("chrome", vs.strings.results.slowestPairs)]);
    rows.push(...slowPairs);
  }

  // Heat-map replay of the excerpt, wrapped to width and windowed to whatever
  // height remains under the metrics + slow-pairs block (top is always 0 — this
  // is a static replay, so the top of the excerpt stays anchored).
  const heatRows = cellsToRows(
    wordWrap(computeHeatCells(vs.state.target, result.digraphs.samples), vs.width),
  );
  const remaining = height - rows.length - 1; // -1 for the blank spacer row
  if (remaining >= 1 && heatRows.length > 0) {
    rows.push([]); // blank spacer above the heat map
    rows.push(...windowClip(heatRows, { top: 0, width: vs.width, height: remaining }));
  }
  return rows;
}

/**
 * The profile overlay: history trends. Braille WPM and accuracy charts plus
 * best/avg/recent headline stats, laid out to the surface width/height.
 */
function profilePanel(vs: ViewState, height: number): Row[] {
  const chartWidth = Math.max(1, vs.width);
  // Split the surface height between the two metric charts, reserving rows for
  // the title, the two stat headlines, and spacers (~5 chrome rows).
  const chartHeight = Math.max(1, Math.floor((height - 5) / 2));
  const rows = formatProfile(buildProfile(vs.history), chartWidth, chartHeight, vs.strings.profile);
  // Never overflow the surface into the footer — window to the visible height
  // (from the top), matching how the typing/results panels clamp their content.
  return windowClip(rows, { top: 0, width: vs.width, height });
}

/**
 * The full (unwindowed) rows of the active SCROLLABLE overlay, or null for a
 * non-scrollable one. Help and sources come from pure, cheap formatters, so
 * recomputing per scroll keypress is fine; profile is a fixed layout drawn from
 * history, so it is not scrolled.
 */
function scrollableOverlayRows(vs: ViewState): Row[] | null {
  if (vs.overlay === "help") return formatHelp(vs.strings.help);
  if (vs.overlay === "sources") return formatSources(vs.excerpts, vs.strings.sources);
  return null;
}

/** Persistent hint bar: duration + category + theme + locale + controls. */
function footerRows(vs: ViewState): Row[] {
  if (vs.overlay) {
    const closeHint =
      vs.overlay === "profile"
        ? vs.strings.profile.closeHint
        : vs.overlay === "help"
          ? vs.strings.help.closeHint
          : vs.strings.sources.closeHint;
    return [[span("chrome", closeHint)]];
  }
  // Category shows its localized display name; theme/locale show their stable
  // identifiers (slate/rush, en/pt-BR) so the active choice is unambiguous. The
  // pure formatter picks full vs. compact hints for the width (the full tail
  // overflows the 80-col floor, so it collapses to a `? help` pointer there).
  const line = formatFooter({
    strings: vs.strings.footer,
    categoryLabel: vs.strings.categories[vs.category] ?? vs.category,
    themeName: vs.themeName,
    locale: vs.locale,
    durationSeconds: vs.state.durationSeconds,
    ready: sessionStatus(vs.state) === "ready",
    width: vs.width,
  });
  return [[span("chrome", line)]];
}

/**
 * How far the active scrollable overlay can scroll (0 when its content fits, or
 * it isn't scrollable). The shell clamps its stored scroll offset to this so the
 * value can't drift past the end — `windowClip` clamps the render, but an
 * unbounded offset would need N presses to scroll back into view.
 */
export function overlayScrollMax(vs: ViewState): number {
  const rows = scrollableOverlayRows(vs);
  if (!rows) return 0;
  return Math.max(0, rows.length - overlayHeight(vs.height));
}

/**
 * The whole screen for a ViewState. Below the 80×24 floor the layout can't fit,
 * so every pane but the notice goes blank (the wall-clock timer keeps running
 * underneath — it's timestamp-based — and the shell redraws the real screen the
 * moment the window grows back; #13, PRD story 49).
 */
export function composeFrame(vs: ViewState): Frame {
  const top = raceStripTop(vs.height);

  if (terminalTooSmall(vs.width, vs.height)) {
    return { header: [], surface: tooSmallRows(vs), raceStrip: [], footer: [], raceStripTop: top };
  }

  // Overlays cover the session and blank the race strip, reclaiming its rows.
  if (vs.overlay) {
    const height = overlayHeight(vs.height);
    const scrollable = scrollableOverlayRows(vs);
    const surface = scrollable
      ? windowClip(scrollable, { top: vs.overlayScroll, width: vs.width, height })
      : profilePanel(vs, height);
    return {
      header: headerRows(vs),
      surface,
      raceStrip: [],
      footer: footerRows(vs),
      raceStripTop: top,
    };
  }

  const height = surfaceHeight(vs.height);
  const status = sessionStatus(vs.state);
  return {
    header: headerRows(vs),
    surface: status === "finished" ? resultsPanel(vs, height) : typingSurface(vs, height),
    raceStrip: status === "active" ? raceStripRows(vs) : [],
    footer: footerRows(vs),
    raceStripTop: top,
  };
}
