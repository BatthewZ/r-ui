# EventCalendar time grid slots (round f2)

- **A layer under the events, laid out by the same grid.** The slots are one element
  spanning the day tracks as a column subgrid of the time grid's body, with its own rows
  (one per slot, sized from `--ROW-H` like the blocks), each ARIA row a subgrid row of it.
  Cells then line up with the day columns at any width, density or input, with no
  measuring. It is positioned and comes before the day columns, so they and their events
  paint over it; the day columns take no presses, so empty time reaches it.
- **Overlays in a grid are absolute children, the rows placed on explicit lines.**
  Auto-placement steps around occupied cells, so full-width rows beside in-flow pieces that
  span every row would drop into implicit rows past the grid. An absolutely positioned
  child of a positioned grid takes its grid lines as its containing block and takes no part
  in placement.
- **One tab stop over hundreds of cells: `aria-activedescendant`, and the ring on the
  cell.** The focusable layer is a day tall, so its own ring would frame the whole grid;
  it draws none (`outline: 0 none`, as forced colours revive a bare `none`), and the active
  cell draws the ring only under the layer's `:focus-visible`, so a mouse press shows no
  cursor.
- **A ring that must show over other content and never take a press is a raised,
  press-through pseudo-element.** Raising the cell itself put it above the events in hit
  testing, so a press on an event covering the cursor's slot went to the slot.
- **Keep the stored cursor inside the bounds, even when what is drawn is clamped anyway.**
  Drawing snapped an out-of-range minute back into the day, so plain moves looked right;
  a Shift extension from that minute reached into the day before.
- **A drop reads the drag's own record, not state.** The engine calls the last move and the
  drop in one tick, before a render: keep the drag's anchor and head in a ref and commit
  from it; state is only for drawing.
- **Focus a press gives is not focus to scroll to.** On keyboard focus the layer brings the
  cursor's slot into view; a pointer press (focus arriving after `pointerdown`) must not
  scroll the region away from where the pointer is.
- **Controllable state dedups calls by value**, so "called once" claims about a callback
  wired through the shell can hide a component that calls on every key; test what the
  component itself does differently (an Escape it leaves to the page, a range that stays
  inside the day).
- **An absolutely placed grid item spans to the container's edge unless told otherwise.** For
  an in-flow item `grid-column: 5` is one track; for an absolutely positioned one the missing
  end line is `auto`, which means the grid container's padding edge, so each draft piece ran
  from its day to the last day. jsdom cannot see it (no layout) and the piece count was
  right; the browser check caught it by each piece's centre landing in the wrong column.
  Place an absolutely positioned grid item with an explicit end (`5 / span 1`).
