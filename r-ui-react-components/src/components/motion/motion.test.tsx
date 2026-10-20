import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ScrollReveal } from "./ScrollReveal";
import { Stagger, STAGGER_MAX_INDEX } from "./Stagger";
import { startViewTransition, useViewTransition, type ViewTransitionRun } from "./view-transition";

/**
 * A controllable IntersectionObserver, installed per test (its absence is a
 * shipped branch: content stays static). `enter()` reports every observed
 * element as fully in view.
 */
function stubObserver() {
  const observers: Array<{ callback: IntersectionObserverCallback; targets: Element[]; disconnected: boolean }> = [];
  class FakeObserver {
    record: (typeof observers)[number];
    constructor(callback: IntersectionObserverCallback) {
      this.record = { callback, targets: [], disconnected: false };
      observers.push(this.record);
    }
    observe(target: Element) {
      this.record.targets.push(target);
    }
    disconnect() {
      this.record.disconnected = true;
    }
    unobserve() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  const report = (isIntersecting: boolean, top: number) =>
    act(() => {
      for (const o of observers.filter((o) => !o.disconnected)) {
        const entries = o.targets.map(
          (target) =>
            ({
              target,
              isIntersecting,
              intersectionRatio: isIntersecting ? 1 : 0,
              intersectionRect: { height: isIntersecting ? 100 : 0 },
              boundingClientRect: { top },
              rootBounds: { height: 800 },
            }) as unknown as IntersectionObserverEntry
        );
        o.callback(entries, o as unknown as IntersectionObserver);
      }
    });
  return {
    observers,
    enter: () => report(true, 100),
    leaveBelow: () => report(false, 900),
  };
}

/** jsdom lays nothing out: every rect is 0×0 at the origin. Place elements below a 768px-tall window. */
function placeBelowFold() {
  return vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    top: 2000,
    bottom: 2200,
    left: 0,
    right: 400,
    width: 400,
    height: 200,
    x: 0,
    y: 2000,
    toJSON: () => ({}),
  });
}

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: matches && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ScrollReveal", () => {
  it("hides content below the fold, then plays its entrance once it scrolls into view", () => {
    const io = stubObserver();
    placeBelowFold();
    render(<ScrollReveal data-testid="reveal">Pricing</ScrollReveal>);
    const el = screen.getByTestId("reveal");
    expect(el).toHaveClass("scroll-reveal-hidden");
    expect(el).toHaveAttribute("data-reveal", "hidden");

    io.enter();
    expect(el).not.toHaveClass("scroll-reveal-hidden");
    expect(el).toHaveClass("animate-fade-up");
    // Once: the observer lets go, and leaving the view changes nothing.
    expect(io.observers.every((o) => o.disconnected)).toBe(true);
    io.leaveBelow();
    expect(el).toHaveAttribute("data-reveal", "revealed");
  });

  it("with once={false}, hides again when it falls back below the fold", () => {
    const io = stubObserver();
    placeBelowFold();
    render(
      <ScrollReveal data-testid="reveal" once={false} animation="scale-in">
        Pricing
      </ScrollReveal>
    );
    const el = screen.getByTestId("reveal");
    io.enter();
    expect(el).toHaveClass("animate-scale-in");
    io.leaveBelow();
    expect(el).toHaveClass("scroll-reveal-hidden");
  });

  it("never hides content that is already on screen at mount", () => {
    const io = stubObserver();
    // jsdom's default rect: 0×0 at the origin, inside the window.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      top: 10, bottom: 60, left: 0, right: 400, width: 400, height: 50, x: 0, y: 10, toJSON: () => ({}),
    });
    render(<ScrollReveal data-testid="reveal">Hero</ScrollReveal>);
    const el = screen.getByTestId("reveal");
    expect(el).toHaveAttribute("data-reveal", "static");
    expect(el.className).toBe("");
    expect(io.observers).toHaveLength(0);
  });

  it("under reduced motion the content is shown as it is, with no observer", () => {
    stubReducedMotion(true);
    const io = stubObserver();
    placeBelowFold();
    render(<ScrollReveal data-testid="reveal">Pricing</ScrollReveal>);
    const el = screen.getByTestId("reveal");
    expect(el).toHaveAttribute("data-reveal", "static");
    expect(el).not.toHaveClass("scroll-reveal-hidden");
    expect(io.observers).toHaveLength(0);
  });

  it("without IntersectionObserver the content is shown", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    placeBelowFold();
    render(<ScrollReveal data-testid="reveal">Pricing</ScrollReveal>);
    expect(screen.getByTestId("reveal")).not.toHaveClass("scroll-reveal-hidden");
  });

  it("renders the element asked for, keeping the caller's class and ref", () => {
    stubObserver();
    placeBelowFold();
    let node: HTMLElement | null = null;
    render(
      <ScrollReveal as="section" className="py-section-2" ref={(el: HTMLElement | null) => void (node = el)} aria-label="Plans">
        Plans
      </ScrollReveal>
    );
    const section = screen.getByRole("region", { name: "Plans" });
    expect(section.tagName).toBe("SECTION");
    expect(section).toHaveClass("py-section-2", "scroll-reveal-hidden");
    expect(node).toBe(section);
  });
});

