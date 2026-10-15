import { act, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useActiveSection } from "./use-active-section";

/**
 * jsdom has no IntersectionObserver (and no layout to drive one), so the test
 * plays the browser: it holds every observer the hook creates and reports
 * intersections the way the platform would.
 */
class FakeObserver {
  static all: FakeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeObserver.all.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  takeRecords() {
    return [];
  }
  report(changes: Record<string, boolean>) {
    const entries = Object.entries(changes).map(
      ([id, isIntersecting]) => ({ target: document.getElementById(id)!, isIntersecting }) as unknown as IntersectionObserverEntry,
    );
    act(() => this.callback(entries, this as unknown as IntersectionObserver));
  }
}

const live = () => FakeObserver.all.filter((o) => !o.disconnected);
const IDS = ["intro", "usage", "api"];

function Sections() {
  return (
    <>
      {IDS.map((id) => (
        <section key={id} id={id} />
      ))}
    </>
  );
}

beforeEach(() => {
  FakeObserver.all = [];
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useActiveSection", () => {
  it("is null until a section is reported visible, then names it", () => {
    render(<Sections />);
    const { result } = renderHook(() => useActiveSection(IDS));
    expect(result.current).toBeNull();
    expect(live()).toHaveLength(1);
    expect(live()[0]!.observed.map((el) => el.id)).toEqual(IDS);

    live()[0]!.report({ usage: true });
    expect(result.current).toBe("usage");
  });

  it("picks the first visible section in the given order, not the latest report", () => {
    render(<Sections />);
    const { result } = renderHook(() => useActiveSection(IDS));
    live()[0]!.report({ api: true });
    live()[0]!.report({ intro: true });
    expect(result.current).toBe("intro");
    live()[0]!.report({ usage: true });
    expect(result.current).toBe("intro");
    live()[0]!.report({ intro: false });
    expect(result.current).toBe("usage");
  });

  it("keeps the last active section while none is visible", () => {
    render(<Sections />);
    const { result } = renderHook(() => useActiveSection(IDS));
    live()[0]!.report({ usage: true });
    live()[0]!.report({ usage: false });
    expect(result.current).toBe("usage");
  });

  it("skips ids with no element and observes nothing when none exist", () => {
    render(<Sections />);
    renderHook(() => useActiveSection(["missing", "api"]));
    expect(live()[0]!.observed.map((el) => el.id)).toEqual(["api"]);

    FakeObserver.all = [];
    renderHook(() => useActiveSection(["nowhere"]));
    expect(FakeObserver.all).toHaveLength(0);
  });

  it("does not re-observe for an equal list passed as a new array, and does for a changed one", () => {
    render(<Sections />);
    const { rerender } = renderHook(({ ids }) => useActiveSection(ids), { initialProps: { ids: [...IDS] } });
    rerender({ ids: [...IDS] });
    expect(FakeObserver.all).toHaveLength(1);

    rerender({ ids: ["api"] });
    expect(FakeObserver.all).toHaveLength(2);
    expect(FakeObserver.all[0]!.disconnected).toBe(true);
    expect(live()[0]!.observed.map((el) => el.id)).toEqual(["api"]);
  });

  it("observes the top 60% of the viewport by default, with no header offset of its own", () => {
    render(<Sections />);
    renderHook(() => useActiveSection(IDS));
    expect(live()[0]!.options?.rootMargin).toBe("0px 0px -40% 0px");
  });

  it("takes the caller's rootMargin, and re-observes when it changes", () => {
    render(<Sections />);
    const { rerender } = renderHook(({ rootMargin }) => useActiveSection(IDS, { rootMargin }), {
      initialProps: { rootMargin: "-64px 0px -40% 0px" },
    });
    expect(live()).toHaveLength(1);
    expect(live()[0]!.options?.rootMargin).toBe("-64px 0px -40% 0px");

    rerender({ rootMargin: "-96px 0px -50% 0px" });
    expect(FakeObserver.all).toHaveLength(2);
    expect(FakeObserver.all[0]!.disconnected).toBe(true);
    expect(live()).toHaveLength(1);
    expect(live()[0]!.options?.rootMargin).toBe("-96px 0px -50% 0px");
  });

  it("disconnects on unmount", () => {
    render(<Sections />);
    const { unmount } = renderHook(() => useActiveSection(IDS));
    unmount();
    expect(FakeObserver.all).toHaveLength(1);
    expect(FakeObserver.all[0]!.disconnected).toBe(true);
  });
});
