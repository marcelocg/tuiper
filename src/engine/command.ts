// The intent a key resolves to, below the seam. The shell reacts to these
// (e.g. `quit` stops the renderer); the session engine applies the rest.
export type Command =
  | { readonly kind: "type"; readonly char: string }
  | { readonly kind: "deleteChar" }
  | { readonly kind: "setDuration"; readonly seconds: number }
  // Excerpt selection — handled by the shell (impure: corpus + rng), not the
  // session engine. `nextExcerpt` loads a fresh excerpt; `cycleCategory` steps
  // the category filter and reloads.
  | { readonly kind: "nextExcerpt" }
  | { readonly kind: "cycleCategory" }
  | { readonly kind: "quit" }
  | { readonly kind: "none" };