describe("Stagger", () => {
  it("puts .stagger-item and its index on each child, in place (no wrappers)", () => {
    render(
      <Stagger as="ul" trigger="mount">
        <li className="mine">One</li>
        {null}
        <li style={{ color: "inherit" }}>Two</li>
        <li>Three</li>
      </Stagger>
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]?.parentElement?.tagName).toBe("UL");
    expect(items.map((li) => li.style.getPropertyValue("--stagger-index"))).toEqual(["0", "1", "2"]);
    expect(items[0]).toHaveClass("mine", "stagger-item", "animate-fade-up");
    expect(items[1]?.style.color).toBe("inherit");
  });

  it("caps the index so a long list never waits long", () => {
    render(
      <Stagger trigger="mount" animation="fade-in">
        {Array.from({ length: STAGGER_MAX_INDEX + 5 }, (_, i) => (
          <p key={i}>Item {i}</p>
        ))}
      </Stagger>
    );
    const last = screen.getByText(`Item ${STAGGER_MAX_INDEX + 4}`);
    expect(last.style.getPropertyValue("--stagger-index")).toBe(String(STAGGER_MAX_INDEX));
    expect(last).toHaveClass("animate-fade-in");
  });

  it("with the default scroll trigger, waits below the fold and plays when it arrives", () => {
    const io = stubObserver();
    placeBelowFold();
    render(
      <Stagger data-testid="group">
        <p>One</p>
        <p>Two</p>
      </Stagger>
    );
    const group = screen.getByTestId("group");
    expect(group).toHaveClass("scroll-reveal-hidden");
    expect(screen.getByText("One")).not.toHaveClass("stagger-item");
    io.enter();
    expect(group).not.toHaveClass("scroll-reveal-hidden");
    expect(screen.getByText("Two")).toHaveClass("stagger-item", "animate-fade-up");
  });

  it("on screen at mount, nothing hides and nothing plays, even when it later reports in view", () => {
    const io = stubObserver();
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      top: 10, bottom: 60, left: 0, right: 400, width: 400, height: 50, x: 0, y: 10, toJSON: () => ({}),
    });
    render(
      <Stagger data-testid="group">
        <p>One</p>
      </Stagger>
    );
    const group = screen.getByTestId("group");
    expect(group).toHaveAttribute("data-reveal", "static");
    expect(group).not.toHaveClass("scroll-reveal-hidden");
    io.enter();
    expect(screen.getByText("One")).not.toHaveClass("stagger-item");
  });

  it("under reduced motion, below the fold, nothing hides, nothing plays and nothing observes", () => {
    stubReducedMotion(true);
    const io = stubObserver();
    placeBelowFold();
    render(
      <Stagger data-testid="group">
        <p>One</p>
      </Stagger>
    );
    expect(screen.getByTestId("group")).not.toHaveClass("scroll-reveal-hidden");
    expect(screen.getByText("One")).not.toHaveClass("stagger-item");
    expect(io.observers).toHaveLength(0);
  });
});

/**
 * A stand-in for `document.startViewTransition`, shaped as the browser runs it: the
 * update after the old view is captured (a microtask here), `finished` once the
 * animation ends (`end()`), or right after the update when the browser skips it.
 */
