import { createContext } from "react";

import type { IconSet } from "../icons/types";

/** The view's icon set, for `Icon` nodes (provided by the view root). */
export const IconSetContext = createContext<IconSet | undefined>(undefined);
