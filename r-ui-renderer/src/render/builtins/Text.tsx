import type { ReactNode } from "react";

import type { TextProps } from "../../spec/types";

/** Body text on the UI scale, styled with token utilities only. */
export function Text(props: TextProps & { readonly children?: ReactNode }): ReactNode {
  throw new Error("not implemented");
}
