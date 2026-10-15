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
- **A container query cannot count**, so the collapse width for a horizontal Stepper is a
  literal container variant chosen by step count (about 9rem a step). Both forms are in
  the DOM; the hidden one is `display: none`, so assistive tech reads only the visible one.
- **A marker class with no rule is dead to `verify:utilities-exist`.** Hooks for tests and
  checks are data attributes (`data-compact`, `data-position`, `data-status`, `data-ring`).
- **States survive forced colours by edge, not fill.** Complete keeps its `bg-primary`
  (the utility opts out); current and error are a double-weight ring (Highlight vs
  CanvasText), skipped is dashed, upcoming single; each also has its own glyph and word.
