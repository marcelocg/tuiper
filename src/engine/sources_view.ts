// Pure view mapping for the sources screen: the loaded excerpts → attribution
// lines. A title, a blank spacer, then one entry per excerpt naming its title,
// author, and source (the public-domain provenance, PRD story 47). The shell
// paints and scrolls these lines; keeping the layout pure lets the screen be
// snapshot-asserted without a TTY.

import { stringsFor, type SourcesStrings } from "./strings";
import { span, type Row } from "./view_row";

/** The per-excerpt fields the sources screen attributes. A structural subset of
 *  Excerpt, so tests can supply plain records without the full catalog. */
export interface SourceEntry {
  readonly title: string;
  readonly author: string;
  readonly source: string;
}

/**
 * The sources screen as text lines: a title, a blank spacer, then one entry per
 * excerpt formatted `title — author · source`. With no excerpts only the title
 * and a guidance line are returned. Labels come from the injected locale table
 * (defaults to English).
 */
export function formatSources(
  excerpts: readonly SourceEntry[],
  strings: SourcesStrings = stringsFor("en").sources,
): Row[] {
  if (excerpts.length === 0) {
    return [[span("title", strings.title)], [], [span("chrome", strings.empty)]];
  }
  return [
    [span("title", strings.title)],
    [],
    ...excerpts.map((e) => [span("chrome", `${e.title} — ${e.author} · ${e.source}`)]),
  ];
}
