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
- **Container caps the content, not the box.** The gutter sits outside the cap (the box
  caps at cap + 2 × `--GUTTER`), so `width="measure"` holds exactly one reading line at any
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
- **Auto inline margins shrink a flex or grid item to fit.** Centring with `margin-inline:
  auto` alone works in a block parent and nowhere else: in a Stack, an Inline or a grid
  cell the item takes its content's width, and a size container inside (Grid's wrapper, a
  Card) has none, so a Container collapsed to its gutters. Give a centred box an explicit
  `inline-size: 100%` and let a max clamp it; prefer that over the `stretch` keyword, whose
  support is recent. A check in a block parent alone cannot see this: put the box in every
  parent kind.
- **A full-width box is border-box, or any padding overflows.** Content-box at 100% spills
  by whatever pads it, and taking the known padding off in a calc fails as soon as a
  caller pads it differently. Keep the box border-box and express a content cap as the cap
  plus the padding you own (`--GUTTER` × 2): a caller's padding then narrows the content
  inside the same box instead of pushing it out.
