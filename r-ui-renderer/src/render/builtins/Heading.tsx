import { createElement, type ReactNode } from "react";

import { RENDERER_CLASSES } from "../../diagnostics";
import { isOneOf } from "../../spec/guards";
import { HEADING_LEVELS, HEADING_SIZES, type HeadingProps } from "../../spec/types";
import { classes, toneClass } from "./tones";

/** `h1`–`h6` by `level`, sized by `size` (the level's own when absent). */
export function Heading(props: HeadingProps & { readonly children?: ReactNode }): ReactNode {
  const { level, size, tone, className, children } = props;
  const outline = HEADING_LEVELS.find((candidate) => candidate === level) ?? 2;
  const look = isOneOf(HEADING_SIZES, size) ? size : `h${outline}`;
  return createElement(
    `h${outline}`,
    { className: classes(RENDERER_CLASSES.heading, `${RENDERER_CLASSES.heading}-${look}`, toneClass(tone), className) },
    children,
  );
}
