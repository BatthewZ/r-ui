import { describe, expect, it } from "vitest";

import { DECLARED_PATHS, defaultContracts } from "../contracts";
import { HOST_PROPS } from "./host-policy";

/** The table names library components and props: each entry must still exist, and the document's own value must be dropped. */
describe("host-decided props against the library", () => {
  const pairs = Object.entries(HOST_PROPS).flatMap(([name, props]) => Object.keys(props).map((prop) => [name, prop] as const));

  it.each(pairs)("%s declares %s, and drops the document's", (name, prop) => {
    expect(DECLARED_PATHS[name]?.paths).toContain(prop);
    expect(defaultContracts[name]?.droppedProps).toContain(prop);
  });

  it("names only addressable components", () => {
    expect(pairs.length).toBeGreaterThan(0);
    expect(Object.keys(HOST_PROPS).filter((name) => !Object.hasOwn(defaultContracts, name))).toEqual([]);
  });
});
