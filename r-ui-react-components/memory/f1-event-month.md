# EventCalendar month view (f1)

- **A part that spans cells lives in its first cell and is placed by the row.** ARIA lets a
  row own only cells, so a multi-day chip is a DOM child of its first day's gridcell; the
  cells are left unpositioned and the week row is the containing block, so the chip's
  logical inset and inline size are fractions of the row (`100% / 7 × column`, `× span`).
  RTL follows from `inset-inline-start` with no arithmetic, and the span is exact because
  the row's padding box is exactly its seven equal tracks: the row draws only a block-start
  line, and each cell's inline-start line sits inside its own border-box track.
- **`1lh` in a custom property resolves where the property is read.** A lane height
  `max(calc(1lh + 2 × --R-SIZE-6), --HIT-MIN)` declared once on the view means a body-3 line
  only if every element that reads it (the cell's minimum, the chip's offset and size) is
  body-3 itself: set the text role on the common ancestor, not on the parts. The `var()`s
  inside still resolve at the declaring element.
- **Two looks by the container, both in the DOM.** Chips and dots are both rendered; the
  container variants (`hidden @measure:block`, `@measure:hidden`) show one, so the hidden
  look is `display: none` (out of the tab order and the accessibility tree). A rule in the
  group sheet must not set `display` on those parts, or the variant cannot show them.
  jsdom sees both looks, so unit tests address a look by its class, never by "the" event.
- **One floating panel for many anchors: the grid is the reference, the cell positions it.**
  `refs.setReference(grid)` once and `refs.setPositionReference(cell)` per day. A press in
  the grid is never an outside press, so pressing another day re-targets the open panel
  instead of closing and re-opening it; focus returns to the grid's first tabbable, which
  is the roving tab stop, i.e. the panel's day. Swapping the DOM reference while open
  re-runs FloatingFocusManager's return-focus effect, which pulls focus out of the panel.
- **A modifier-free "stop it at the chip" is a check at the container.** `EventTarget`
  owns its click; the cell's handler ignores presses that came from an interactive event
  (`closest("a[data-event], button[data-event]")`). A text event (not interactive) lets the
  press through to its day, which is what a reader pressing a label expects.
- **A reference `Date` built when a module loads is an instant, not a day.** date-core's
  "4 January is a Sunday" was a module-level `new Date(2026, 0, 4)`; a test that set
  `process.env.TZ` after its static imports (which run first) read it in another zone as
  Saturday, and every weekday header moved by one. Build a reference date inside the
  function that reads it, so the zone of the moment applies, rather than reordering imports
  around it.
- **A promoted panel is `display: none` in jsdom with the popover stub**, which also empties
  its accessible name (the labelling heading's text is hidden); assert the
  `aria-labelledby` target's text there, and the name in a test without the stub.
