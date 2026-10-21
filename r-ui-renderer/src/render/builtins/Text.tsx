import { createElement, type ReactNode } from "react";

import { RENDERER_CLASSES } from "../../diagnostics";
import { isOneOf } from "../../spec/guards";
import { TEXT_ELEMENTS, TEXT_SIZES, TEXT_WEIGHTS, type TextProps } from "../../spec/types";
import { classes, toneClass } from "./tones";

/** Body text on the UI scale, styled by the renderer's stylesheet (tokens only). */
export function Text(props: TextProps & { readonly children?: ReactNode }): ReactNode {
  const { as, size, tone, weight, className, children } = props;
  return createElement(
    isOneOf(TEXT_ELEMENTS, as) ? as : "p",
    {
      className: classes(
        RENDERER_CLASSES.text,
        isOneOf(TEXT_SIZES, size) && `${RENDERER_CLASSES.text}-${size}`,
        isOneOf(TEXT_WEIGHTS, weight) && `${RENDERER_CLASSES.weight}-${weight}`,
        toneClass(tone),
        className,
      ),
    },
    children,
  );
}
