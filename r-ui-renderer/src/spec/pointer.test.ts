import { describe, expect, it } from "vitest";

import { appendPointer, parsePointer, toPointer } from "./pointer";

describe("JSON Pointer", () => {
  it("escapes ~ and / and round-trips", () => {
    const pointer = toPointer(["root", "children", 0, "props", "a/b~c"]);
    expect(pointer).toBe("/root/children/0/props/a~1b~0c");
    expect(parsePointer(pointer)).toEqual(["root", "children", "0", "props", "a/b~c"]);
    expect(appendPointer("", "root")).toBe("/root");
  });

  it("treats the empty string as the document and refuses a pointer without a leading slash", () => {
    expect(parsePointer("")).toEqual([]);
    expect(parsePointer("root")).toBeNull();
  });
});