function stubTransitionApi({ skip = false } = {}) {
  let end = () => {};
  const ended = new Promise<void>((resolve) => (end = resolve));
  const start = vi.fn((update: () => void | Promise<void>) => {
    const updateCallbackDone = Promise.resolve().then(update);
    return {
      ready: skip ? Promise.reject(new DOMException("Skipped", "AbortError")) : updateCallbackDone,
      updateCallbackDone,
      finished: skip ? updateCallbackDone : updateCallbackDone.then(() => ended),
    };
  });
  Object.assign(document, { startViewTransition: start });
  return { start, end: () => end() };
}

/** Whether a promise has settled, read after the microtasks queued so far have run. */
function track(promise: Promise<unknown>) {
  const state = { settled: false, rejected: false };
  promise.then(
    () => (state.settled = true),
    () => Object.assign(state, { settled: true, rejected: true })
  );
  return state;
}
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("view transitions", () => {
  afterEach(() => {
    delete (document as unknown as Record<string, unknown>).startViewTransition;
  });

  it("runs the update at once where the API is missing, and finishes right after it", async () => {
    const update = vi.fn();
    const run = startViewTransition(update);
    expect(update).toHaveBeenCalledTimes(1);
    expect(run.finished).toBeInstanceOf(Promise);
    await expect(run).resolves.toBeUndefined();
    await expect(run.finished).resolves.toBeUndefined();
  });

  it("skips the transition under reduced motion: the update applies at once and it finishes right after", async () => {
    stubReducedMotion(true);
    const { start } = stubTransitionApi();
    const update = vi.fn();
    const run = startViewTransition(update);
    expect(start).toHaveBeenCalledTimes(0);
    expect(update).toHaveBeenCalledTimes(1);
    expect(run.finished).toBeInstanceOf(Promise);
    await expect(run.finished).resolves.toBeUndefined();
  });

  it("wraps the update in document.startViewTransition; the run settles on the update, finished on the animation's end", async () => {
    const { start, end } = stubTransitionApi();
    const update = vi.fn();
    const run = startViewTransition(update);
    const finished = track(run.finished);
    expect(start).toHaveBeenCalledTimes(1);
    await run;
    expect(update).toHaveBeenCalledTimes(1);
    await flushMicrotasks();
    expect(finished.settled).toBe(false);
    end();
    await expect(run.finished).resolves.toBeUndefined();
  });

  it("a transition the browser skips still applies the update, and neither promise rejects", async () => {
    stubTransitionApi({ skip: true });
    const update = vi.fn();
    const run = startViewTransition(update);
    const applied = track(run);
    const finished = track(run.finished);
    await flushMicrotasks();
    expect(update).toHaveBeenCalledTimes(1);
    expect(applied).toEqual({ settled: true, rejected: false });
    expect(finished).toEqual({ settled: true, rejected: false });
  });

  it("an update that throws rejects the run with its error, while finished still settles", async () => {
    const boom = () => {
      throw new Error("boom");
    };
    stubTransitionApi();
    const native = startViewTransition(boom);
    await expect(native).rejects.toThrow("boom");
    await expect(native.finished).resolves.toBeUndefined();

    delete (document as unknown as Record<string, unknown>).startViewTransition;
    const direct = startViewTransition(boom);
    await expect(direct).rejects.toThrow("boom");
    await expect(direct.finished).resolves.toBeUndefined();
  });

  it("the hook flushes a React update inside the transition, so the new view is rendered when it snapshots, and reports the animation's end", async () => {
    let renderedInside: string | null = null;
    let end = () => {};
    const ended = new Promise<void>((resolve) => (end = resolve));
    Object.assign(document, {
      startViewTransition: (cb: () => void) => {
        cb();
        renderedInside = screen.getByRole("status").textContent;
        return { ready: Promise.resolve(), updateCallbackDone: Promise.resolve(), finished: ended };
      },
    });
    let run: ViewTransitionRun | undefined;
    function Layout() {
      const [layout, setLayout] = useState("list");
      const transition = useViewTransition();
      return (
        <>
          <output>{layout}</output>
          <button onClick={() => (run = transition(() => setLayout("grid")))}>Grid</button>
        </>
      );
    }
    render(<Layout />);
    await act(async () => screen.getByRole("button").click());
    expect(renderedInside).toBe("grid");
    expect(run).toBeInstanceOf(Promise);
    const finished = track(run!.finished);
    await flushMicrotasks();
    expect(finished.settled).toBe(false);
    end();
    await expect(run!.finished).resolves.toBeUndefined();
  });
});
