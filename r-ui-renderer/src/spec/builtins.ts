/**
 * Contracts for the components the renderer itself provides. They are ordinary
 * contracts: the registry, the validator and the reference read them like any
 * library component's.
 */

import {
  type ComponentContracts,
  HEADING_LEVELS,
  HEADING_SIZES,
  TEXT_ELEMENTS,
  TEXT_SIZES,
  TEXT_TONES,
  TEXT_WEIGHTS,
} from "./types";

/** A prop's declared type for a closed set of strings: `"a" | "b"`. */
const literalUnion = (values: readonly string[]) => values.map((value) => `"${value}"`).join(" | ");

const TONE_DOC = literalUnion(TEXT_TONES);

export const BUILTIN_CONTRACTS: ComponentContracts = {
  Text: {
    category: "builtin",
    note: "Body text. `as` picks the element, `size` the UI body step (inherited when absent).",
    props: [
      { name: "as", type: literalUnion(TEXT_ELEMENTS), required: false },
      { name: "size", type: literalUnion(TEXT_SIZES), required: false },
      { name: "tone", type: TONE_DOC, required: false },
      { name: "weight", type: literalUnion(TEXT_WEIGHTS), required: false },
      { name: "className", type: "string", required: false },
    ],
    propEnums: { as: TEXT_ELEMENTS, size: TEXT_SIZES, tone: TEXT_TONES, weight: TEXT_WEIGHTS },
    elementProps: { as: TEXT_ELEMENTS },
  },
  Heading: {
    category: "builtin",
    note: "`level` is the outline (h1–h6); `size` is the look and matches the level when absent.",
    props: [
      { name: "level", type: HEADING_LEVELS.join(" | "), required: false },
      { name: "size", type: literalUnion(HEADING_SIZES), required: false },
      { name: "tone", type: TONE_DOC, required: false },
      { name: "className", type: "string", required: false },
    ],
    propEnums: { level: HEADING_LEVELS, size: HEADING_SIZES, tone: TEXT_TONES },
    headingLevelProps: { level: HEADING_LEVELS },
  },
  Icon: {
    category: "builtin",
    note: "Decorative unless `label` names it. Sized by the density's icon step.",
    props: [
      { name: "name", type: "string", required: true },
      { name: "label", type: "string", required: false },
      { name: "tone", type: TONE_DOC, required: false },
      { name: "className", type: "string", required: false },
    ],
    propEnums: { tone: TEXT_TONES },
  },
};
