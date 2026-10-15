"use client";
import { type RefObject, useLayoutEffect, useState } from "react";

/** A row-tall box nobody sees: it resizes whenever `--ROW-H` resolves differently. */
const PROBE_CLASS = "pointer-events-none invisible absolute top-0 start-0 h-row w-0";

/**
 * `--ROW-H` as the element actually resolves it, in px.
 *
 * `--ROW-H` is `@property`-registered as a `<length>`, so `getComputedStyle`
 * returns px (`max(density value, --HIT-MIN)` already resolved). It moves for
 * many reasons: density on ANY ancestor, the input axis forced on `<html>`, a
 * coarse primary pointer, a theme retuning the per-density value, a stylesheet
 * loaded or edited later. Rather than enumerate them, the hook puts a hidden
 * probe of `height: var(--ROW-H)` inside `ref` and re-reads whenever a
 * ResizeObserver sees the probe change. `ref` must be a positioned box (the
 * probe is absolute, so it never takes part in layout).
 *
 * `fallback` is used until the first read and wherever no CSS is loaded
 * (jsdom, where the property reads back empty). `enabled: false` skips the
 * probe for a caller that does not need the height.
 */
export function useRowHeight(ref: RefObject<HTMLElement | null>, fallback: number, enabled = true): number {
  const [height, setHeight] = useState(fallback);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const measure = () => {
      const px = Number.parseFloat(getComputedStyle(el).getPropertyValue("--ROW-H"));
      if (Number.isFinite(px) && px > 0) setHeight(px);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;

    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.dataset.rowHeightProbe = "";
    probe.className = PROBE_CLASS;
    el.append(probe);
    const observer = new ResizeObserver(measure);
    observer.observe(probe);
    return () => {
      observer.disconnect();
      probe.remove();
    };
  }, [ref, enabled]);

  return height;
}
