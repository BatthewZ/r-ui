import { describe, expect, it } from "vitest";

import { safeUrl } from "./url";

/** The cases that made the allowlist the shape it is. */
describe("safeUrl", () => {
  const DANGEROUS = [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    " javascript:alert(1)",
    "java​script:alert(1)",
  ];

  it.each(DANGEROUS)("refuses %j", (url) => {
    expect(safeUrl(url)).toBe("");
  });

  /**
   * The vectors an allowlist catches and the denylist this replaced did not.
   * Every one of these was waved through when the rule was
   * `javascript|vbscript|data:text/html`.
   */
  it.each([
    "data:image/svg+xml,<svg onload=alert(1)>",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "data:application/xhtml+xml,<html/>",
    "data:text/xml,<root/>",
    "file:///etc/passwd",
    "blob:https://example.com/uuid",
    "ws://example.com",
    "intent://scan#Intent;scheme=zxing;end",
  ])("refuses %j, which a three-scheme denylist allows", (url) => {
    expect(safeUrl(url)).toBe("");
  });

  it.each([
    "https://example.com",
    "http://example.com",
    "/relative/path",
    "#anchor",
    "?query=1",
    "mailto:a@b.com",
    "tel:+441234",
    "./sibling.md",
    "../up/one.md",
    "data:image/png;base64,iVBOR",
    "data:image/webp;base64,UklGR",
    // No scheme: a colon that arrives after a path separator cannot start one.
    "./notes/a:b.md",
    "/path?x=javascript:alert(1)",
  ])("allows %j", (url) => {
    expect(safeUrl(url)).toBe(url);
  });

  /**
   * A separator the URL spec does NOT strip leaves a scheme no browser
   * recognises, so the string resolves as a relative path and is inert. The
   * allowlist reaches that answer by construction: anything it cannot read as a
   * known-safe scheme is either a relative path or refused, and there is no
   * third outcome to enumerate exotic separators against.
   */
  it.each([
    ["U+2028 line separator", "javascript :alert(1)"],
    ["U+3000 ideographic space", "javascript　:alert(1)"],
    ["percent-encoded j", "%6aavascript:alert(1)"],
    ["html entity tab", "java&#9;script:alert(1)"],
  ])("leaves %s as an inert relative path", (_label, url) => {
    // Not "": these are not the `javascript:` scheme, so refusing them would
    // refuse a legitimate relative path. What matters is that no browser reads
    // a scheme here either.
    expect(safeUrl(url)).toBe(url);
    expect(url).not.toMatch(/^javascript:/);
  });

  it("still strips the separators the URL spec DOES remove", () => {
    // Tab, newline and carriage return are removed from anywhere in a URL by
    // every browser, so `java<TAB>script:` really does navigate.
    for (const url of ["java\tscript:alert(1)", "java\nscript:alert(1)", "java\rscript:alert(1)"]) {
      expect(safeUrl(url)).toBe("");
    }
    // U+00A0 is refused too. Browsers do NOT strip it, so this is stricter than
    // the spec — the safe side of a judgement call, and worth pinning so a
    // later "cleanup" of the noise range notices it is deliberate.
    expect(safeUrl("javascript :alert(1)")).toBe("");
  });

});

