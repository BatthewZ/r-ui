/**
 * How components relate to their children and to the renderer's own state:
 * the parents that read their children (so nothing may sit between them),
 * the components whose children are source text, the dialogs the renderer
 * opens, and the props that name a form.
 */

import type { CuratedTable } from "./table";

/**
 * Parents that read their children: by element type (`identity`), by reading
 * their props (`props`), by cloning them (`clone`) or by counting them
 * (`count`). The renderer builds these children as the library's own elements.
 */
export const CHILD_INSPECTION: CuratedTable<"childInspection"> = {
  // Picks `Card.Actions` out of its children by type.
  "Card.Header": "identity",
  // Keeps only `Carousel.Slide` children and spreads their props onto its own slides.
  Carousel: "identity",
  // Classifies each unit (item, group, separator, toggle group) by type for the overflow menu.
  Toolbar: "identity",
  // The toolbar reads a group's children through the group's props, by type.
  "Toolbar.Group": "identity",
  // Read each step's label, status and fields off its props.
  Stepper: "props",
  Wizard: "props",
  // Clone their one child to wire it as the trigger.
  Tooltip: "clone",
  "HoverCard.Trigger": "clone",
  // Clones every child to add its stagger class and index.
  Stagger: "clone",
  // Number, separate or collapse their children by position.
  Breadcrumbs: "count",
  FeatureRows: "count",
  HowItWorks: "count",
  LogoCloud: "count",
};

/** `children` is source text the component parses: written as text, joined verbatim. */
export const TEXT_CHILDREN: CuratedTable<"textChildren"> = {
  Chip: true,
  Markdown: true,
};

/** Modal roots whose open state the renderer owns, addressed by `dialogId`. */
export const DIALOGS: CuratedTable<"dialog"> = {
  Dialog: true,
  Drawer: true,
};

/** `name` is a form field key (the binding), not a DOM name. */
export const FIELD_NAMES: CuratedTable<"fieldName"> = {
  Field: true,
};

/**
 * `name` names the hidden input(s) the component submits: a DOM name. The
 * deriver adds every component whose native attributes carry `name` (Input,
 * Select, Button, …); this lists the ones that declare their own.
 */
export const DOM_NAMES: CuratedTable<"domName"> = {
  Combobox: true,
  MultiSelect: true,
  RadioGroup: true,
  RangeSlider: true,
  Rating: true,
  SegmentedControl: true,
  Slider: true,
  TagInput: true,
  TimeField: true,
  TimePicker: true,
  ToggleGroup: true,
};

/**
 * Components whose own `name` means something else, and keeps it. Not a
 * contract field (keeping is the default); the classification the name gate
 * reads, so a new library `name` prop is decided rather than defaulted.
 */
export const OWN_NAMES: { readonly [name: string]: string } = {
  Avatar: "The person or thing; its initials show without a picture.",
  Testimonial: "Who said it.",
};

/** Parents whose children sit in element-structured markup: a diagnostic there goes to the issue log. */
export const STRUCTURAL_CHILDREN: CuratedTable<"structuralChildren"> = {
  Table: true,
  "Table.Head": true,
  "Table.Body": true,
  "Table.Row": true,
  DescriptionList: true,
  Select: true,
};

/** Props whose string names a declared form; the renderer passes that form's handle. */
export const FORM_PROPS: CuratedTable<"formProps"> = {
  Form: ["form"],
  Wizard: ["form"],
};
