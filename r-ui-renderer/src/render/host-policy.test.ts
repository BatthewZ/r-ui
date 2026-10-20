import { describe, expect, it } from "vitest";

import { DECLARED_PATHS, defaultContracts } from "../contracts";
import { HOST_PROPS, NUMBER_ONLY_PROPS, STRUCTURAL_PARENTS } from "./host-policy";

/** Every table here names library components and props: each entry must still exist. */
describe("render-side tables against the library", () => {
  const pairs = [
    ...Object.entries(HOST_PROPS).flatMap(([name, props]) => Object.keys(props).map((prop) => [name, prop] as const)),
    ...Object.entries(NUMBER_ONLY_PROPS).flatMap(([name, props]) => props.map((prop) => [name, prop] as const)),
  ];

  it.each(pairs)("%s declares %s", (name, prop) => {
    expect(DECLARED_PATHS[name]?.paths).toContain(prop);
  });

  it("names only addressable components", () => {
    const names = [...Object.keys(HOST_PROPS), ...Object.keys(NUMBER_ONLY_PROPS), ...STRUCTURAL_PARENTS];
    expect(names.length).toBeGreaterThan(5);
    expect(names.filter((name) => !Object.hasOwn(defaultContracts, name))).toEqual([]);
  });

  it("hands Markdown's image allowlist only to the host: the document's is dropped", () => {
    expect(defaultContracts.Markdown?.droppedProps).toContain("imageAllowlist");
  });
});
