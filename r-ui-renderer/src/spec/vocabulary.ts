/**
 * The closed lists a document is checked against, as data. The classes are
 * generated (`scripts/derive-class-vocabulary.mjs`) and the renderer's
 * stylesheet generates each one; a class outside them styles nothing. The icon
 * names are curated here, and the shipped set (`./icons`) holds exactly them.
 */

import classes from "./class-vocabulary.json";
import icons from "./icon-names.json";

export const CLASS_VOCABULARY: readonly string[] = classes;
export const ICON_NAMES: readonly string[] = icons;
