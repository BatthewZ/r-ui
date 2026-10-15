import { render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { DocumentTitleProvider, formatDocumentTitle, useDocumentTitle } from "./use-document-title";

function Page({ title, base }: { title: string; base?: string }) {
  useDocumentTitle(title, base === undefined ? undefined : { base });
  return null;
}

describe("useDocumentTitle", () => {
  beforeEach(() => {
    document.title = "Loading";
  });

  it("sets exactly the title by default: no base is assumed", () => {
    renderHook(() => useDocumentTitle("Dashboard"));
    expect(document.title).toBe("Dashboard");
  });

  it("appends a base given as an option, with the default separator", () => {
    renderHook(() => useDocumentTitle("Dashboard", { base: "Acme" }));
    expect(document.title).toBe("Dashboard | Acme");
  });

  it("takes base and separator from the nearest provider", () => {
    render(
      <DocumentTitleProvider base="Acme" separator=" · ">
        <Page title="Billing" />
      </DocumentTitleProvider>,
    );
    expect(document.title).toBe("Billing · Acme");
  });

  it("lets the option beat the provider, while the provider's separator still applies", () => {
    render(
      <DocumentTitleProvider base="Acme" separator=" · ">
        <Page title="Billing" base="Acme Admin" />
      </DocumentTitleProvider>,
    );
    expect(document.title).toBe("Billing · Acme Admin");
  });

  it("restores the previous title on unmount", () => {
    const { unmount } = renderHook(() => useDocumentTitle("Settings", { base: "Acme" }));
    expect(document.title).toBe("Settings | Acme");
    unmount();
    expect(document.title).toBe("Loading");
  });

  it("updates when the title changes", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DocumentTitleProvider base="Acme">{children}</DocumentTitleProvider>
    );
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: "Dashboard" },
      wrapper,
    });
    expect(document.title).toBe("Dashboard | Acme");
    rerender({ title: "Settings" });
    expect(document.title).toBe("Settings | Acme");
  });

  it("an empty title is the base alone; empty with no base leaves the title alone", () => {
    const { unmount } = renderHook(() => useDocumentTitle("", { base: "Acme" }));
    expect(document.title).toBe("Acme");
    unmount();
    renderHook(() => useDocumentTitle(""));
    expect(document.title).toBe("Loading");
  });
});

describe("formatDocumentTitle", () => {
  it("joins title and base, skipping whichever is empty", () => {
    expect(formatDocumentTitle("Docs", { base: "Acme", separator: " — " })).toBe("Docs — Acme");
    expect(formatDocumentTitle("Docs")).toBe("Docs");
    expect(formatDocumentTitle("", { base: "Acme" })).toBe("Acme");
  });
});
