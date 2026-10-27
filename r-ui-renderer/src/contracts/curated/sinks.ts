/**
 * Where a document's values become requests, elements or persisted keys: the
 * props the renderer judges, constrains, namespaces or drops. The universal
 * URL names (`href`, `src`, …) live in the policy; these are the renamed and
 * nested ones a name-based check would miss. An omission scan of the
 * library's source keeps these tables honest.
 */

import { HEADING_LEVELS } from "../../spec/types";
import type { CuratedTable } from "./table";

/** URLs a document's value becomes (scheme allowlist), beyond the universal names. */
export const URL_PROPS: CuratedTable<"urlProps"> = {
  EventCalendar: ["events[].href"],
  Testimonial: ["sourceUrl"],
  TreeView: ["items[].href"],
};

/** URLs the browser fetches as images (scheme allowlist, then the host's image policy). */
export const IMAGE_PROPS: CuratedTable<"imageProps"> = {
  Image: ["placeholder"],
  MediaCard: ["image.src", "image.srcSet", "image.placeholder"],
  Lightbox: ["items[].src", "items[].srcSet", "items[].placeholder"],
  AvatarGroup: ["items[].src"],
  Testimonial: ["avatar"],
  Timeline: ["events[].actor.avatar"],
  ActivityFeed: ["items[].actor.avatar"],
};

/** Tags a layout primitive may render as: no `main` (the host has it), nothing that runs or embeds. */
const LAYOUT_ELEMENTS = ["div", "section", "article", "aside", "header", "footer", "nav", "ul", "ol", "li", "figure"];
const SUBHEADINGS = ["h2", "h3", "h4", "h5", "h6"];

/** Props that choose the element, with the tags each allows. */
export const ELEMENT_PROPS: CuratedTable<"elementProps"> = {
  Container: { as: LAYOUT_ELEMENTS },
  Grid: { as: LAYOUT_ELEMENTS },
  Inline: { as: LAYOUT_ELEMENTS },
  Stack: { as: LAYOUT_ELEMENTS },
  Prose: { as: LAYOUT_ELEMENTS },
  Section: { as: LAYOUT_ELEMENTS },
  ScrollReveal: { as: LAYOUT_ELEMENTS },
  Stagger: { as: LAYOUT_ELEMENTS },
  "Card.Title": { as: SUBHEADINGS },
  Chip: { as: ["span", "li"] },
  MediaCard: { titleAs: SUBHEADINGS },
};

const ALL_LEVELS = [...HEADING_LEVELS];
const SUBLEVELS = [2, 3, 4, 5, 6];

/** Props interpolated into `h${n}`, with the levels each allows (the library's own range). */
export const HEADING_LEVEL_PROPS: CuratedTable<"headingLevelProps"> = {
  Accordion: { headingLevel: ALL_LEVELS },
  Hero: { headingLevel: ALL_LEVELS },
  EmptyState: { headingLevel: SUBLEVELS },
  Timeline: { headingLevel: SUBLEVELS },
  ActivityFeed: { headingLevel: SUBLEVELS },
  SectionHeading: { headingLevel: SUBLEVELS },
  FeatureGrid: { headingLevel: SUBLEVELS },
  FeatureRows: { headingLevel: SUBLEVELS },
  HowItWorks: { headingLevel: SUBLEVELS },
  Pricing: { headingLevel: SUBLEVELS },
  CallToAction: { headingLevel: ALL_LEVELS },
  Wizard: { headingLevel: SUBLEVELS },
};

/** Persisted keys the renderer prefixes per view, so a document cannot clobber the host's. */
export const NAMESPACED_PROPS: CuratedTable<"namespacedProps"> = {
  Banner: ["dismissKey"],
};

/** Values `Intl` throws on; validated before render and dropped when invalid. */
export const INTL_PROPS: CuratedTable<"intlProps"> = {
  Pricing: { currency: "currency" },
  CurrencyInput: { currency: "currency" },
};

/** Refused unless the host allows them (they ask for secrets). */
export const SENSITIVE: CuratedTable<"sensitive"> = {
  PasswordInput: true,
  OTPInput: true,
};

/**
 * Props no component takes from a document, wherever the library declares
 * them: the host owns locale, `asChild` clones an element onto a child the
 * document does not control, `linkAs` takes a component.
 */
export const ALWAYS_DROPPED = ["locale", "asChild", "linkAs"] as const;

/**
 * Props a document may not set, per component. Function-only props and
 * function-valued `labels` members are dropped without being listed here
 * (they cannot come from JSON); this table holds the decisions.
 */
export const DROPPED_PROPS: CuratedTable<"droppedProps"> = {
  // Host storage and host chrome: an inline banner is the document's, a page-top one the host's.
  Banner: ["storage", "placement", "sticky"],
  // Component maps and the image allowlist are the host's policy.
  Markdown: ["components", "imageAllowlist"],
  // A bag of attributes spread onto the <table>.
  Table: ["tableProps"],
  PricingTable: ["tableProps"],
  // A component-valued `as` escapes the router and the URL rules.
  Link: ["as"],
  "NavList.Item": ["as"],
  "Breadcrumbs.Item": ["as"],
  // A ref; a child's `autoFocus` places focus instead.
  "Dialog.Content": ["initialFocus"],
  "Drawer.Content": ["initialFocus"],
  // Custom presets compute their range in code; the library's defaults apply.
  DateRangePicker: ["presets"],
  // Code on a filter definition: custom rendering, chip text and URL mapping.
  FilterBar: [
    "filters[].presets",
    "filters[].render",
    "filters[].format",
    "filters[].isActive",
    "filters[].toParam",
    "filters[].fromParam",
  ],
  // Token predicates are functions; the defaults cover 9, A and *.
  MaskedInput: ["tokens"],
};
