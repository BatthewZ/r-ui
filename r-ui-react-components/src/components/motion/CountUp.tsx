"use client";
import { type ComponentPropsWithRef, useEffect, useLayoutEffect, useRef, useState } from "react";

import { type FormatNumberOptions, formatNumber, isPresent } from "../../util/format";
import { useLocale } from "../../util/locale";
import { mergeRefs } from "../../util/merge-refs";
import { cn } from "../../util/style";
import { useReveal } from "./use-reveal";

export type CountUpProps = Omit<ComponentPropsWithRef<"span">, "children"> & {
  /** The number it lands on, and the only one assistive tech reads. Missing renders "—" and never counts. */
  value: number | null | undefined;
  /** Where the count starts. @default 0 */
  from?: number;
  /** Options for `formatNumber`, applied to every frame and to the final value. */
  formatOptions?: Omit<FormatNumberOptions, "locale">;
  /** Formats every frame and the final value instead of `formatNumber` (a currency, a unit, a suffix). */
  format?: (value: number, locale: string | undefined) => string;
  /** Omitted: the `LocaleProvider`'s, else the runtime's. */
  locale?: string;
  /** How much must be in view before it counts (as `ScrollReveal`). @default 0.15 */
  threshold?: number;
};

/** What the visible number is doing, on `data-count`. */
type Phase = "static" | "waiting" | "counting";

/** "1.04s", "260ms", "0.2s, 1s" (the first) → milliseconds; anything unreadable → 0. */
function toMs(time: string): number {
  const first = time.split(",")[0]?.trim() ?? "";
  const n = Number.parseFloat(first);
  if (!Number.isFinite(n)) return 0;
  return first.endsWith("ms") ? n : n * 1000;
}

/** The decimals `value` is written with, so frames step as finely as the value does (integers count in integers). */
function decimalsOf(value: number): number {
  const [, fraction = ""] = String(Math.abs(value)).split(".");
  return Math.min(fraction.replace(/e.*$/i, "").length, 10);
}

/**
 * A number that counts up from `from` to `value` when it first scrolls into
 * view, once. Decoration on a figure that is already true: the final value is
 * in the markup from the server on, and assistive tech reads only that one (the
 * moving digits are `aria-hidden`; a visually hidden copy holds the value).
 *
 * Every frame is formatted in the locale, with the final value's options, in
 * tabular figures; the box keeps the final value's width throughout. Timing is
 * the contract's motion: `--DURATION-SLOW` × 4 on `--EASE-STANDARD`, as the
 * computed `transition-*` of the element (a `duration-*` / `ease-*` utility
 * retunes it). Under reduced motion, without script or `IntersectionObserver`,
 * and for a number already on screen when it mounts, it shows the final value
 * and does not count.
 */
export function CountUp({
  value,
  from = 0,
  formatOptions,
  format,
  locale: localeProp,
  threshold,
  className,
  ref,
  ...props
}: CountUpProps) {
  const locale = useLocale(localeProp);
  const own = useRef<HTMLSpanElement>(null);
  const present = isPresent(value);
  const reveal = useReveal(own, { threshold, enabled: present });
  const [frame, setFrame] = useState<number | null>(null);

  const show = (n: number | null | undefined) =>
    format && isPresent(n) ? format(n, locale) : formatNumber(n, { ...formatOptions, locale });
  // The running count reads these as they are now, so a value that changes mid-count moves the end.
  const latest = useRef({ value, from });
  useLayoutEffect(() => {
    latest.current = { value, from };
  });

  useEffect(() => {
    const element = own.current;
    if (reveal !== "revealed" || !element) return;
    const style = getComputedStyle(element);
    const duration = toMs(style.transitionDuration);
    if (duration <= 0 || typeof element.animate !== "function") return;
    // A keyframe-less animation is the clock: the browser applies the easing,
    // a DevTools playback rate slows it, and it can be cancelled.
    const clock = element.animate([], { duration, easing: style.transitionTimingFunction || "linear" });
    let raf = 0;
    const tick = () => {
      const { value: to, from: start } = latest.current;
      const progress = clock.effect?.getComputedTiming().progress;
      if (!isPresent(to) || clock.playState === "finished" || progress == null) {
        setFrame(null);
        return;
      }
      const step = 10 ** decimalsOf(to);
      setFrame(Math.round((start + (to - start) * progress) * step) / step);
      raf = requestAnimationFrame(tick);
    };
    setFrame(latest.current.from);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clock.cancel();
      setFrame(null);
    };
  }, [reveal]);

  const final = show(value);
  const phase: Phase = reveal === "hidden" ? "waiting" : frame !== null ? "counting" : "static";
  const shown = phase === "waiting" ? show(from) : phase === "counting" ? show(frame) : final;

  return (
    <span
      {...props}
      ref={mergeRefs(ref, own)}
      data-count={phase}
      className={cn("r-motion-count-up tabular-nums", className)}
    >
      <span aria-hidden="true" className="r-motion-count-up-sizer">
        {final}
      </span>
      <span aria-hidden="true" className="r-motion-count-up-value">
        {shown}
      </span>
      <span className="sr-only">{final}</span>
    </span>
  );
}
