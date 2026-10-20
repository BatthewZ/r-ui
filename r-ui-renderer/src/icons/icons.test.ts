import * as lucide from "lucide-react";
import { describe, expect, it } from "vitest";

import { ICON_NAMES } from "../spec/vocabulary";
import { icons } from "./index";

const pascal = (name: string) =>
  name
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");

/** Names whose lucide icon is missing, or only a deprecated alias of another. */
function unknownToLucide(names: readonly string[]): string[] {
  return names.filter((name) => !Object.hasOwn(lucide.icons, pascal(name)));
}

describe("the shipped icon set", () => {
  it("names only icons the installed lucide-react has, by their canonical names", () => {
    expect(ICON_NAMES.length).toBeGreaterThan(100);
    expect(unknownToLucide(ICON_NAMES)).toEqual([]);
  });

  it("goes red on a missing icon and on a deprecated alias", () => {
    expect(unknownToLucide(["check", "no-such-glyph", "circle-help"])).toEqual(["no-such-glyph", "circle-help"]);
  });

  it("maps exactly the names the validator knows, each to its lucide icon", () => {
    expect(Object.keys(icons).sort()).toEqual([...ICON_NAMES].sort());
    for (const name of ICON_NAMES) expect(icons[name], name).toBe(lucide.icons[pascal(name) as keyof typeof lucide.icons]);
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
  });

  it("names nothing through the prototype", () => {
    expect(Object.getPrototypeOf(icons)).toBeNull();
    expect(Object.hasOwn(icons, "constructor")).toBe(false);
    expect(Object.isFrozen(icons)).toBe(true);
  });
});
