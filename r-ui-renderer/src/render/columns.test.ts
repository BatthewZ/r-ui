// @vitest-environment node
import { describe, expect, it } from "vitest";

import { DECLARED_PATHS } from "../contracts";
import { ADVISORY_DEFS } from "../spec/validate-schema";
import { BRIDGED_COLUMN_KEYS, COLUMN_KEYS } from "./columns";

/** The document's column shape, the keys the renderer reads and the library's columns must name the same keys. */
describe("DataTable column keys", () => {
  const documentKeys = Object.keys(ADVISORY_DEFS.Column?.properties ?? {}).sort();
  const bridged: readonly string[] = BRIDGED_COLUMN_KEYS;

  it("are the keys the format declares, every one read by the renderer", () => {
    expect(documentKeys.length).toBeGreaterThan(10);
    expect([...COLUMN_KEYS].sort()).toEqual(documentKeys);
  });

  it.each(["DataTable", "VirtualizedTable"])("are %s's own column keys, except the ones the renderer bridges", (name) => {
    const library = (DECLARED_PATHS[name]?.paths ?? []).filter((path) => /^columns\[\]\.[^.[]+$/.test(path)).map((path) => path.slice(10));
    expect(library.length).toBeGreaterThan(10);
    expect(documentKeys.filter((key) => !bridged.includes(key) && !library.includes(key))).toEqual([]);
  });
});
