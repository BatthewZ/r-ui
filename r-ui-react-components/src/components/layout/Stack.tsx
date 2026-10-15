import type { ElementType } from "react";

import type { PolymorphicProps } from "../../util/layout-polymorphic";
import { cn } from "../../util/style";
import { ALIGN_ITEMS, type Align, GAP, JUSTIFY, type Justify, type Space } from "./space";

export type StackProps<C extends ElementType = "div"> = PolymorphicProps<
  C,
  {
    /** Space between children, from the UI scale. Default `r3`. */
    gap?: Space;
    /** Cross-axis alignment. Default `stretch` (children fill the width). */
    align?: Exclude<Align, "baseline">;
    /** Main-axis distribution. Default `start`. */
    justify?: Justify;
  }
>;

/** Children in a column, spaced by one step of the UI scale. */
export function Stack<C extends ElementType = "div">({
  as,
  gap = "r3",
  align = "stretch",
  justify = "start",
  className,
  ...props
}: StackProps<C>) {
  const Component: ElementType = as ?? "div";
  return (
    <Component
      className={cn("flex min-w-0 flex-col", GAP[gap], ALIGN_ITEMS[align], JUSTIFY[justify], className)}
      {...props}
    />
  );
}
