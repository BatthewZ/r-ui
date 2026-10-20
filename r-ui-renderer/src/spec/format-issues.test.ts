// @vitest-environment node
import { describe, expect, it } from "vitest";

import { formatIssuesForModel } from "./format-issues";
import type { Issue } from "./types";
import { validateViewSpec } from "./validate";

const warning: Issue = { code: "unknown-prop", path: "/root/props/varient", severity: "warning", message: "Card takes no prop `varient`.", suggestion: '"variant"' };
const error: Issue = { code: "missing-key", path: "", severity: "error", message: "Missing `root`." };

describe("formatIssuesForModel", () => {
  it("puts errors first, one line each, path first with the suggestion", () => {
    expect(formatIssuesForModel([warning, error])).toBe(
      [
        "The document is not valid: 1 error, 1 warning. Fix each one and send the whole document again.",
        "(document) error missing-key: Missing `root`.",
        '/root/props/varient warning unknown-prop: Card takes no prop `varient`. Use "variant".',
      ].join("\n"),
    );
  });

  it("says when the document is valid, with or without warnings", () => {
    expect(formatIssuesForModel([])).toBe("The document is valid: no issues.");
    expect(formatIssuesForModel([warning]).split("\n")[0]).toBe(
      "The document is valid, with 1 warning: each names something that will be dropped or will not work.",
    );
  });

  it("gives a parse error its line and column", () => {
    const { issues } = validateViewSpec('{\n  "version": 2,\n  "title": }');
    expect(formatIssuesForModel(issues).split("\n")[1]).toMatch(/^\(document\) \(line 3, column 12\) error invalid-json: /);
  });

  it("summarises issues past the cap as a count, saying how many errors hide there", () => {
    const issues = [...Array.from({ length: 3 }, () => error), ...Array.from({ length: 4 }, () => warning)];
    const lines = formatIssuesForModel(issues, { maxIssues: 2 }).split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe("…and 5 more (1 error among them).");
    expect(formatIssuesForModel(issues, { maxIssues: 0 }).split("\n")[1]).toBe("…and 7 more (3 errors among them).");
  });
});
