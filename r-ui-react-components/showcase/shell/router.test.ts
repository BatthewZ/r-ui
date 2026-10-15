import { describe, expect, it } from "vitest";

import { href, parseHash } from "./router";

describe("parseHash", () => {
  it("reads the page and the decoded anchor, and falls back on an empty hash", () => {
    expect(parseHash("#/overview/form-button", "overview")).toEqual({ page: "overview", anchor: "form-button" });
    expect(parseHash(href("stress", "a b"), "overview")).toEqual({ page: "stress", anchor: "a b" });
    expect(parseHash("", "overview")).toEqual({ page: "overview", anchor: null });
  });

  // The hash is whatever the address bar holds: a stray `%` must not take the app down.
  it("keeps a malformed escape as written instead of throwing", () => {
    expect(parseHash("#/overview/100%", "overview")).toEqual({ page: "overview", anchor: "100%" });
    expect(parseHash("#/overview/%E0%A4%A", "overview")).toEqual({ page: "overview", anchor: "%E0%A4%A" });
  });
});
