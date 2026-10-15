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
    /** The cap on the content's inline size. Default `page`. */
    width?: ContainerWidth;
    /** Pad the sides with the fluid page gutter (`--GUTTER`). Default `true`. */
    gutter?: boolean;
  }
>;

const WIDTH: Record<ContainerWidth, string> = {
  measure: "max-w-measure",
  page: "max-w-page",
  full: "",
};

/** Centres content at a capped width, with the fluid page gutter at the sides. */
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
      className={cn("r-layout-container", WIDTH[width], gutter && "px-gutter", className)}
      {...props}
    />
  );
}
