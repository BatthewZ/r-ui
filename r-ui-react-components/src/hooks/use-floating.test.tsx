import { act, renderHook, waitFor } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { floatingArrowProps, useFloating } from "./use-floating";

type FloatingConfig = Parameters<typeof useFloating>[0];

const VIEWPORT = { width: 1024, height: 768 };
const REFERENCE_RECT = { x: 100, y: 100, width: 50, height: 20 };

const spawned: HTMLElement[] = [];

/**
 * floating-ui reads the viewport from `documentElement.client{Width,Height}`,
 * which jsdom leaves at 0 — so without this every placement overflows and
 * `flip()`/`shift()` clamp the result to the origin, hiding the real maths.
 */
beforeEach(() => {
  for (const [prop, value] of [
    ["clientWidth", VIEWPORT.width],
    ["clientHeight", VIEWPORT.height],
  ] as const) {
    Object.defineProperty(document.documentElement, prop, {
      value,
      configurable: true,
    });
  }
});

afterEach(() => {
  for (const prop of ["clientWidth", "clientHeight"]) {
    delete (document.documentElement as unknown as Record<string, unknown>)[prop];
  }
  for (const el of spawned.splice(0)) el.remove();
  vi.restoreAllMocks();
});

/**
 * jsdom computes no layout, so every element reports a 0x0 box at the origin.
 * Stubbing the reference's rect gives the middleware real numbers to position
 * against; the floating element stays 0x0 (floating-ui takes its size from
 * layout, not from `getBoundingClientRect`), which is why the expectations
 * below are expressed purely in terms of the reference box.
 */
function spawn(rect?: typeof REFERENCE_RECT) {
  const el = document.createElement("div");
  if (rect) {
    el.getBoundingClientRect = () =>
      ({
        ...rect,
        top: rect.y,
        left: rect.x,
        right: rect.x + rect.width,
        bottom: rect.y + rect.height,
        toJSON: () => rect,
      }) as DOMRect;
  }
  document.body.append(el);
  spawned.push(el);
  return el;
}

/** Renders the hook with both elements attached, so floating-ui actually positions. */
function renderFloating(config: FloatingConfig = {}) {
  const reference = spawn(REFERENCE_RECT);
  const floating = spawn();

  const utils = renderHook(() => {
    const floatingResult = useFloating(config);
    useLayoutEffect(() => {
      floatingResult.refs.setReference(reference);
      floatingResult.refs.setFloating(floating);
    }, [floatingResult.refs]);
    return floatingResult;
  });

  return { ...utils, reference, floating };
}

