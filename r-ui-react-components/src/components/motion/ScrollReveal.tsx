"use client";
import { type ElementType, useRef } from "react";

import type { PolymorphicProps } from "../../util/layout-polymorphic";
import { mergeRefs } from "../../util/merge-refs";
import { cn } from "../../util/style";
import { type RevealOptions, useReveal } from "./use-reveal";

export type RevealAnimation = "fade-up" | "fade-in" | "scale-in";

/** The contract's entrances. Distances and durations are its motion tokens. */
export const REVEAL_ANIMATION_CLASSES: Record<RevealAnimation, string> = {
  "fade-up": "animate-fade-up",
  "fade-in": "animate-fade-in",
  "scale-in": "animate-scale-in",
};

export type ScrollRevealProps<C extends ElementType = "div"> = PolymorphicProps<
  C,
  Omit<RevealOptions, "enabled"> & {
    /** @default "fade-up" (a small rise, `--MOTION-DISTANCE-MD`) */
    animation?: RevealAnimation;
  }
>;

/**
 * Plays an entrance when the element first scrolls into view (an
 * `IntersectionObserver`), once by default.
 *
 * Content is visible without script, under reduced motion, where the observer
 * API is missing, and when it was already on screen at mount: only content
 * waiting below the fold is ever hidden. Use it sparingly, on a section or a
 * figure, never on text the reader is already looking at.
 */
export function ScrollReveal<C extends ElementType = "div">({
  as,
  animation = "fade-up",
  once,
  threshold,
  rootMargin,
  className,
  ref,
  ...props
}: ScrollRevealProps<C>) {
  const Tag: ElementType = as ?? "div";
  const own = useRef<Element>(null);
  const state = useReveal(own, { once, threshold, rootMargin });
  return (
    <Tag
      {...props}
      ref={mergeRefs(ref, own)}
      data-reveal={state}
      className={cn(
        state === "hidden" && "scroll-reveal-hidden",
        state === "revealed" && REVEAL_ANIMATION_CLASSES[animation],
        className
      )}
    />
  );
}
