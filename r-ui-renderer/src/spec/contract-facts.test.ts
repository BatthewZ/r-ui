// @vitest-environment node
import { describe, expect, it } from "vitest";

import { nameRole, refPropKinds } from "./contract-facts";
import type { ComponentContract } from "./types";

const contract = (type: string): ComponentContract => ({ category: "custom", props: [{ name: "focus", type, required: false }] });

describe("refPropKinds", () => {
  it("reads the kinds a document may write instead of a ref, splitting the union at the top level only", () => {
    expect(refPropKinds(contract("number | RefObject<HTMLElement | null>"), "focus")).toEqual(["number"]);
    expect(refPropKinds(contract('"first" | "last" | RefObject<HTMLElement | null>'), "focus")).toEqual(["string"]);
    expect(refPropKinds(contract("RefObject<HTMLElement | null>"), "focus")).toEqual([]);
    expect(refPropKinds(contract('RefObject<HTMLElement | null> | Map<"x" | 5, string>'), "focus")).toEqual([]);
  });

  it("is undefined for a prop that takes no ref, or one the contract does not list", () => {
    expect(refPropKinds(contract("number | null"), "focus")).toBeUndefined();
    expect(refPropKinds(contract("Partial<{ a: RefObject<HTMLElement> }>"), "focus")).toBeUndefined();
    expect(refPropKinds(contract("number"), "other")).toBeUndefined();
  });
});

describe("nameRole", () => {
  it("is the field binding, then a DOM name, else the component's own", () => {
    expect(nameRole({ category: "x", fieldName: true, domName: true })).toBe("field");
    expect(nameRole({ category: "x", domName: true })).toBe("dom");
    expect(nameRole({ category: "x" })).toBe("own");
  });
});
