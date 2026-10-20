import type { ReactNode } from "react";

import type { HeadingProps } from "../../spec/types";

/** `h1`–`h6` by `level`, sized by `size` (`text-h1`…`text-h6`). */
export function Heading(props: HeadingProps & { readonly children?: ReactNode }): ReactNode {
  throw new Error("not implemented");
}
