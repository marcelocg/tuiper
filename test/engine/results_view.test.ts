import { describe, expect, test } from "bun:test";
import { formatResultPanel } from "../../src/engine/results_view";
import { buildResult } from "../../src/engine/session_result";
import { createSession, finish, typeChar } from "../../src/engine/session_state";
import { stringsFor } from "../../src/engine/strings";
import { rowsText } from "../../src/engine/view_row";

describe("formatResultPanel", () => {
  test("renders the five headline metrics, one per labelled row", () => {
    let s = typeChar(createSession("test", 30), "t", 1000);
    s = typeChar(s, "e", 1000);
    s = typeChar(s, "s", 1000);
    s = typeChar(s, "t", 1000);
    s = finish(s, 31000);

    const rows = formatResultPanel(buildResult(s, 31000));
    const lines = rowsText(rows);
    expect(rows).toHaveLength(5);
    expect(lines[0]).toContain("WPM");
    expect(lines[0]).toContain("2");
    expect(lines[2]).toContain("Accuracy");
    expect(lines[2]).toContain("100%");
    expect(lines[3]).toContain("Mistakes");
    expect(lines[3]).toContain("0");
    expect(lines[4]).toContain("Completion");
    expect(lines[4]).toContain("100%");
  });

  test("every metric row is in the correct (headline) role", () => {
    let s = typeChar(createSession("test", 30), "t", 1000);
    s = finish(s, 31000);
    const rows = formatResultPanel(buildResult(s, 31000));
    for (const row of rows) {
      expect(row).toHaveLength(1);
      expect(row[0]).toMatchObject({ role: "correct" });
    }
  });

  test("localizes the stat labels for pt-BR", () => {
    let s = typeChar(createSession("test", 30), "t", 1000);
    s = finish(s, 31000);
    const lines = rowsText(formatResultPanel(buildResult(s, 31000), stringsFor("pt-BR").results));
    expect(lines[0]).toContain("PPM");
    expect(lines[2]).toContain("Precisão");
    expect(lines[3]).toContain("Erros");
    expect(lines[4]).toContain("Conclusão");
    // The numbers are unchanged — only the labels are translated.
    expect(lines.join("\n")).not.toContain("Accuracy");
  });
});
