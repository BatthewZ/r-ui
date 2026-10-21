/**
 * The component sections, in reading order, keyed by contract `category`
 * (the library's own group, `builtin`, or `custom` for a host's). A category
 * missing here still renders, titled by its key, after these; a test fails
 * when the shipped contracts carry one this list does not name.
 */
export const CATEGORY_TITLES: { readonly [category: string]: string } = {
  layout: "Layout",
  builtin: "Built-in",
  primitives: "Primitives",
  content: "Content",
  data: "Data",
  charts: "Charts",
  feedback: "Feedback",
  form: "Forms",
  dates: "Dates",
  filters: "Filters",
  steps: "Steps",
  toolbar: "Toolbars",
  navigation: "Navigation",
  disclosure: "Disclosure",
  overlays: "Overlays",
  media: "Media",
  marketing: "Marketing",
  motion: "Motion",
  custom: "Custom",
};
