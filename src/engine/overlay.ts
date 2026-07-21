// The Overlay — a full-screen panel drawn over the session without pausing it.
// Its own module because two seams need it: the input-intent mapper (which keys
// scroll vs. close) and the frame composer (which panel to lay out). See
// CONTEXT.md ("The view seam").

/** The full-screen panels drawn over the session (the engine is untouched). */
export type Overlay = "profile" | "help" | "sources";

/**
 * Whether the overlay scrolls at all. Nav keys are consumed by a scrollable
 * overlay even when its content currently fits (scroll max 0) — they must not
 * fall through and close it. Profile is a fixed layout and never scrolls.
 */
export function isScrollableOverlay(overlay: Overlay | null): boolean {
  return overlay === "help" || overlay === "sources";
}
