import { createElement, type ReactNode } from "react";

import { HEADING_LEVELS, HEADING_SIZES, type HeadingProps } from "../../spec/types";
import { classes, toneClass } from "./tones";

const SIZE_CLASSES: { readonly [S in (typeof HEADING_SIZES)[number]]: string } = {
  h1: "text-h1",
  h2: "text-h2",
  h3: "text-h3",
  h4: "text-h4",
  h5: "text-h5",
  h6: "text-h6",
};

/** `h1`–`h6` by `level`, sized by `size` (`text-h1`…`text-h6`). */
export function Heading(props: HeadingProps & { readonly children?: ReactNode }): ReactNode {
  const { level, size, tone, className, children } = props;
  const outline = HEADING_LEVELS.find((item) => item === level) ?? 2;
  const look = HEADING_SIZES.find((item) => item === size) ?? HEADING_SIZES[outline - 1] ?? "h2";
  return createElement(
    `h${outline}`,
    { className: classes("min-w-0 break-words", SIZE_CLASSES[look], toneClass(tone) ?? "text-fg-primary", className) },
    children,
  );
}
