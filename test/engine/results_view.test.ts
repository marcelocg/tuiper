import { describe, expect, test } from "bun:test";
import { formatResultPanel } from "../../src/engine/results_view";
import { buildResult } from "../../src/engine/session_result";
import { createSession, finish, typeChar } from "../../src/engine/session_state";

describe("formatResultPanel", () => {
  test("renders the five headline metrics, one per labelled line", () => {
    let s = typeChar(createSession("test", 30), "t", 1000);
    s = typeChar(s, "e", 1000);
    s = typeChar(s, "s", 1000);
    s = typeChar(s, "t", 1000);
    s = finish(s, 31000);

    const lines = formatResultPanel(buildResult(s, 31000));
    expect(lines).toHaveLength(5);
    expect(lines[0]).toContain("WPM");
    expect(lines[0]).toContain("2");
    expect(lines[2]).toContain("Accuracy");
    expect(lines[2]).toContain("100%");
    expect(lines[3]).toContain("Mistakes");
    expect(lines[3]).toContain("0");
    expect(lines[4]).toContain("Completion");
    expect(lines[4]).toContain("100%");
  });
});
