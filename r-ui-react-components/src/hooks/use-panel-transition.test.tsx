import { fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePanelTransition, type UsePanelTransitionOptions } from "./use-panel-transition";

const motion = vi.hoisted(() => ({ reduced: false }));

vi.mock("./use-reduced-motion", () => ({
  usePrefersReducedMotion: () => motion.reduced,
}));

afterEach(() => {
  motion.reduced = false;
});

// jsdom exposes no `AnimationEvent` constructor, and React picks one of these two
// names by vendor-prefix detection — dispatching a single name silently reaches
// nothing, and a test asserting a consequence of the handler then passes for the
// wrong reason. Dispatching both fires the handler exactly once.
function fireAnimationEnd(el: Element) {
  for (const name of ["animationend", "webkitAnimationEnd"]) {
    fireEvent(el, new Event(name, { bubbles: true }));
  }
}

/** The whole documented usage: render only `renderedValue`, keyed by it. */
function Panels({
  options,
  onRender,
}: {
  options?: UsePanelTransitionOptions;
  onRender?: () => void;
}) {
  const [active, setActive] = useState("a");
  const { renderedValue, phase, transitionClass, onPanelAnimationEnd, panelRef } =
    usePanelTransition(active, options);
  onRender?.();

  return (
    <div>
      {["a", "b", "c"].map((value) => (
        <button key={value} type="button" onClick={() => setActive(value)}>
          go {value}
        </button>
      ))}
      <div
        key={renderedValue}
        ref={panelRef}
        data-testid="panel"
        data-phase={phase}
        className={transitionClass}
        onAnimationEnd={onPanelAnimationEnd}
      >
        panel {renderedValue}
        <span data-testid={`child-${renderedValue}`} />
      </div>
    </div>
  );
}

const panel = () => screen.getByTestId("panel");

