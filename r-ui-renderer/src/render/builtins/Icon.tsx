import type { ReactNode } from "react";

import type { IconProps } from "../../spec/types";

/**
 * The named icon from the view's icon set (`IconSetContext`) at `size-icon`;
 * `aria-hidden` unless `label` names it. A name the set lacks renders the
 * missing-icon diagnostic.
 */
export function Icon(props: IconProps): ReactNode {
  throw new Error("not implemented");
}
