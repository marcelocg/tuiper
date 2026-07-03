// The intent a key resolves to, below the seam. The shell reacts to these
// (e.g. `quit` stops the renderer); the session engine applies the rest.
export type Command =
  | { readonly kind: "type"; readonly char: string }
  | { readonly kind: "deleteChar" }
  // Delete the previous whole word (Ctrl/Alt-Backspace, or Ctrl-W in legacy).
  | { readonly kind: "deleteWord" }
  // Delete back to the visual line start (Ctrl-U). `toIndex` is the resolved
  // line-start index; the shell fills it in (it needs the terminal width). The
  // intent mapper emits it unset, and the engine defaults to the input start.
  | { readonly kind: "deleteToLineStart"; readonly toIndex?: number }
  | { readonly kind: "setDuration"; readonly seconds: number }
  // Excerpt selection — handled by the shell (impure: corpus + rng), not the
  // session engine. `nextExcerpt` loads a fresh excerpt; `cycleCategory` steps
  // the category filter and reloads.
  | { readonly kind: "nextExcerpt" }
  | { readonly kind: "cycleCategory" }
  // Open the profile screen (history trends). Shell-owned overlay; the engine
  // session is untouched. Only live in ready/finished — mid-run `p` types.
  | { readonly kind: "openProfile" }
  | { readonly kind: "quit" }
  | { readonly kind: "none" };
