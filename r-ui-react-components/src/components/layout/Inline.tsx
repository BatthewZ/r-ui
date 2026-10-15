import type { ElementType } from "react";

import type { PolymorphicProps } from "../../util/layout-polymorphic";
import { cn } from "../../util/style";
import { ALIGN_ITEMS, type Align, GAP, JUSTIFY, type Justify, ROW_GAP, type Space } from "./space";

export type InlineProps<C extends ElementType = "div"> = PolymorphicProps<
  C,
  {
    /** Space between children, from the UI scale. Default `r4`. */
    gap?: Space;
    /** Space between wrapped lines when it should differ from `gap`. */
    rowGap?: Space;
    /** Cross-axis alignment. Default `center`. */
    align?: Align;
    /** Main-axis distribution. Default `start`. */
    justify?: Justify;
    /** Wrap onto new lines when out of room. Default `true`. */
    wrap?: boolean;
  }
>;

/** Children in a row that wraps, spaced by one step of the UI scale. */
export function Inline<C extends ElementType = "div">({
  as,
  gap = "r4",
  rowGap,
  align = "center",
  justify = "start",
  wrap = true,
  className,
  ...props
}: InlineProps<C>) {
  const Component: ElementType = as ?? "div";
  return (
    <Component
      className={cn(
        "flex min-w-0",
        wrap ? "flex-wrap" : "flex-nowrap",
        GAP[gap],
        rowGap && ROW_GAP[rowGap],
        ALIGN_ITEMS[align],
        JUSTIFY[justify],
        className,
      )}
      {...props}
    />
  );
}
