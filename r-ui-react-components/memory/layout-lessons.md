# Layout: lessons (2026-10-15)

- **Page width and column floors are contract tokens, not derivations.** They first derived
  from `--MEASURE` (two reading lines; a third / half / two thirds of one), which tied a page's
  width and a grid's floor to the UI font's `ch` and so to density. `--PAGE-MAX` and
  `--COLUMN-SM/MD/LG` are fixed lengths: density changes what fits in a column, not how wide a
  page may grow. Tailwind's own `max-w-md` scale fails `verify:no-raw-tailwind`.
- **A Grid that adapts to its own width needs a wrapper.** A container query never matches the
  container itself, so the grid sits inside an `@container` div. Put `as`, props and `className`
  on the GRID (so `<Grid as="ul">` holds its `<li>`s directly) and the wrapper behind
  `classNames.container`. The wrapper has inline-size containment: it fills its parent and never
  sizes to content, so it collapses in a flex row unless given a width.
- **Container caps the content box, not the border box.** `box-sizing: content-box` puts the
  fluid gutter outside the cap, so `width="measure"` holds exactly one reading line at any
  gutter size.
- **UI inside `.prose` measured, not assumed.** A Button inside a prose paragraph was `--CONTROL-H`
  tall (36 / 28 / 44 across comfortable, compact, compact + coarse) at UI text size while the
  paragraph beside it ran 17.4px on 28.7px leading. The region sets no font size; the control
  sets its own.
