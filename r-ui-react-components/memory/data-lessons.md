# data group — lessons

## Table sizing (auto layout)

- **`max-width: 0` on every text cell does not "truncate when squeezed"; it starves the text
  columns.** Chrome then hands all spare width to the columns that kept an intrinsic size
  (the numbers). Measured: names collapsed to two characters while numeric columns sprawled.
  What works: numeric and short columns `w-0 whitespace-nowrap` (exactly their content),
  truncating text columns `max-w-0 truncate`, which then share the rest. A column that should
  hug its content (a status) opts out of truncation instead.
- **An inline-flex child (icon + label) sits a few px high in a table cell**: its baseline is
  synthesized from the icon box. `*:align-middle` on the cell fixes every such child at once.

## Fixed layout and dropped columns

- **A `display: none` header in a fixed-layout table still reserves its width** when the width
  is an inline style, because the inline style outranks the container-query class. Pass the
  width through a custom property and a class (`w-(--col-w)`), and zero it in the same
  container step that hides the column.
- **A cell that spans every column also spans the dropped ones**, and those spanned columns
  come back as empty width at the end of the table. Virtual-window spacer rows carry no cell
  at all; a `<tr>` with only a block size holds the scroll height.

## Virtualizing on a token

- **The row height is `--ROW-H`, read from the scroll area** (registered `<length>`, so it
  reads back in px). Rows hold it exactly only because the height lives on the `<tr>`, cells
  carry no block padding, borders are separate (not collapsed) and every cell is one line.
- **Watch the value, not the causes.** Observing `data-density` / `data-input` / `data-theme`
  and `(pointer: coarse)` missed a stylesheet that retunes `--ROW-H-*` with no attribute moving
  (a late theme, a consumer override), and the window desynced. A hidden probe of
  `height: var(--ROW-H)` inside the scroll area, under a ResizeObserver, sees every cause,
  listed or not. Proven by `data-virtualized-rows.js` (step 6).
- **Shrinking the row height under a scrolled-down window lands the start index past the
  last row** for one render. `useVirtualRows` clamps its start to the last full window and sizes
  the spacers from the clamped indices; unclamped, the top spacer alone outgrew the new list and
  the scroll height sustained itself at the old size. Fix such things in the shared hook, not in
  the one consumer that noticed.
- jsdom resolves custom properties from stylesheets and inheritance but has no ResizeObserver,
  so the unit tests stub one at that boundary and fire it; the probe's actual resize and the
  scroll-height arithmetic need the browser check.

## Text that cannot fit

- **Every text slot that can receive a user's string breaks an unbroken word**, or it pushes
  its box (a `dt` overlapping its `dd`, a KPI value out of its tile). `[overflow-wrap:anywhere]`
  where the slot sits in a track sized by content (it also lowers the min-content size);
  `break-words` + `min-w-0` where the track is already bounded. A KPI value wraps rather than
  holding `nowrap`: a normal figure has no break opportunity, so it still reads as one line.
- **A pricing or feature grid wants wrapping cells**, not a caller undoing truncation with
  `w-auto whitespace-normal`: that is `wrap` on `Table.Cell` / `Table.HeaderCell`. Never in a
  `VirtualizedTable`, whose rows must stay exactly `--ROW-H`.

## Tokens

- Serious and stale had no on-fill text pair, so nothing could put words on those marks as
  fills. The ON half picks whichever ink clears its own mark and may flip between schemes.
