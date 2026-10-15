# Contract questions: what got in, what stayed out, and why

Each entry ran the three-criteria test (standalone-meaningful, cross-cutting, domain-neutral).

## In

- **`--PAGE-MAX`** (`max-w-page`). Every site has a widest content column; headers, footers,
  page shells and marketing sections all read it; the name is layout, not a component. Before
  it existed, a layout derived it as two reading measures, which ties page width to the UI
  font's `ch` and to density for no reason.
- **`--COLUMN-SM/MD/LG`** (`w-`, `min-w-`, `basis-column-*`). The floor below which an auto-fit
  grid drops a column. Card grids, dashboards, field grids and feature lists all use one, with
  or without a component library. Derived from `--MEASURE` fractions it followed the text size,
  which is the wrong question: a column's floor is about what fits in it, not line length.
- Both are **fixed lengths**, not per-density named values: density changes the size of what
  sits in a column, not how wide a page may grow. They live with the other layout lengths in
  the template, with a role comment each.
- **`hit-area`** (`@utility`). The hit floor is already a contract concept (`--HIT-MIN`); the
  pseudo-element that applies it was being re-implemented per consumer, and the copies drifted
  (one sat above the control it surrounds and stole presses from a native input). One utility
  with the stacking fix (`isolation: isolate` on the element, `z-index: -1` on the box) is the
  single source.

## Out

- **Overlay and panel widths** (dialog, drawer, popover, toast, tooltip, sidebar). Each is one
  component's configuration, so a token for it would fail "cross-cutting" and its name would
  fail "domain-neutral". A neutral "panel" scale was considered: dialogs, drawers and popovers
  hold running text, so `--MEASURE` already IS their role ("a reading line wide"), and a second
  token would only duplicate it. Fractions of the measure stay in the component that owns them.
  Layout and component structure are not brand levers, so they are not theme tokens either.
- **Overlapping hit areas** cannot be split at the midpoint in CSS: two pseudo-elements resolve
  by paint order, so a later neighbour's box covers part of the earlier control's visible box
  (measured on coarse input: icon buttons 32px wide with a 44px hit box and a 4px gap, and
  the last 2–3px of the first button answered to the second; compact, 26px and a 2px gap, 7–8px). The utility handles the common
  case, siblings in a row: a hit area right after another does not grow toward it on the
  inline axis, and the earlier one's growth (painted below the later element's own box) fills
  the gap. Non-sibling or vertically stacked small targets need `--HIT-MIN` between centres.