describe("useFloating", () => {
  it("stores the attached elements on refs.reference and refs.floating", async () => {
    const { result, reference, floating } = renderFloating();

    await waitFor(() => expect(result.current.isPositioned).toBe(true));

    expect(result.current.refs.reference.current).toBe(reference);
    expect(result.current.refs.floating.current).toBe(floating);
  });

  it("positions the floating element below the reference by the default 8px offset", async () => {
    const { result } = renderFloating();

    await waitFor(() => expect(result.current.isPositioned).toBe(true));

    // bottom placement: y = reference bottom (120) + 8; x centres on the reference.
    expect(result.current.floatingStyles).toMatchObject({
      position: "absolute",
      transform: "translate(125px, 128px)",
    });
  });

  it("hides the panel while its anchor is scrolled out of view, and shows it again when it returns", async () => {
    const { result, reference, floating } = renderFloating();
    await waitFor(() => expect(result.current.isPositioned).toBe(true));
    expect(result.current.referenceHidden).toBe(false);
    expect(floating).not.toHaveAttribute("data-reference-hidden");

    // The page scrolled: the trigger now sits entirely above the viewport.
    const above = { ...REFERENCE_RECT, y: -200 };
    reference.getBoundingClientRect = () =>
      ({ ...above, top: above.y, left: above.x, right: above.x + above.width, bottom: above.y + above.height }) as DOMRect;
    await act(async () => {
      result.current.update();
    });
    await waitFor(() => expect(result.current.referenceHidden).toBe(true));
    expect(floating).toHaveAttribute("data-reference-hidden");

    // Scrolled back: visible again, positioned against the anchor.
    reference.getBoundingClientRect = () =>
      ({ ...REFERENCE_RECT, top: 100, left: 100, right: 150, bottom: 120 }) as DOMRect;
    await act(async () => {
      result.current.update();
    });
    await waitFor(() => expect(result.current.referenceHidden).toBe(false));
    expect(floating).not.toHaveAttribute("data-reference-hidden");
    expect(result.current.floatingStyles.transform).toBe("translate(125px, 128px)");
  });

  it("returns the default placement of 'bottom'", () => {
    const { result } = renderHook(() => useFloating());

    expect(result.current.placement).toBe("bottom");
  });

  it("positions above and start-aligned for placement 'top-start'", async () => {
    const { result } = renderFloating({ placement: "top-start" });

    await waitFor(() => expect(result.current.isPositioned).toBe(true));

    expect(result.current.placement).toBe("top-start");
    // top: y = reference top (100) - 8; start: x = reference left (100).
    expect(result.current.floatingStyles.transform).toBe("translate(100px, 92px)");
  });

  it("offsetPx sets the gap between reference and floating element", async () => {
    const { result } = renderFloating({ offsetPx: 16 });

    await waitFor(() => expect(result.current.isPositioned).toBe(true));

    // 8px further from the reference bottom than the default offset of 8.
    expect(result.current.floatingStyles.transform).toBe("translate(125px, 136px)");
  });

  it("isPositioned stays false until both elements are attached", async () => {
    const reference = spawn(REFERENCE_RECT);
    const floating = spawn();
    const { result } = renderHook(() => useFloating());

    expect(result.current.isPositioned).toBe(false);
    expect(result.current.floatingStyles.transform).toBeUndefined();

    act(() => {
      result.current.refs.setReference(reference);
      result.current.refs.setFloating(floating);
    });

    await waitFor(() => expect(result.current.isPositioned).toBe(true));
    expect(result.current.floatingStyles.transform).toBe("translate(125px, 128px)");
  });

  it("removes its autoUpdate scroll/resize listeners on unmount", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { result, unmount } = renderFloating();
    await waitFor(() => expect(result.current.isPositioned).toBe(true));

    // `whileElementsMounted: autoUpdate` tracks both elements' overflow ancestors.
    const added = addSpy.mock.calls.filter(
      ([type]) => type === "scroll" || type === "resize",
    );
    expect(added).toHaveLength(4);
    expect(removeSpy).not.toHaveBeenCalled();

    unmount();

    for (const [type, handler] of added) {
      expect(removeSpy).toHaveBeenCalledWith(type, handler);
    }
    expect(removeSpy).toHaveBeenCalledTimes(added.length);
  });

  it("forwards open and onOpenChange to the floating-ui context", () => {
    const onOpenChange = vi.fn();

    const { result } = renderHook(() => useFloating({ open: true, onOpenChange }));

    expect(result.current.context.open).toBe(true);

    act(() => {
      result.current.context.onOpenChange(false);
    });

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });

  it("adds the arrow middleware only when given an arrowRef", async () => {
    const without = renderFloating();
    await waitFor(() => expect(without.result.current.isPositioned).toBe(true));
    expect(without.result.current.middlewareData.arrow).toBeUndefined();

    const arrowRef = { current: spawn() };
    const withRef = renderFloating({ arrowRef });
    await waitFor(() => expect(withRef.result.current.isPositioned).toBe(true));
    expect(withRef.result.current.middlewareData.arrow).toBeDefined();
  });

  it("reads a null arrowRef as no arrow, so the option costs nothing unused", async () => {
    const { result } = renderFloating({ arrowRef: { current: null } });

    await waitFor(() => expect(result.current.isPositioned).toBe(true));

    // The middleware is in the stack but contributes *no offset* while `current`
    // is null — which is what lets a surface pass the ref unconditionally and
    // render the element only on request.
    expect(result.current.middlewareData.arrow).toEqual({});
    expect(floatingArrowProps("bottom", result.current.middlewareData.arrow).style).not.toHaveProperty(
      "left",
    );
    expect(result.current.floatingStyles.transform).toBe("translate(125px, 128px)");
  });
});

