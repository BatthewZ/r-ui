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
- **A `ch` measure counts the font of the element it is set on.** `max-w-measure` sat on
  the Prose region, which kept the UI font at the UI size, so "68 characters" was 68 UI
  zeros: an article's width followed density and the theme's UI face (606px at 14px,
  513px in a rounded face), and its 17px body fit about 64 a line. Set the measure where
  the body size is (r-ui-css's prose region now carries it). Compare widths across
  densities in body ems, not pixels: fluid text follows a container whose padding is
  density-driven.
