/** What each group's page shows, in a line for the Overview's index. A group without one shows its count alone. */
const SUMMARIES: Record<string, string> = {
  tokens: "Series, trend, status and chart colours, per theme",
  primitives: "Buttons, badges, chips, cards, alerts, avatars, links",
  feedback: "Progress bars and rings, banners, error boundaries",
  form: "Inputs, pickers, uploads, sliders and validation",
  dates: "Calendars, date and range pickers, time fields",
  disclosure: "Accordions and collapsibles",
  overlays: "Tooltips, popovers, menus, dialogs, drawers, toasts",
  toolbar: "Toolbars that fold into More, toggle groups",
  commands: "A command palette with pages and recents",
  data: "Data tables, virtual rows, stat cards, timelines",
  filters: "A filter bar that lives in the URL",
  boards: "Kanban by pointer, touch and keyboard",
  charts: "Line, bar and heatmap, each with a table behind it",
  content: "Code blocks, Markdown, copy buttons",
  navigation: "App shell, tabs, breadcrumbs, pagination, trees",
  guards: "Pages that need a signed-in user",
  steps: "Steppers and multi-step wizards",
  layout: "Stacks, grids, containers, prose, splitters",
  marketing: "Heroes, pricing, testimonials, headers, footers",
  media: "Images that blur up, a lightbox, masonry",
  motion: "Reveals, view transitions, count-ups, spotlights",
  preferences: "Theme, density and input switchers",
  locale: "Translated labels and local number and date formats",
};

export const groupSummary = (group: string): string | undefined => SUMMARIES[group];
