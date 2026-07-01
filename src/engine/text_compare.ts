// frank_type compares target and typed characters after NFC + lowercase
// (see PRD "Text normalization for comparison"). This is the minimal
// comparison rule the walking skeleton needs; the full corpus normalizer
// (EN->ASCII, pt-BR preserved) is a later slice.
export function normalizeForCompare(s: string): string {
  return s.normalize("NFC").toLowerCase();
}

export function charsMatch(expected: string, typed: string): boolean {
  return normalizeForCompare(expected) === normalizeForCompare(typed);
}
