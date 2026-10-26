# EventCalendar time grid: lessons (round f1)

- **One grid, subgrid rows, so sticky parts share the days' columns.** The header, the
  all-day row and the body are `grid-template-columns: subgrid` children of one grid (gutter
  `auto` + one track per day), so the gutter's width and every day's width are agreed once.
- **A sticky inline-start part needs a containing block as wide as the scrolled content.**
  A grid whose tracks overflow its box lets the sticky gutter go only as far as the box's
  edge. The grid is `inline-size: min-content; min-inline-size: 100%`: its box covers its
  tracks when they overflow and fills the scroller when they do not.
- **Per-day minimum widths without a template string.** Tracks are `minmax(auto, 1fr)`; a
  day column's own `min-inline-size` sets its track's floor. The floor holds the day's widest
  overlap at `--HIT-MIN` per block (a unitless overlap count crosses into CSS), so a narrow
  calendar scrolls sideways instead of drawing blocks under the hit floor.
- **Stacking without new z values.** The header sticks at `--LAYER-RAISED`; the body is
  `isolation: isolate`, so nothing inside it (a focused block raised for its ring) can paint
  over the header. The gutter labels are `aria-hidden`, so they can come after the day columns
  in the DOM: at the same layer as a focused block they win by order.
- **Sticky chrome covers the scrollport's edges; say so as scroll padding.** The header's
  height and the gutter's width are measured (ResizeObserver) and published as unitless
  custom properties read as `scroll-padding-*`, so `scrollIntoView({ block: "nearest" })`
  and the browser's own focus scrolling land a block clear of both.
- **Scroll to an hour by measuring its line against the header's bottom.** Both live in the
  same content, so the offset is right at any density, input or theme, and stays right if
  the header grows later (fonts, an unfolded all-day row).
- **Text in a block that may be narrow: a line each, with an ellipsis.** Three overlapping
  meetings share a day, so a block can be a few characters wide; wrapped text then breaks
  letter by letter, and clipped text without an ellipsis is a spill the sweep reports. The
  title and the time each truncate (blocks under 45 minutes put both on one line, as two
  body-3 lines do not fit 30 minutes at compact); the full reading is the name and the hover
  title.
- **A description points at text, never at a labelled control.** `aria-describedby` at a
  button with `aria-label` reads the button's text content in dom-accessibility-api. The day
  header holds its full name in a hidden span that labels the button and describes the
  day's "+n more".
- **One roving stop over blocks in two dimensions.** Arrows within a day go by (start,
  overlap column); across days to the nearest start, skipping empty days. The active day
  changes only on a key move (not on focus or a press), exactly once per move.
