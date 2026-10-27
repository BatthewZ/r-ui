"use client";
import {
  arrow,
  autoUpdate,
  flip,
  hide,
  offset as offsetBy,
  type Placement,
  shift,
  useFloating as useFloatingUI,
  type UseFloatingReturn as FloatingUIReturn,
  type VirtualElement,
} from "@floating-ui/react";
import { type CSSProperties, type RefObject, useLayoutEffect, useState } from "react";

import { resolveLength } from "../util/resolve-length";

export type { Placement };

/**
 * The marker the top-layer reset is written against. Added here rather than in
 * each surface's `className` because the reset must apply exactly when the
 * promotion does — one effect owns both, so they cannot drift apart.
 *
 * `src/floating.css` holds the rules and says why each one is needed.
 */
const TOP_LAYER_CLASS = "r-floating-top-layer";

/** Set while the anchor is scrolled out of view or clipped away; see `src/floating.css`. */
const REFERENCE_HIDDEN_ATTR = "data-reference-hidden";

/**
 * Whether this engine can promote an element into the top layer on its own.
 * `popover` is Baseline 2024. Without it the panel still renders in place,
 * absolutely positioned: correct everywhere except inside an ancestor that
 * clips (a scrollport, a modal `<dialog>`), which is the old-engine fallback.
 *
 * One answer, read by both the promotion and the positioning strategy, so the
 * two can never disagree. SSR-safe: `topLayer` starts `false` and only moves
 * in a layout effect, so the first client render matches the server's.
 */
function supportsTopLayerPromotion(): boolean {
  return (
    typeof HTMLElement !== "undefined" && typeof HTMLElement.prototype.showPopover === "function"
  );
}

/**
 * Promotes a floating panel into the top layer WITHOUT moving it in the DOM.
 *
 * This is the library's floating model: a panel (menu, popover, tooltip,
 * listbox) renders IN PLACE, as a DOM descendant of its trigger's subtree, and
 * is lifted into the top layer with `popover="manual"` + `showPopover()`. Two
 * things follow, and both are the point:
 *
 * - It INHERITS from where it is written. Custom properties inherit through
 *   the DOM tree, not the paint order, so a dropdown opened inside a
 *   `[data-density="compact"]` card renders compact. A portal to `<body>`
 *   would silently re-inherit the page's comfortable density.
 * - It ESCAPES every clip. The top layer paints above the whole document, out
 *   of every ancestor's `overflow` and stacking context; inside a modal
 *   `<dialog>` it stays a descendant, so the dialog's inert-outside rule never
 *   swallows its clicks.
 *
 * `manual`, not `auto`: dismissal stays entirely with `useDismiss`; the
 * platform's own light-dismiss and popover stack never take part (measured in
 * the previous generation: `auto` closed a nested popover on the very click
 * that opened it).
 *
 * The attribute and `showPopover()` are one step, in that order:
 * `[popover]:not(:popover-open) { display: none }` is a UA rule, so a failed
 * promotion has to take the attribute back off with it.
 */
function useTopLayer(floating: HTMLElement | null, enabled: boolean): void {
  useLayoutEffect(() => {
    if (!enabled || !floating) return;

    floating.classList.add(TOP_LAYER_CLASS);
    floating.setAttribute("popover", "manual");
    try {
      floating.showPopover();
    } catch {
      floating.classList.remove(TOP_LAYER_CLASS);
      floating.removeAttribute("popover");
      return;
    }

    return () => {
      // Detaching the node already takes it out of the top layer, and
      // `hidePopover()` on an element that is no longer showing throws.
      try {
        floating.hidePopover();
      } catch {
        /* already out of the top layer */
      }
      floating.classList.remove(TOP_LAYER_CLASS);
      floating.removeAttribute("popover");
    };
  }, [floating, enabled]);
}

