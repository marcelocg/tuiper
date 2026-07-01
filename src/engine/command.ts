// The intent a key resolves to, below the seam. The shell reacts to these
// (e.g. `quit` stops the renderer); the session engine applies the rest.
export type Command =
  | { readonly kind: "type"; readonly char: string }
  | { readonly kind: "deleteChar" }
  | { readonly kind: "setDuration"; readonly seconds: number }
  | { readonly kind: "quit" }
  | { readonly kind: "none" };
