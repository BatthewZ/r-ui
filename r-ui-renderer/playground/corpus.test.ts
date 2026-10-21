import { describe, expect, it } from "vitest";

import { exampleSpec } from "../src/examples";
import { CONTROL_EXAMPLES, type ControlName } from "../src/examples/controls";
import { corpusDocument, COVERAGE_NAMES, PRODUCT_NAMES } from "./corpus";

describe("corpusDocument", () => {
  it("resolves a corpus document as its spec and its text", () => {
    const entry = corpusDocument("ops-dashboard");
    expect(entry.ok && entry.name).toBe("ops-dashboard");
    expect(entry.ok && entry.spec).toEqual(exampleSpec("ops-dashboard"));
    expect(entry.ok && JSON.parse(entry.text)).toEqual(exampleSpec("ops-dashboard"));
  });

  it.each(Object.keys(CONTROL_EXAMPLES) as ControlName[])("resolves the control document %s, which the browser checks open by ?view=", (name) => {
    const entry = corpusDocument(name);
    expect(entry.ok && entry.name).toBe(name);
    expect(entry.ok && entry.spec).toEqual(CONTROL_EXAMPLES[name].document);
  });

  it("lists no control document in the editor's groups", () => {
    const listed: readonly string[] = [...PRODUCT_NAMES, ...COVERAGE_NAMES];
    for (const name of Object.keys(CONTROL_EXAMPLES)) expect(listed).not.toContain(name);
  });

  it("names an unknown document as such", () => {
    expect(corpusDocument("no-such-document")).toEqual({
      ok: false,
      code: "unknown-view",
      message: 'No corpus or control document is named "no-such-document".',
    });
  });
});
