/**
 * The one thing an author would otherwise get wrong, per component. A
 * declaration carries a prop's shape and nothing else; ranges, placement and
 * what a value means live here. Only where it matters.
 */

import type { CuratedTable } from "./table";

export const NOTES: CuratedTable<"note"> = {
  "Accordion.Item": "`value` is required and unique among its siblings; the root's `value`/`defaultValue` names open items by it.",
  Banner: "Inline only. `dismissKey` remembers a dismissal per view; the renderer prefixes it.",
  Carousel: "Its children must be `Carousel.Slide` nodes (a `$each` of them is fine), with nothing between.",
  "Card.Header": "Put `Card.Actions` directly among its children; it is picked out by type and placed on the end.",
  Chip: "Children are plain text (the chip's name, also used by its remove button), not nodes.",
  DataTable: "`columns` are data and `rowKey` names the field that identifies a row; rows usually come from `{ \"$ref\": \"data.…\" }`.",
  Dialog: "Give it a `dialogId`; `openDialog`/`closeDialog` and its own trigger and close buttons share one open state.",
  Drawer: "Give it a `dialogId`; `openDialog`/`closeDialog` and its own trigger and close buttons share one open state.",
  ErrorSummary: "Must sit inside a `Form`; it lists that form's errors.",
  Field: "`name` binds the control inside it to that form field: give the control no `value`, `checked` or `defaultValue`.",
  Form: "`form` names a declared form. Forms do not nest; a Wizard renders its own.",
  Image: "`width` and `height` are the file's intrinsic size and are required; every URL passes the host's image policy.",
  LogoCloud: "Each logo is an `Image` node with a meaningful `alt`.",
  Markdown: "Children are the Markdown source as text. Images load only where the host allows them.",
  Meter: "`value` is read on the `min`–`max` scale; outside it the fill clamps while the text keeps the real share.",
  Pricing: "`currency` is an ISO 4217 code (`\"EUR\"`); amounts are numbers.",
  ProgressBar: "`value` is on the 0–`max` scale; `null` is indeterminate.",
  Radio: "Only inside a `RadioGroup`.",
  ScrollPanel: "Scrolls only when its parent bounds its height; the class vocabulary holds no heights.",
  Select: "Choices go in `options`, not children.",
  StatCard: "`value` renders as given: format numbers with `$format`.",
  Stepper: "`current` is required; its children are `Stepper.Step` nodes with nothing between.",
  Tabs: "Each `Tabs.Tab` and `Tabs.Panel` pair shares a `value` string.",
  ToggleGroup: "`type` (`single` or `multiple`) is required and sets the value's shape: a string or an array.",
  Toolbar: "`aria-label` is required; its units are direct children, so overflow can move them into More.",
  Tooltip: "Exactly one child, and a focusable one (a Button or IconButton).",
  TreeView: "Give it `items` as data; items nest through `children`, and every level's `href` passes the URL rules.",
  Wizard: "`form` names a declared form; each `Wizard.Step` lists its `fields`, which Next validates.",
};
