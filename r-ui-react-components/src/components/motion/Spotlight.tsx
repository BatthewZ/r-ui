"use client";
import { type ElementType, type PointerEvent, useEffect, useRef } from "react";

import { usePrefersReducedMotion } from "../../hooks/use-reduced-motion";
import type { PolymorphicProps } from "../../util/layout-polymorphic";
import { mergeRefs } from "../../util/merge-refs";
import { cn } from "../../util/style";

export type SpotlightProps<C extends ElementType = "div"> = PolymorphicProps<C>;

/** A pointer that hovers precisely; a finger has no hover to follow. */
const followable = (event: PointerEvent) => event.pointerType === "mouse" || event.pointerType === "pen";

/**
 * A soft highlight that follows a mouse across a card: decoration that says
 * "this is the one under your pointer". Render the card through it
 * (`<Spotlight as={Card}>`) or wrap any box.
 *
 * Pointer moves are read at most once a frame and written as two custom
 * properties (the pointer's share of the box's width and height); the wash is
 * the box's own background image, so it sits beneath every child and never
 * covers text, and its strength keeps text at 4.5:1 over it. Fine hovering
 * pointers only: nothing on touch or a forced coarse input, and nothing under
 * reduced motion, forced colours or in print.
 */
export function Spotlight<C extends ElementType = "div">({
  as,
  className,
  onPointerMove,
  onPointerLeave,
  ref,
  ...props
}: SpotlightProps<C>) {
  const Tag: ElementType = as ?? "div";
  const own = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const raf = useRef(0);

  const stop = () => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    pointer.current = null;
    own.current?.removeAttribute("data-spotlight");
  };
  useEffect(() => stop, []);
  useEffect(() => {
    if (reduced) stop();
  }, [reduced]);

  const move = (event: PointerEvent<HTMLElement>) => {
    (onPointerMove as ((event: PointerEvent<HTMLElement>) => void) | undefined)?.(event);
    if (reduced || !followable(event)) return;
    pointer.current = { x: event.clientX, y: event.clientY };
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const box = own.current;
      const at = pointer.current;
      if (!box || !at) return;
      const rect = box.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      box.style.setProperty("--r-motion-spotlight-x", String((at.x - rect.left) / rect.width));
      box.style.setProperty("--r-motion-spotlight-y", String((at.y - rect.top) / rect.height));
      box.setAttribute("data-spotlight", "on");
    });
  };
  const leave = (event: PointerEvent<HTMLElement>) => {
    (onPointerLeave as ((event: PointerEvent<HTMLElement>) => void) | undefined)?.(event);
    stop();
  };

  return (
    <Tag
      {...props}
      ref={mergeRefs(ref, own)}
      onPointerMove={move}
      onPointerLeave={leave}
      className={cn("r-motion-spotlight", className)}
    />
  );
}
