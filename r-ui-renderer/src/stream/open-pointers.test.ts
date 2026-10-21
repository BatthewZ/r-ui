import { describe, expect, it, vi } from "vitest";

import * as pointers from "../spec/pointer";
import { OpenPointers } from "./open-pointers";

vi.mock("../spec/pointer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../spec/pointer")>();
  return { ...actual, parsePointer: vi.fn(actual.parsePointer) };
});

describe("OpenPointers", () => {
  const open = new OpenPointers(["root", "children", 3, "a/b~c", ""]);

  it("has exactly the document and each open value on the chain", () => {
    const chain = ["", "/root", "/root/children", "/root/children/3", "/root/children/3/a~1b~0c", "/root/children/3/a~1b~0c/"];
    for (const pointer of chain) expect(open.has(pointer), pointer).toBe(true);
    for (const pointer of ["/", "/roo", "/root/child", "/root/children/30", "/root/children/2", "/root/children/3/a", "/root/children/3/a~1b~0c//", "root"]) {
      expect(open.has(pointer), pointer).toBe(false);
    }
    expect([...open]).toEqual(chain);
    expect(open.size).toBe(chain.length);
  });

  it("answers `has` for every sibling without parsing a pointer", () => {
    const parse = vi.mocked(pointers.parsePointer);
    parse.mockClear();
    const wide = new OpenPointers(["root", "children", 999]);
    for (let index = 0; index < 1000; index += 1) expect(wide.has(`/root/children/${index}`)).toBe(index === 999);
    expect(parse).not.toHaveBeenCalled();
  });
});
