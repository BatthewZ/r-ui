import type { ElementType } from "react";

import type { PolymorphicProps } from "../../util/layout-polymorphic";
import { cn } from "../../util/style";

/**
 * - `measure`: one reading line (`--MEASURE`), for an article or a form.
 * - `page`: a page's content column (`--PAGE-MAX`).
 * - `full`: no cap; the gutter only.
 */
export type ContainerWidth = "measure" | "page" | "full";

export type ContainerProps<C extends ElementType = "div"> = PolymorphicProps<
  C,
  {
    /**
     * The cap on the content's inline size, the gutter outside it. A padding of your
     * own in `className` narrows the content inside the same box. Default `page`.
     */
    width?: ContainerWidth;
    /** Pad the sides with the fluid page gutter (`--GUTTER`). Default `true`. */
    gutter?: boolean;
  }
>;

const WIDTH: Record<ContainerWidth, string> = {
  measure: "r-layout-container-measure",
  page: "r-layout-container-page",
  full: "",
};

/**
 * Fills its parent's inline size up to the cap (the cap is the content width; the
 * fluid page gutter sits outside it) and centres there, in a block, flex or grid
 * parent. Never wider than the parent, whatever pads it.
 */
export function Container<C extends ElementType = "div">({
  as,
  width = "page",
  gutter = true,
  className,
  ...props
}: ContainerProps<C>) {
  const Component: ElementType = as ?? "div";
  return (
    <Component
      className={cn("r-layout-container", WIDTH[width], gutter && "r-layout-container-gutter px-gutter", className)}
      {...props}
    />
  );
}
