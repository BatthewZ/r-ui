import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useDocumentTitle } from "./use-document-title";

describe("useDocumentTitle", () => {
  beforeEach(() => {
    document.title = "AI Site Starter";
  });

  it("sets document.title with the base suffix", () => {
    renderHook(() => useDocumentTitle("Dashboard"));
    expect(document.title).toBe("Dashboard | AI Site Starter");
  });

  it("restores previous title on unmount", () => {
    const { unmount } = renderHook(() => useDocumentTitle("Settings"));
    expect(document.title).toBe("Settings | AI Site Starter");

    unmount();
    expect(document.title).toBe("AI Site Starter");
  });

  it("updates when the title argument changes", () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: "Dashboard" },
    });
    expect(document.title).toBe("Dashboard | AI Site Starter");

    rerender({ title: "Settings" });
    expect(document.title).toBe("Settings | AI Site Starter");
  });

  it("uses base title alone when empty string is passed", () => {
    renderHook(() => useDocumentTitle(""));
    expect(document.title).toBe("AI Site Starter");
  });
});
