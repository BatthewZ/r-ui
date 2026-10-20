// @vitest-environment node
import { describe, expect, it } from "vitest";

import { closest, osaDistance } from "./validate-suggest";

describe("osaDistance", () => {
  it.each([
    ["", "", 0],
    ["card", "card", 0],
    ["card", "crad", 1],
    ["card", "cards", 1],
    ["card", "cart", 1],
    ["ca", "abc", 3],
    ["kitten", "sitting", 3],
  ])("%s → %s is %i", (a, b, distance) => {
    expect(osaDistance(a, b)).toBe(distance);
    expect(osaDistance(b, a)).toBe(distance);
  });
});

describe("closest", () => {
  const names = ["Card", "Card.Header", "Badge", "Button", "showToast", "setState"];

  it("prefers a case-insensitive match, then the one name containing it, then the unique nearest", () => {
    expect(closest("card", names)).toBe("Card");
    expect(closest("toast", names)).toBe("showToast");
    expect(closest("Bagde", names)).toBe("Badge");
    expect(closest("Card.Heder", names)).toBe("Card.Header");
  });

  it("says nothing when no name is close or two are equally close", () => {
    expect(closest("Table", names)).toBeUndefined();
    expect(closest("Card", names)).toBeUndefined();
    expect(closest("ab", ["ac", "ad"])).toBeUndefined();
    expect(closest("x", [])).toBeUndefined();
  });
});
