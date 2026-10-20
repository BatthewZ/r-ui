# Steps: Stepper and Wizard (round 3, c2)

- **Per-step validation needs the store to reveal a subset.** Errors show only once a path
  is "reportable" (validateOn reached it, or a submit happened). Faking a step check with
  `blur(path)` only works under `validateOn: "blur"`; with `"change"` or `"submit"` Next
  passed with hidden errors. The store has `validatePaths(paths)`: it marks those paths and
  every mounted field under them reportable, runs the schema and their field checks, and
  answers only for them. A test runs the Wizard under `validateOn: "submit"` to hold this.
- **A blur-time error moves the button under the pointer.** Typing an invalid value and
  clicking Next: mousedown blurs the field, its error renders, the action row shifts down,
  and mouseup lands beside the button, so no click fires (the browser targets the common
  ancestor). jsdom cannot see it; a real browser did. `FormActions` prevents the
  mousedown default on its buttons (every form's action row, the Wizard's included), so
  focus stays in the field until the action moves it on purpose.
- **Only the current step is mounted**, so a Field's registration (and its async check
  result) goes away with its step; values stay in the store. The final submit validates
  everything through the schema; an error on an unmounted step is a loose entry, and the
  Wizard jumps to the first step that has one, then focuses its field after the Fields
  have registered (child effects run before the parent's).
- **Focus on arrival, not on mount.** The heading is focused when the shown index changes
  (a ref of the last shown index), never on mount, so StrictMode's double effects and a
  wizard that starts mid-flow steal nothing.
- **A script-focused heading inherits `:focus-visible` from the field a press left.** The
  press never takes focus (FormActions), a text field always matches `:focus-visible`, and
  the browser carries that to the next scripted focus, so mouse users saw a ring on a
  heading. The heading is not a control: `outline-none`, and the base forced-colours rule
  still restores a ring there.
- **A container query cannot count**, so the collapse width for a horizontal Stepper is a
  literal container variant chosen by step count (about 9rem a step). Both forms are in
  the DOM; the hidden one is `display: none`, so assistive tech reads only the visible one.
- **A marker class with no rule is dead to `verify:utilities-exist`.** Hooks for tests and
  checks are data attributes (`data-compact`, `data-position`, `data-status`, `data-ring`).
- **States survive forced colours by edge, not fill.** Complete keeps its `bg-primary`
  (the utility opts out); current and error are a double-weight ring (Highlight vs
  CanvasText), skipped is dashed, upcoming single; each also has its own glyph and word.
- **Horizontal labels go under the marker, so the line can join marker to marker.** With the
  label beside its marker the line could only start where the text ended, and long labels
  squeezed it to a stub. Equal steps (`flex: 1 1 0`, no gap between them) with the marker
  centred put the next marker's centre one step width on, so an absolute line can be
  inset in percentages (`50% + marker / 2 + gap`, `-50% + marker / 2 + gap`) with no
  measuring.
- **`break-words` cannot break what a grid's `auto` track will not shrink.** An implicit
  grid column is sized at least to its items' min-content, and `overflow-wrap: break-word`
  does not lower min-content, so an unbroken word widened the track and spilled out. Give
  the grid `minmax(0, 1fr)` columns.
- **A digit centred by its line box sits high.** The line box keeps room below the baseline
  for descenders that digits never have, so a number "centred" in a circle sat about 2px
  above the middle (an icon, centred by its own box, did not). `text-box: trim-both cap
  alphabetic` on a block-level number trims the box to the digit. Measure the ink at a
  high device scale, not the box: the box was centred all along.
