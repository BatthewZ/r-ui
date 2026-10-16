# DataTable features and the Timeline thread (round four, e1d)

- **A pinned cell's opaque fill hides every wash drawn on its row.** Hover, selection and
  stripes live on the `<tr>`; a sticky `<td>` must be opaque or scrolled cells show through,
  so it re-draws them itself: the table surface as its colour, the row's wash as a
  `background-image` over it, keyed by the row's attributes (`data-selected`, `data-band`).
  A head cell's band is a utility and wins over the component rule on its own.
- **`position: relative` unpins a sticky cell.** A rule written for "the first cell" (the
  forced-colours selection bar) beat the sticky class on specificity. A sticky box is
  already a containing block; exclude it rather than re-asserting `sticky`.
- **Forced colours paint transparent borders.** An edge that should appear only in a state
  (scrolled under) cannot be a transparent border waiting for a colour: the pseudo-element
  exists only in that state.
- **A sticky layer order inside one scroller.** Pinned body cells are `--LAYER-RAISED`; a
  sticky head over them needs the next step (`z-sticky`) only when columns are pinned, and
  the footer bar (bulk actions, pages) is sticky too.
- **A control in an auto-layout cell widens its column.** Wrap filter controls in a box that
  is zero wide to the table's sizing and as wide as the cell (`w-0 min-w-full`).
- **A live region inserted with its text is often not read.** The bulk bar mounts with the
  selection; its status is mounted (empty) with the table and only its text changes, and the
  bar's own copy of the count is hidden from the tree so it is not read twice.
- **Removing the focused bar fires no blur.** Track "focus is in the bar" on focus capture;
  when the selection empties and focus fell to `<body>`, hand it to select-all.
- **Measured lengths cross into CSS as unitless counts.** Widths and offsets are px numbers in
  state; a custom property gets `calc(N * 1px)` (React adds no unit to custom properties).
  Token bounds (`--CONTROL-H * 2`, `--MEASURE`, a step of `--R-SIZE-3`) are resolved by a
  probe in the header cell at the moment a gesture starts, so density moves them. In jsdom
  the probe reads 0; tests stub `getBoundingClientRect` at that boundary, keyed by the
  probe's attribute.
- **A virtual window holds only fixed-height rows.** VirtualizedTable takes filters, the
  columns menu, resizing, pinning and the bulk bar, and excludes detail rows and pages by
  type rather than half-supporting them.
- **A thread is measured from the drawn mark, not the mark's box.** The Timeline's connector
  stopped short twice over: the gap between events was padding outside the grid row the rail
  spans, and a stateless event's small dot sat centred in a disc-sized box, so the gap was
  counted from an invisible edge. The spacing moved into the body (inside the row), the dot's
  mark box became the dot, and the line above a dot reaches past its item (`:has(+ … dot)`).
  The Timeline browser check asserts mark · gap · line · gap · mark for every pair.
