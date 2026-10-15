"use client";
import { Children, cloneElement, type CSSProperties, type ElementType, isValidElement, type ReactElement, useRef } from "react";

import type { PolymorphicProps } from "../../util/layout-polymorphic";
import { mergeRefs } from "../../util/merge-refs";
import { cn } from "../../util/style";
import { REVEAL_ANIMATION_CLASSES, type RevealAnimation } from "./ScrollReveal";
import { useReveal } from "./use-reveal";

/**
 * Items past this index share its delay, so a long list never keeps the reader
 * waiting: at the default `--MOTION-STAGGER` the last one starts by 0.4s.
 */
export const STAGGER_MAX_INDEX = 10;

export type StaggerProps<C extends ElementType = "div"> = PolymorphicProps<
  C,
  {
    /** @default "fade-up" */
    animation?: RevealAnimation;
    /**
     * `scroll`: play when the group first scrolls into view (as `ScrollReveal`,
     * and only if it was below the fold). `mount`: play when it mounts, for
     * content that arrives (search results, a loaded list). @default "scroll"
     */
    trigger?: "scroll" | "mount";
  }
>;

/**
 * Plays an entrance on each child in turn. Each element child gets the
 * contract's `.stagger-item` and its `--stagger-index`; the delay step is
 * `--MOTION-STAGGER`, which reduced motion sets to 0. The children stay the
 * container's own (no wrappers), so `<Stagger as="ul">` keeps `ul > li`.
 */
export function Stagger<C extends ElementType = "div">({
  as,
  animation = "fade-up",
  trigger = "scroll",
  className,
  children,
  ref,
  ...props
}: StaggerProps<C>) {
  const Tag: ElementType = as ?? "div";
  const own = useRef<Element>(null);
  const state = useReveal(own, { enabled: trigger === "scroll" });
  const play = trigger === "mount" || state === "revealed";

  let index = 0;
  const items = Children.map(children, (child) => {
    if (!play || !isValidElement(child)) return child;
    const element = child as ReactElement<{ className?: string; style?: CSSProperties }>;
    const style = { ...element.props.style, "--stagger-index": Math.min(index++, STAGGER_MAX_INDEX) } as CSSProperties;
    return cloneElement(element, {
      className: cn(element.props.className, "stagger-item", REVEAL_ANIMATION_CLASSES[animation]),
      style,
    });
  });

  return (
    <Tag
      {...props}
      ref={mergeRefs(ref, own)}
      data-reveal={trigger === "scroll" ? state : undefined}
      className={cn(state === "hidden" && "scroll-reveal-hidden", className)}
    >
      {items}
    </Tag>
  );
}
