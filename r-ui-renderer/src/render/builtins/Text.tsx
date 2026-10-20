import { createElement, type ReactNode } from "react";

import { TEXT_ELEMENTS, TEXT_SIZES, TEXT_WEIGHTS, type TextProps } from "../../spec/types";
import { classes, toneClass } from "./tones";

const SIZE_CLASSES: { readonly [S in (typeof TEXT_SIZES)[number]]: string } = {
  "body-1": "text-body-1",
  "body-2": "text-body-2",
  "body-3": "text-body-3",
};

const WEIGHT_CLASSES: { readonly [W in (typeof TEXT_WEIGHTS)[number]]: string } = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
};

function oneOf<T extends string>(list: readonly T[], value: unknown): T | undefined {
  return list.find((item) => item === value);
}

/** Body text on the UI scale, styled with token utilities only. */
export function Text(props: TextProps & { readonly children?: ReactNode }): ReactNode {
  const { as, size, tone, weight, className, children } = props;
  const element = oneOf(TEXT_ELEMENTS, as) ?? "p";
  const sized = oneOf(TEXT_SIZES, size);
  const weighted = oneOf(TEXT_WEIGHTS, weight);
  return createElement(
    element,
    {
      className: classes(
        "min-w-0 break-words",
        sized && SIZE_CLASSES[sized],
        weighted && WEIGHT_CLASSES[weighted],
        toneClass(tone),
        className,
      ),
    },
    children,
  );
}
