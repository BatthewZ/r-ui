import type { ComponentType } from "react";

/** What the renderer passes an icon component. A lucide icon takes all of it. */
export interface IconComponentProps {
  readonly className?: string;
  readonly "aria-hidden"?: boolean;
  readonly "aria-label"?: string;
  readonly role?: "img";
}

/** Icon name → component, for `Icon` nodes and icon-name props. */
export type IconSet = { readonly [name: string]: ComponentType<IconComponentProps> };
