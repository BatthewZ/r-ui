import { type ComponentType, createContext } from "react";

import type { IconComponentProps, IconSet } from "../icons/types";

/** The view's icon set, for `Icon` nodes (provided by the view root). */
export const IconSetContext = createContext<IconSet | undefined>(undefined);

/** The set's own glyph named `name`, or undefined when there is none. */
export function glyphFor(icons: IconSet | undefined, name: unknown): ComponentType<IconComponentProps> | undefined {
  return icons !== undefined && typeof name === "string" && Object.hasOwn(icons, name) ? icons[name] : undefined;
}