interface UseFloatingConfig {
  placement?: Placement;
  /**
   * The custom property naming the gap between the reference and the panel
   * (`"--R-SIZE-4"` by default). Read at the reference each time the position
   * computes, so the gap follows the density written there.
   */
  offset?: `--${string}`;
  /**
   * The pointer triangle to position, if the surface renders one. Typed
   * `Element | null` because that is what `useRef<HTMLDivElement>(null)` produces
   * — the previous `RefObject<Element>` could not receive one without a cast.
   */
  arrowRef?: RefObject<Element | null>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** The side of the floating element that faces the reference — where its arrow sits. */
export type ArrowSide = "top" | "right" | "bottom" | "left";

const arrowSideForPlacement: Record<ArrowSide, ArrowSide> = {
  top: "bottom",
  right: "left",
  bottom: "top",
  left: "right",
};

/**
 * Pins the arrow against the panel edge facing the reference, half of it
 * overlapping the panel. `translate` is a percentage of the arrow's own box, so
 * this stays correct when a consumer resizes the element — which is also what
 * keeps floating-ui's centring correct, since the middleware measures it.
 */
const arrowStaticSideStyle: Record<ArrowSide, CSSProperties> = {
  top: { top: 0, translate: "0 -50%" },
  bottom: { bottom: 0, translate: "0 50%" },
  left: { left: 0, translate: "-50% 0" },
  right: { right: 0, translate: "50% 0" },
};

/**
 * Geometry for a floating surface's arrow, from what `useFloating` already
 * returns — `middlewareData.arrow` and the *resolved* placement, so a flip
 * carries the arrow with it.
 *
 * Written here rather than in each surface because the maths is identical for
 * all three, and because only the measured cross-axis offset belongs inline: the
 * arrow's size, rotation, fill and borders stay in CSS, where a consumer's
 * `classNames.arrow` can still out-rank them.
 */
export function floatingArrowProps(
  placement: Placement,
  arrowData: { x?: number; y?: number } | undefined
): { "data-side": ArrowSide; style: CSSProperties } {
  const side = arrowSideForPlacement[placement.split("-")[0] as ArrowSide];
  return {
    "data-side": side,
    style: {
      // The measured cross-axis offset first, the edge pin last: floating-ui
      // reports only the axis it centres on, but the pin must win either way.
      ...(arrowData?.x != null && { left: `${arrowData.x}px` }),
      ...(arrowData?.y != null && { top: `${arrowData.y}px` }),
      ...arrowStaticSideStyle[side],
    },
  };
}

export type UseFloatingReturn = FloatingUIReturn & {
  /** The anchor is scrolled out of view or clipped away; the panel is hidden meanwhile. */
  referenceHidden: boolean;
  /** The panel is promoted into the top layer (fixed, viewport coordinates). */
  topLayer: boolean;
};

/**
 * The gap a panel keeps from the viewport's edges: its own `--R-SIZE-2`, the gap
 * the surface's width cap leaves on each side (`.r-overlays-surface`), so a panel
 * as wide as the cap still fits between them. Read inside the panel, so it
 * follows the density written there.
 */
const edgeGap = (floating: HTMLElement): number => resolveLength(floating, "var(--R-SIZE-2)");

/**
 * The gap named by `property`, read at the reference (or a virtual reference's
 * `contextElement`). An input cannot hold a probe, so the computed value is read
 * there and resolved inside the panel; an unset property is no gap.
 */
function referenceGap(reference: Element | VirtualElement, floating: HTMLElement, property: string): number {
  const at = "nodeType" in reference ? reference : (reference.contextElement ?? floating);
  const value = getComputedStyle(at).getPropertyValue(property).trim();
  return value ? resolveLength(floating, value) : 0;
}

export function useFloating(config: UseFloatingConfig = {}): UseFloatingReturn {
  const { placement = "bottom", offset = "--R-SIZE-4", arrowRef, open, onOpenChange } = config;

  const middleware = [
    offsetBy(({ elements }) => referenceGap(elements.reference, elements.floating, offset)),
    // The other side first; then, if neither side of the anchor has room (a panel set
    // beside a narrow pick on a phone), below or above it, so it never sits off screen
    // where another side fits.
    flip({ fallbackAxisSideDirection: "end" }),
    shift(({ elements }) => ({ padding: edgeGap(elements.floating) })),
    ...(arrowRef ? [arrow({ element: arrowRef })] : []),
    // Last, so it judges the final position. A fixed top-layer panel follows its
    // anchor on scroll, and `shift()` would otherwise pin it to the viewport edge
    // once the anchor has scrolled out of view or out of a clipping scroller.
    hide({ strategy: "referenceHidden" }),
  ];

  // Whether the panel is currently promoted into the top layer. State rather
  // than a value read in this render, so the first client render matches the
  // server's (`absolute`, in place) and the switch happens before paint.
  const [topLayer, setTopLayer] = useState(false);

  const floating = useFloatingUI({
    placement,
    middleware,
    whileElementsMounted: autoUpdate,
    open,
    onOpenChange,
    // A top-layer element's containing block is the VIEWPORT, so its
    // coordinates must be viewport-relative. Floating UI reads the pair
    // together (its `topLayer && isFixed` branch skips the offsetParent
    // conversion), so the strategy and the promotion read one flag.
    strategy: topLayer ? "fixed" : "absolute",
  });

  // `open: undefined` means the caller mounts the panel only while it is open,
  // which is the common shape; a panel kept mounted while closed passes `open`
  // so a closed panel is never promoted.
  const promote = open !== false && supportsTopLayerPromotion();
  useLayoutEffect(() => setTopLayer(promote), [promote]);

  useTopLayer(floating.elements.floating, topLayer);

  // Hidden, not unmounted: the panel keeps its state and focus bookkeeping and
  // reappears in place when the anchor scrolls back. An attribute painted by
  // `src/floating.css` (`visibility: hidden`, which also drops it from hit
  // testing and the accessibility tree), set beside the top-layer class for the
  // same reason: one effect owns it, so no surface can forget to apply it.
  const referenceHidden = floating.middlewareData.hide?.referenceHidden === true;
  const floatingEl = floating.elements.floating;
  useLayoutEffect(() => {
    if (!floatingEl) return;
    floatingEl.toggleAttribute(REFERENCE_HIDDEN_ATTR, referenceHidden);
    return () => floatingEl.removeAttribute(REFERENCE_HIDDEN_ATTR);
  }, [floatingEl, referenceHidden]);

  return { ...floating, referenceHidden, topLayer };
}

// `FloatingPortal` is deliberately NOT re-exported: panels render in place and
// are promoted to the top layer (see `useTopLayer`), never portalled.
export {
  FloatingFocusManager,
  safePolygon,
  useClick,
  useDismiss,
  useFocus,
  useHover,
  useInteractions,
  useListNavigation,
  useRole,
  useTransitionStyles,
  useTypeahead,
} from "@floating-ui/react";
