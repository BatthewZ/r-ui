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

const TONE_DOC = TEXT_TONES.map((tone) => `"${tone}"`).join(" | ");

export const BUILTIN_CONTRACTS: ComponentContracts = {
  Text: {
    category: "builtin",
    note: "Body text. `as` picks the element, `size` the UI body step (inherited when absent).",
    props: [
      { name: "as", type: TEXT_ELEMENTS.map((tag) => `"${tag}"`).join(" | "), required: false },
      { name: "size", type: TEXT_SIZES.map((size) => `"${size}"`).join(" | "), required: false },
      { name: "tone", type: TONE_DOC, required: false },
      { name: "weight", type: TEXT_WEIGHTS.map((weight) => `"${weight}"`).join(" | "), required: false },
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
      { name: "size", type: HEADING_SIZES.map((size) => `"${size}"`).join(" | "), required: false },
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