describe("usePanelTransition", () => {
  it("holds the outgoing value until its exit animation ends", () => {
    render(<Panels />);
    expect(panel()).toHaveTextContent("panel a");
    expect(panel()).toHaveClass("fade-in");

    fireEvent.click(screen.getByText("go b"));

    expect(panel()).toHaveTextContent("panel a");
    expect(panel()).toHaveClass("fade-out");
    expect(panel()).toHaveAttribute("data-phase", "exit");

    fireAnimationEnd(panel());

    expect(panel()).toHaveTextContent("panel b");
    expect(panel()).toHaveClass("fade-in");
    expect(panel()).toHaveAttribute("data-phase", "enter");
  });

  it("drops the queued exit when a second change arrives mid-animation", () => {
    render(<Panels />);
    fireEvent.click(screen.getByText("go b"));
    fireEvent.click(screen.getByText("go c"));

    // Not "b" — the backlog is dropped rather than drained, so someone moving
    // faster than the animation lands on what they last asked for.
    expect(panel()).toHaveTextContent("panel c");
    expect(panel()).toHaveAttribute("data-phase", "enter");
  });

  it("ignores a bubbled animationend from a child, which would cut the exit short", () => {
    render(<Panels />);
    fireEvent.click(screen.getByText("go b"));
    expect(panel()).toHaveAttribute("data-phase", "exit");

    fireAnimationEnd(screen.getByTestId("child-a"));

    expect(panel()).toHaveTextContent("panel a");
    expect(panel()).toHaveAttribute("data-phase", "exit");
  });

  it("skips the exit entirely under reduced motion, rather than shortening it", () => {
    motion.reduced = true;
    render(<Panels />);
    expect(panel()).not.toHaveAttribute("class");

    fireEvent.click(screen.getByText("go b"));

    expect(panel()).toHaveTextContent("panel b");
    expect(panel()).toHaveAttribute("data-phase", "enter");
    expect(panel()).not.toHaveClass("fade-out");
  });

  it("carries caller-supplied enter and exit classes instead of the fade pair", () => {
    render(<Panels options={{ enterClass: "slide-in-right", exitClass: "slide-out-right" }} />);
    expect(panel()).toHaveClass("slide-in-right");

    fireEvent.click(screen.getByText("go b"));
    expect(panel()).toHaveClass("slide-out-right");

    fireAnimationEnd(panel());
    expect(panel()).toHaveClass("slide-in-right");
  });

  it("treats null as a real panel value, not as 'nothing is exiting'", () => {
    // The exiting value is boxed for exactly this: a bare `T | null` cannot tell
    // a null panel apart from its own sentinel, and the swap away from one would
    // read as an exit that had already finished.
    function NullablePanels() {
      const [active, setActive] = useState<string | null>(null);
      const { renderedValue, phase, onPanelAnimationEnd } = usePanelTransition(active);
      return (
        <div>
          <button type="button" onClick={() => setActive("b")}>
            go b
          </button>
          <div data-testid="panel" data-phase={phase} onAnimationEnd={onPanelAnimationEnd}>
            panel {String(renderedValue)}
          </div>
        </div>
      );
    }

    render(<NullablePanels />);
    expect(panel()).toHaveTextContent("panel null");

    fireEvent.click(screen.getByText("go b"));
    expect(panel()).toHaveTextContent("panel null");
    expect(panel()).toHaveAttribute("data-phase", "exit");

    fireAnimationEnd(panel());
    expect(panel()).toHaveTextContent("panel b");
  });

  it("does not start an exit when the value is re-set to the one already active", () => {
    render(<Panels />);
    fireEvent.click(screen.getByText("go a"));

    expect(panel()).toHaveAttribute("data-phase", "enter");
    expect(panel()).toHaveTextContent("panel a");
  });

  /**
   * The swap is derived during render, and React may invoke a component more
   * than once per update and discard the earlier invocations. Two `useState`
   * atoms tore under that: the replay kept one and reverted the other, so the
   * exit was dropped inside a frame and the FIRST swap of a component's life had
   * no exit animation while every later one did.
   *
   * **This test does not falsify that defect, and neither does any other test in
   * this repo.** Verified by reverting to the two-atom version: this stayed
   * green, as did the whole suite. jsdom does not reproduce React's replay, and
   * the symptom was a *paint* — the class reached the DOM and the browser never
   * started the animation, so every computed style an assertion could read was
   * already correct. It was found, and can only be
   * found, by measuring `animationstart`/`animationend` in a real browser.
   *
   * What it does hold is the observable contract on the first swap after mount
   * under a double-invoked render, which is worth pinning even though it is not
   * the guard. Do not read a green here as cover for a motion change.
   */
  it("still exits on the first swap after mount under a double-invoked render", () => {
    render(
      <StrictMode>
        <Panels />
      </StrictMode>,
    );

    fireEvent.click(screen.getByText("go b"));

    expect(panel()).toHaveAttribute("data-phase", "exit");
    expect(panel()).toHaveClass("fade-out");
    expect(panel()).toHaveTextContent("panel a");

    fireAnimationEnd(panel());
    expect(panel()).toHaveTextContent("panel b");
  });

  /**
   * `onPanelAnimationEnd` returns `prev` when nothing is exiting, which every
   * other test here is blind to — drop the bail-out and they all stay green,
   * because the resulting state is identical and only the render count differs.
   * The entering panel's own `fade-in` ends on every single swap, so without it
   * the hook re-renders its consumer once per animation for no reason. Counting
   * commits is the only thing that can see that.
   */
  /**
   * jsdom implements no animations and no `getAnimations`, so by default the
   * hook cannot ask whether an exit will run and waits for `animationend` —
   * which is what every test above simulates. Defining the API is what lets a
   * test play the part of a browser that CAN answer, and the two answers are
   * the whole contract: something is running, so wait; nothing is, so swap now.
   *
   * Stubbed on the prototype rather than the node because the hook reads it off
   * whatever element the ref last received, and the panel is re-created by its
   * `key` on every swap.
   */
  function stubGetAnimations(result: () => unknown[]) {
    const proto = Element.prototype as unknown as Record<string, unknown>;
    const had = "getAnimations" in proto;
    const original = proto.getAnimations;
    proto.getAnimations = function getAnimations() {
      return result();
    };
    return () => {
      if (had) proto.getAnimations = original;
      else delete proto.getAnimations;
    };
  }

  const runningAnimation = [{ animationName: "fade-out" }];

  it("waits for the exit when the panel reports a running animation", () => {
    const restore = stubGetAnimations(() => runningAnimation);
    try {
      render(<Panels />);
      fireEvent.click(screen.getByText("go b"));

      expect(panel()).toHaveAttribute("data-phase", "exit");
      expect(panel()).toHaveTextContent("panel a");

      fireAnimationEnd(panel());
      expect(panel()).toHaveTextContent("panel b");
    } finally {
      restore();
    }
  });

  it("swaps in the same commit when no animation is going to run", () => {
    const restore = stubGetAnimations(() => []);
    try {
      render(<Panels />);
      fireEvent.click(screen.getByText("go b"));

      // No `animationend` is fired here, and none is coming: an exit is a wait
      // for an animation, so with nothing to wait for the swap already
      // happened. The layout effect lands before paint, so the outgoing panel
      // is never shown for a frame on its way out.
      //
      // This falsifies the `getAnimations` check and nothing else. It does NOT
      // falsify `endExit` naming an absolute target: swap that for a relative
      // "collapse whatever is exiting" and this test stays green, because in
      // jsdom the layout effect sees the render-phase state, while in a browser
      // it sees the committed base and the relative form bails out. Verified by
      // reverting. That half is browser-only — see the note on `endExit`.
      expect(panel()).toHaveTextContent("panel b");
      expect(panel()).toHaveAttribute("data-phase", "enter");
    } finally {
      restore();
    }
  });

  it("does not mistake a running transition for the exit animation", () => {
    // A CSSTransition carries `transitionProperty`, never `animationName`.
    // Counting it would make the panel wait for an `animationend` that a
    // transition never fires.
    const restore = stubGetAnimations(() => [{ transitionProperty: "opacity" }]);
    try {
      render(<Panels />);
      fireEvent.click(screen.getByText("go b"));

      expect(panel()).toHaveTextContent("panel b");
      expect(panel()).toHaveAttribute("data-phase", "enter");
    } finally {
      restore();
    }
  });

  it("ends the exit when the animation is cancelled instead of finishing", () => {
    const restore = stubGetAnimations(() => runningAnimation);
    try {
      render(<Panels />);
      fireEvent.click(screen.getByText("go b"));
      expect(panel()).toHaveAttribute("data-phase", "exit");

      // An animation cut short — the panel hidden mid-flight — fires
      // `animationcancel` and never `animationend`. React has no synthetic
      // event for it, so this is the one path a native listener covers.
      fireEvent(panel(), new Event("animationcancel", { bubbles: true }));

      expect(panel()).toHaveTextContent("panel b");
      expect(panel()).toHaveAttribute("data-phase", "enter");
    } finally {
      restore();
    }
  });

  it("does not re-render on an animationend that ends nothing", () => {
    const onRender = vi.fn();
    render(<Panels onRender={onRender} />);

    const settled = onRender.mock.calls.length;
    fireAnimationEnd(panel());

    expect(onRender).toHaveBeenCalledTimes(settled);
    expect(panel()).toHaveAttribute("data-phase", "enter");
  });
});