describe("useFloating — in place, promoted to the top layer", () => {
  type PopoverProto = { showPopover?: () => void; hidePopover?: () => void };
  const proto = HTMLElement.prototype as unknown as PopoverProto;
  let original: PopoverProto;

  /** Give jsdom (or override) the popover API, so the promotion path runs. */
  function stubPopover(show: () => void = () => {}) {
    original = { showPopover: proto.showPopover, hidePopover: proto.hidePopover };
    const showPopover = vi.fn(show);
    const hidePopover = vi.fn();
    proto.showPopover = showPopover;
    proto.hidePopover = hidePopover;
    return { showPopover, hidePopover };
  }

  afterEach(() => {
    if (original) {
      proto.showPopover = original.showPopover;
      proto.hidePopover = original.hidePopover;
    }
  });

  it("promotes the panel without moving it: popover=manual, fixed strategy, same parent", async () => {
    const { showPopover } = stubPopover();
    const host = spawn();
    const { result, floating } = renderFloating();
    host.append(floating);

    await waitFor(() => expect(result.current.topLayer).toBe(true));
    await waitFor(() => expect(result.current.floatingStyles.position).toBe("fixed"));

    expect(floating.getAttribute("popover")).toBe("manual");
    expect(floating.classList.contains("r-floating-top-layer")).toBe(true);
    expect(showPopover).toHaveBeenCalled();
    // Never portalled: the panel is still where it was written, so it keeps
    // inheriting custom properties (density) from that subtree.
    expect(floating.parentElement).toBe(host);
  });

  it("does not promote a panel the caller says is closed", async () => {
    const { showPopover } = stubPopover();
    const { result, floating } = renderFloating({ open: false });

    await waitFor(() => expect(result.current.isPositioned).toBe(false));
    expect(result.current.topLayer).toBe(false);
    expect(floating.hasAttribute("popover")).toBe(false);
    expect(showPopover).not.toHaveBeenCalled();
  });

  it("takes the attribute back off when the promotion throws, so the panel still renders", async () => {
    stubPopover(() => {
      throw new Error("NotSupportedError");
    });
    const { result, floating } = renderFloating();

    await waitFor(() => expect(result.current.topLayer).toBe(true));
    expect(floating.hasAttribute("popover")).toBe(false);
    expect(floating.classList.contains("r-floating-top-layer")).toBe(false);
  });

  it("hides and un-marks the panel on unmount", async () => {
    const { hidePopover } = stubPopover();
    const { result, floating, unmount } = renderFloating();
    await waitFor(() => expect(result.current.topLayer).toBe(true));
    await waitFor(() => expect(floating.hasAttribute("popover")).toBe(true));

    unmount();

    expect(hidePopover).toHaveBeenCalled();
    expect(floating.hasAttribute("popover")).toBe(false);
  });
});

describe("floatingArrowProps", () => {
  /**
   * The arrow sits on the edge of the floating element that *faces* the
   * reference, which is the opposite of the placement — and it takes the
   * resolved placement, so a `flip()` carries the arrow across with the panel.
   */
  it("pins the arrow to the edge opposite the resolved placement", () => {
    expect(floatingArrowProps("bottom", undefined)["data-side"]).toBe("top");
    expect(floatingArrowProps("top-start", undefined)["data-side"]).toBe("bottom");
    expect(floatingArrowProps("left-end", undefined)["data-side"]).toBe("right");
    expect(floatingArrowProps("right", undefined)["data-side"]).toBe("left");
  });

  it("half-overlaps the panel with a percentage of the arrow's own box", () => {
    // A percentage rather than a measured length, so a consumer resizing the
    // element through `classNames.arrow` stays correctly seated.
    expect(floatingArrowProps("bottom", undefined).style).toMatchObject({
      top: 0,
      translate: "0 -50%",
    });
    expect(floatingArrowProps("left", undefined).style).toMatchObject({
      right: 0,
      translate: "50% 0",
    });
  });

  it("takes the cross-axis offset from the middleware, and only that axis", () => {
    expect(floatingArrowProps("bottom", { x: 42 }).style).toMatchObject({
      left: "42px",
      top: 0,
    });
    expect(floatingArrowProps("right", { y: 12 }).style).toMatchObject({
      top: "12px",
      left: 0,
    });
  });

  it("keeps the edge pin when the middleware reports both axes", () => {
    // Defensive: floating-ui reports one axis per placement today. If that ever
    // changed, the pin has to win or the arrow floats off the edge.
    expect(floatingArrowProps("bottom", { x: 42, y: 99 }).style).toMatchObject({
      left: "42px",
      top: 0,
    });
  });
});
