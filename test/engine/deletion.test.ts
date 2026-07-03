import { describe, expect, test } from "bun:test";
import {
  previousWordDeletionCount,
  toIndexDeletionCount,
} from "../../src/engine/deletion";

// Ported verbatim from frank_type's test/javascript/deletion.test.mjs so the
// word-boundary counts stay byte-for-byte identical.
describe("previousWordDeletionCount (frank_type parity)", () => {
  test("deletes the previous word and trailing spaces", () => {
    expect(previousWordDeletionCount("hello world")).toBe(5);
    expect(previousWordDeletionCount("hello world   ")).toBe(8);
    expect(previousWordDeletionCount("hello")).toBe(5);
    expect(previousWordDeletionCount("   ")).toBe(3);
    expect(previousWordDeletionCount("")).toBe(0);
  });

  test("respects the current cursor", () => {
    expect(previousWordDeletionCount("hello world again", 11)).toBe(5);
    expect(previousWordDeletionCount("hello world again", 6)).toBe(6);
  });
});

describe("toIndexDeletionCount (backspaceToIndex clamp)", () => {
  test("counts characters back to a target index", () => {
    expect(toIndexDeletionCount(11, 6)).toBe(5);
    expect(toIndexDeletionCount(5, 0)).toBe(5);
  });

  test("clamps the index into [0, cursor]", () => {
    expect(toIndexDeletionCount(5, -3)).toBe(5); // negative → line start
    expect(toIndexDeletionCount(5, 9)).toBe(0); // past cursor → nothing
    expect(toIndexDeletionCount(0, 0)).toBe(0);
  });
});
