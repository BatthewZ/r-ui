# Selection inputs: lessons (2026-10-15, round 2, b3)

Combobox, MultiSelect and TagInput share `selection-popup.tsx` (list building, the
`aria-activedescendant` cursor, the listbox panel), `selection-field.tsx` (frame, chips,
announcer, hidden inputs) and `selection-filter.ts` (matching).

- **An inline `mergeRefs(...)` detaches the ref on every render.** React calls the old
  callback with `null` in the mutation phase and the new one when it reaches that fiber in
  the layout phase, so a layout effect in an EARLIER sibling (the chips, focusing the input
  after the last chip goes) read `inputRef.current === null` and focus fell to `<body>`.
  Memoise merged refs (`useMemo(() => mergeRefs(ref, inputRef), [ref])`) wherever another
  part's effect reads them.
- **A container variant needs a literal size.** A container query's condition cannot read a
  custom property, so a `--container-*` declared as `var(…)` compiles its variant to nothing
  (`verify:utilities-exist` caught `@max-column-md:`). The contract now declares those sizes
  as literals equal to the lever defaults, so `@max-column-md:` works; it stays at the
  default length when a theme retunes `--COLUMN-MD`.
- **Highlight by folding each code point, and keep combining marks with their letter.**
  Folding (NFD, strip marks, lowercase) changes lengths, so the match is found in the folded
  text and mapped back through a per-unit origin table; a decomposed "é" folds its mark to
  nothing, and the range must extend over it or the accent lands outside the `<mark>`.
- **Virtualizing an `aria-activedescendant` list:** the active option's id must resolve, so
  rows are absolutely positioned at `index × --ROW-H` and the active row is mounted even
  outside the window. The scroll-into-view effect depends on the cursor only; with the rows in
  its deps, every scroll re-render pulled the list back to the cursor. Options carry
  `aria-setsize` / `aria-posinset` there. Windowed rows are fixed `h-row`, so a description
  goes inline; unwindowed options are `min-h-row` and grow to two lines.
- **Focus never leaves the input.** The panel's `mousedown` is prevented (options are not
  focusable, and a press would blur the input), and so is the chevron's and the clear
  button's (`tabIndex={-1}`: the keyboard has the arrows and Escape).
- **Escape follows the APG order:** an open list closes and the typed text reverts; Escape
  again clears the value; an Escape with nothing to do is not prevented, so a dialog around
  the field still closes.
- **`required` on a value no visible input holds:** the visible input is `required` only
  while nothing is chosen (native validation then blocks an empty submit) and
  `aria-required` throughout. Submission is one `<input type="hidden">` per value.
- **A caller's `y` flag makes `RegExp#test` match only at index 0** (and `g` makes it
  stateful), so the delimiter is copied without either.
- **A chip fill is ink at low alpha, not a surface rung**: `--C-SURFACE-2` read as a black
  hole in the dark example theme's field. The chip also has a border (its forced-colors edge).
- **A chip row's pitch is one `--CONTROL-H`**: chip height = control height − 2 × (frame
  padding + border), row gap = 2 × the same. The field grows by whole control heights, and a
  coarse remove button's centred hit area cannot reach the next row.
- **user-event submits on Enter only with a submit button or a single input**; hidden inputs
  count, so a form test of a named MultiSelect needs a submit button.

Enforced by the vitest suites and `scripts/browser/selection-inputs.js`.
