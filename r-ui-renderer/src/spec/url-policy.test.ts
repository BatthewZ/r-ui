import { safeUrl as librarySafeUrl } from "@batthewz/r-ui-react-components";
import { describe, expect, it } from "vitest";

import { defaultAllowImageUrl, defaultAllowUrl, NO_LOCATION_BASE, resolveUrl, safeUrl } from "./url-policy";

/**
 * URLs both judgements must agree on: both answers, and every axis the two
 * could drift on (scheme casing, characters a browser ignores mid-scheme,
 * tab/LF/CR, the data: carve-out, relative forms).
 */
const CORPUS = [
  "https://ok.example/x", "http://ok.example/x", "mailto:a@b.example", "tel:+441234",
  "/relative", "./sibling", "../up", "#anchor", "?q=1", "", "//cdn.example/a.png",
  "/path?x=a:b", "./a:b.md",
  "data:image/png;base64,iVBORw0KGgo=", "data:image/jpeg,x", "data:image/webp,x", "data:image/avif,x",
  "javascript:alert(1)", "JaVaScRiPt:alert(1)", "vbscript:msgbox(1)",
  "data:text/html;base64,PHNjcmlwdD4=", "data:image/svg+xml,<svg onload=alert(1)>",
  "data:application/xhtml+xml,<html/>", "data:image/pngx,y",
  "blob:https://evil.example/8f2c", "file:///etc/passwd", "ftp://files.example/x", "sms:+441234",
  "java\tscript:alert(1)", "java\nscript:alert(1)", " javascript:alert(1)",
  "java​script:alert(1)", "java﻿script:alert(1)", "\u0000javascript:alert(1)",
  "https://ok.example/a\tb",
];

describe("safeUrl", () => {
  it("judges every corpus URL as the component library does", () => {
    const allowed = CORPUS.filter((url) => librarySafeUrl(url) !== "");
    const refused = CORPUS.filter((url) => librarySafeUrl(url) === "");
    // Both answers are represented, so agreement is not two empty lists.
    expect(allowed.length).toBeGreaterThan(10);
    expect(refused.length).toBeGreaterThan(10);
    expect(CORPUS.map(safeUrl)).toEqual(CORPUS.map(librarySafeUrl));
  });
});

describe("origin policy", () => {
  const base = "https://app.example/page";

  it("resolves the way a browser does before judging the origin", () => {
    // Each starts with one slash, and each leaves the origin once resolved.
    expect(resolveUrl("/\\evil.example/x", base)?.origin).toBe("https://evil.example");
    expect(resolveUrl("//evil.example/x", base)?.origin).toBe("https://evil.example");
    expect(resolveUrl("/api/x", base)?.href).toBe("https://app.example/api/x");
    expect(resolveUrl("javascript:alert(1)", base)).toBeNull();
  });

  it("allows same-origin requests only", () => {
    expect(defaultAllowUrl(new URL("https://app.example/api"), base)).toBe(true);
    expect(defaultAllowUrl(new URL("https://evil.example/api"), base)).toBe(false);
    expect(defaultAllowUrl(new URL("http://app.example/api"), base)).toBe(false);
  });

  it("allows same-origin and data: raster images, nothing else", () => {
    expect(defaultAllowImageUrl(new URL("https://app.example/a.png"), base)).toBe(true);
    expect(defaultAllowImageUrl(new URL("data:image/png;base64,iVBORw0KGgo="), base)).toBe(true);
    expect(defaultAllowImageUrl(new URL("data:image/svg+xml,<svg/>"), base)).toBe(false);
    expect(defaultAllowImageUrl(new URL("https://cdn.example/a.png"), base)).toBe(false);
  });

  it("resolves against a reserved origin where there is no page", () => {
    expect(new URL(NO_LOCATION_BASE).hostname.endsWith(".invalid")).toBe(true);
  });
});
