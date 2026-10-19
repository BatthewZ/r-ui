import type { ComponentPropsWithRef } from "react";

import { cn, type SlotClassNames } from "../../util/style";

export type ParallaxStrength = "subtle" | "medium" | "strong";

export type ParallaxProps = Omit<ComponentPropsWithRef<"div">, "aria-hidden" | "inert"> & {
  /**
   * How far the layer drifts each way: the domain token `--PARALLAX-SHIFT`
   * (medium), half of it (subtle) or one and a half (strong). A theme retunes
   * the token; reduced motion and print zero it. @default "medium"
   */
  strength?: ParallaxStrength;
  classNames?: SlotClassNames<"layer">;
};

/**
 * A decorative layer (a hero's backdrop, a band's picture) that drifts more
 * slowly than the page as it scrolls through the view.
 *
 * CSS only: a scroll-driven animation on a view timeline, no script and no
 * scroll handler. A browser without scroll-driven animations shows the layer
 * still, and so does reduced motion.
 *
 * Decorative by construction: the box is `aria-hidden`, `inert` and takes no
 * pointer, so text and controls never go in it (they would be unreadable to
 * assistive tech and unreachable). Put the content beside it, not inside; give
 * an image `alt=""`. The box clips the drift and never moves itself, so the
 * layout and every hit area stay where they are.
 *
 * The drift follows the box's nearest scroll container (the page, or a box
 * with `overflow: auto`): one that scrolls only sideways still counts
 * (`overflow-x: auto` makes both axes scroll), and the layer then holds still
 * as the page moves. Keep it out of such a box.
 *
 * The box is `position: relative` and sized by the caller: `absolute inset-0`
 * inside a positioned section for a backdrop, or a height or ratio in flow.
 * Children fill the layer (`size-full object-cover` on an image).
 */
export function Parallax({ strength = "medium", className, classNames, children, ...props }: ParallaxProps) {
  return (
    <div {...props} aria-hidden="true" inert data-strength={strength} className={cn("r-motion-parallax", className)}>
      <div className={cn("r-motion-parallax-layer", classNames?.layer)}>{children}</div>
    </div>
  );
}
