import type { ElementType } from "react";

import type { PolymorphicProps } from "../../util/layout-polymorphic";
import { cn } from "../../util/style";

/** The fluid section rhythm, 1 = largest: between page sections, blocks, a heading group and its content. */
export type SectionSpace = "section-1" | "section-2" | "section-3";

/**
 * - `plain`: on the canvas.
 * - `band`: a full-bleed raised band, edged with hairlines (a surface step alone is
 *   too weak a boundary to read as one).
 */
export type SectionVariant = "plain" | "band";

export type SectionProps<C extends ElementType = "section"> = PolymorphicProps<
  C,
  {
    /** Block padding from the fluid section scale. Default `section-1`. */
    padding?: SectionSpace;
    variant?: SectionVariant;
  }
>;

const PADDING: Record<SectionSpace, string> = {
  "section-1": "py-section-1",
  "section-2": "py-section-2",
  "section-3": "py-section-3",
};

const VARIANT: Record<SectionVariant, string> = {
  plain: "",
  band: "border-y bg-surface-1",
};

/**
 * A marketing or long-form page section: fluid, density-independent block
 * rhythm. Put a `Container` inside it for the side gutter and content width.
 */
export function Section<C extends ElementType = "section">({
  as,
  padding = "section-1",
  variant = "plain",
  className,
  ...props
}: SectionProps<C>) {
  const Component: ElementType = as ?? "section";
  return <Component className={cn(PADDING[padding], VARIANT[variant], className)} {...props} />;
}
