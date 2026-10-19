import { describe, expect, it } from "vitest";

import { href, parseHash, parseSoloAnchor, soloHref } from "./router";

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

describe("the solo route's anchor", () => {
  it("lists the section ids in order, once each, and the runway option", () => {
    expect(parseSoloAnchor("boards-kanban")).toEqual({ ids: ["boards-kanban"], runway: false });
    expect(parseSoloAnchor("form-input, form-select,form-input?runway")).toEqual({ ids: ["form-input", "form-select"], runway: true });
    expect(parseSoloAnchor(null)).toEqual({ ids: [], runway: false });
  });

  it("round-trips through the hash the shell parses", () => {
    const solo = { ids: ["navigation-tabs", "navigation-pagination"], runway: true };
    const { page, anchor } = parseHash(soloHref(solo), "overview");
    expect(page).toBe("solo");
    expect(parseSoloAnchor(anchor)).toEqual(solo);
  });
});
