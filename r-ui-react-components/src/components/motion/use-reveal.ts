"use client";
import { type RefObject, useLayoutEffect, useState } from "react";

import { usePrefersReducedMotion } from "../../hooks/use-reduced-motion";

/**
 * - `static`: shown, with nothing to play. The server render, the first client
 *   render, reduced motion, no `IntersectionObserver`, and content that was
 *   already on screen when it mounted.
 * - `hidden`: below the fold and waiting (the contract's `.scroll-reveal-hidden`).
 * - `revealed`: scrolled into view; the entrance plays.
 */
export type RevealState = "static" | "hidden" | "revealed";

export interface RevealOptions {
  /** Play once, then stay. `false` hides it again each time it leaves the view. @default true */
  once?: boolean;
  /**
   * How much must be in view before it plays (0–1): that share of the element,
   * or of the viewport's height for an element taller than the view (which
   * could otherwise never reach it). @default 0.15
   */
  threshold?: number;
  /** Grows or shrinks the viewport the threshold is measured against. @default "0px" */
  rootMargin?: string;
  /** `false` keeps it `static`. @default true */
  enabled?: boolean;
}

/** Callbacks every 5% of the element, so a tall one is re-measured as it scrolls in. */
const STEPS = Array.from({ length: 21 }, (_, i) => i / 20);

function inViewport(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
}

/**
 * Scroll-triggered reveal state for one element.
 *
 * Content is never hidden before script has decided to hide it: the markup a
 * server sends (or a page whose script never runs) shows everything. Only
 * content that is OUT of view when it mounts is hidden, before paint (a layout
 * effect), so nothing on screen blinks out on hydration and nothing above the
 * fold waits for an entrance. Reduced motion never hides anything.
 */
export function useReveal(
  ref: RefObject<Element | null>,
  { once = true, threshold = 0.15, rootMargin = "0px", enabled = true }: RevealOptions = {}
): RevealState {
  const reduced = usePrefersReducedMotion();
  const [state, setState] = useState<RevealState>("static");

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !enabled || reduced || typeof IntersectionObserver === "undefined") {
      setState("static");
      return;
    }
    // Already on screen at mount: show it as it is. With `once`, that is all.
    let armed = !inViewport(element);
    setState(armed ? "hidden" : "static");
    if (!armed && once) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          const viewHeight = entry.rootBounds?.height ?? window.innerHeight;
          const enough =
            entry.intersectionRatio >= threshold || entry.intersectionRect.height >= viewHeight * threshold;
          if (!armed || !enough) return;
          armed = false;
          setState("revealed");
          if (once) observer.disconnect();
        } else if (!once && entry.boundingClientRect.top > 0) {
          // Re-arm only once it is back below the fold: content scrolled past
          // upwards stays shown rather than re-playing as the reader returns.
          armed = true;
          setState("hidden");
        }
      },
      { threshold: STEPS, rootMargin }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, once, threshold, rootMargin, enabled, reduced]);

  return state;
}
