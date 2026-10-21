import { describe, expect, it } from "vitest";

import { locatePointer, offsetOf } from "./locate";

const TEXT = `{
  "version": 2,
  "title": "Ops",
  "root": {
    "component": "Stack",
    "children": [
      "first",
      { "component": "Link", "props": { "href": "javascript:alert(1)", "a/b": 1, "t~n": 2 } }
    ]
  }
}`;

/** The text a span covers. */
function at(text: string, pointer: string): string | undefined {
  const span = locatePointer(text, pointer);
  return span === undefined ? undefined : text.slice(span.start, span.end);
}

describe("locatePointer", () => {
  it("finds a value by key and by index", () => {
    expect(at(TEXT, "/title")).toBe('"Ops"');
    expect(at(TEXT, "/root/children/0")).toBe('"first"');
    expect(at(TEXT, "/root/children/1/props/href")).toBe('"javascript:alert(1)"');
  });

  it("covers a whole container", () => {
    expect(at(TEXT, "/root/children/1/props")).toBe('{ "href": "javascript:alert(1)", "a/b": 1, "t~n": 2 }');
  });

  it("unescapes ~1 and ~0", () => {
    expect(at(TEXT, "/root/children/1/props/a~1b")).toBe("1");
    expect(at(TEXT, "/root/children/1/props/t~0n")).toBe("2");
  });

  it("is the whole document at the empty pointer", () => {
    expect(at(TEXT, "")).toBe(TEXT);
  });

  it("lands on the deepest present ancestor of something absent", () => {
    expect(at(TEXT, "/root/children/1/props/target")).toBe('{ "href": "javascript:alert(1)", "a/b": 1, "t~n": 2 }');
    expect(at(TEXT, "/root/children/7")).toBe(TEXT.slice(TEXT.indexOf("["), TEXT.lastIndexOf("]") + 1));
  });

  it("does not match a key of the same name off the path", () => {
    const text = '{ "data": { "title": "inner" }, "title": "outer" }';
    expect(at(text, "/title")).toBe('"outer"');
  });

  it("counts from the start of the text when a code fence surrounds it", () => {
    const fenced = '```json\n{ "title": "Ops" }\n```';
    expect(at(fenced, "/title")).toBe('"Ops"');
  });

  it("keeps what it found before the text stops being JSON", () => {
    const broken = '{ "title": "Ops", "root": { "component": ';
    expect(at(broken, "/title")).toBe('"Ops"');
    expect(at(broken, "/root/component")).toBe('"component"');
  });

  it("finds nothing for a pointer that is not one", () => {
    expect(locatePointer(TEXT, "title")).toBeUndefined();
  });
});

describe("offsetOf", () => {
  it("turns a 1-based line and column into an offset", () => {
    const text = "ab\ncde\nf";
    expect(offsetOf(text, 1, 1)).toBe(0);
    expect(offsetOf(text, 2, 3)).toBe(5);
    expect(text.charAt(offsetOf(text, 3, 1))).toBe("f");
  });

  it("stops at the end of the text", () => {
    expect(offsetOf("ab", 4, 1)).toBe(2);
    expect(offsetOf("ab", 1, 9)).toBe(2);
  });
});
