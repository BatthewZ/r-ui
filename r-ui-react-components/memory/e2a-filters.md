# FilterBar (round four, e2a)

- **A composed control is controlled from its first render.** `useControllableState`
  locks the mode on the first render, so a control first given `value={undefined}` is
  uncontrolled for life and a chip's removal never reaches it. The bar hands every control
  its kind's empty value (`""`, `[]`, `null`, the whole scale) while the filter is not
  applied.
- **"Not applied" is an absent key.** Each kind normalises what applies nothing (an empty
  list, spaces, a range covering the whole scale) to no key at all, so chips, the count of
  applied filters and the URL agree, and a range dragged back to its ends is no filter.
- **Folding by a container query renders both forms; focus must pick the drawn one.**
  The inline controls and the Filters button are both in the DOM, each hidden by the bar's
  own width. A focus target after Clear all (or the last chip) is the first tabbable that
  `checkVisibility` says is drawn. jsdom draws everything, so unit tests pin `collapse` to
  `always` / `never` and the browser check proves `auto`.
- **A live count is shown at once and spoken once it settles.** The status is mounted
  holding the first count (so only a change is read) and follows a debounced copy; the
  visible text is `aria-hidden` so it is not read twice. While the drawer (a modal) is
  open everything outside is inert, its live region included, so the drawer carries its
  own count.
- **One value shape bridges without coupling.** The bar's value is a record by id, like
  DataTable's `filters`. A page bridges by slicing the shared keys into the table and
  merging the table's changes back; each side's Clear touches only its own keys, which is
  why Clear all keeps keys the bar does not define.
- **A unit is written once in a range.** "300 ms–800 ms" reads badly; the locale's
  `Intl.NumberFormat#formatRange` writes "300–800 ms" with the unit where the locale puts
  it. A chip lists choices in the options' order, not the order they were picked.
- **A look two groups borrow becomes a component.** The bar first borrowed form's chip
  classes by name and had to restate their height (a variable private to form's chip
  frame). The gate made `Chip` a primitive that owns its height; the selection inputs and
  the bar render it, and the bar's rows keep the chip field's pitch (one `--CONTROL-H` per
  line) so a coarse hit area never reaches the next line.
- **A control among fields takes the field's frame through a look prop on the control.**
  The time range was a secondary Button stretched by the bar and read as a button among
  inputs; `DateRangePicker variant="field"` renders `r-form-frame` itself, so the bar asks
  for the look instead of restyling a Button from outside.
