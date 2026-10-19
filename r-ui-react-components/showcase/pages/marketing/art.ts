import grid from "./art/grid.svg";
import kiln from "./art/kiln.svg";
import pages from "./art/pages.svg";
import readers from "./art/readers.svg";

/** The page's illustrations: 1600 × 900 SVGs, decorative wherever they appear. */
export const ART = { grid, kiln, pages, readers } as const;
export const ART_SIZE = { width: 1600, height: 900 } as const;
