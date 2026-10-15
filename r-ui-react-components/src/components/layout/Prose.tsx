import type { ElementType } from "react";

import type { PolymorphicProps } from "../../util/layout-polymorphic";
import { cn } from "../../util/style";

export type ProseProps<C extends ElementType = "div"> = PolymorphicProps<
  C,
  {
    /** Cap the line length at the reading measure. Default `true`. */
    measure?: boolean;
  }
>;

/**
 * A long-form region: its paragraphs, lists, headings, quotes and code take the
 * fluid prose/display scale with reading leading (r-ui-css's `.prose`). Controls
 * inside it keep the UI scale: the region sets no font size of its own, and a
 * subtree can opt out entirely with `data-not-prose`.
 */
export function Prose<C extends ElementType = "div">({
  as,
  measure = true,
  className,
  ...props
}: ProseProps<C>) {
  const Component: ElementType = as ?? "div";
  return <Component className={cn("prose", measure && "max-w-measure", className)} {...props} />;
}
