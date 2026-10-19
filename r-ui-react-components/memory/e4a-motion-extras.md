# Motion extras: Parallax, CountUp, ReadingProgress, Spotlight (2026-10-19, round 4)

- **Parallax runs on a named view timeline declared by a box that never moves.** The box
  (`view-timeline`) is the subject; only the layer inside it is translated. Animating the
  subject itself against `view()` would feed its own movement back into its progress. The
  layer is grown by the shift at both block ends and the box clips (`overflow: clip`, which
  is not a scroll container, so the page stays the timeline's scroller). Gate the growth and
  the animation together in `@supports (animation-timeline: view())`, so an unsupported
  browser gets a still layer of the box's own size, not an oversized one.
- **Strength is a multiple of a contract distance**, so the token collapse does the rest:
  reduced motion and print zero `--MOTION-DISTANCE-LG`, the shift becomes 0 and the layer
  stops growing, with no query of the component's own. A theme tones it down through the
  same token (which also moves reveals); a parallax-only lever would be a domain token.
- **Decorative by construction, not by convention.** `aria-hidden` + `inert` + no pointer on
  the box, applied after the caller's props, make text or a control inside it visibly
  broken (unreachable, unread) rather than subtly inaccessible.
- **A wash under content is the box's own `background-image`.** A positioned pseudo-element
  paints over in-flow children unless pushed under with a negative z-index, which the
  layer rules forbid. A background image sits beneath every child, composes with a
  `bg-*` colour utility, and needs no stacking context.
- **Measure a wash against muted text before choosing its strength.** The 8% hover wash
  of the primary ink dropped muted text below 4.5:1 on surface 0 in a dark theme; 4% keeps
  every shipped theme at 4.6:1 or better on surfaces 0–2. Hover washes get away with 8%
  because they sit under a control's own label, not under a card's muted copy.
- **Script-driven motion can still take its timing from tokens.** Put the timing on the
  element as `transition-duration` / `transition-timing-function` (with
  `transition-property: none`), read the computed values, and play a keyframe-less
  `element.animate([], { duration, easing })` as the clock: `getComputedTiming().progress`
  is the eased progress, a theme's motion retunes it, reduced motion collapses it to ~0, a
  `duration-*` utility overrides it, and a DevTools playback rate slows it for a check.
  jsdom has no `animate`: treat its absence (and a zero duration) as "land at once".
- **A counting number speaks once.** The moving digits are `aria-hidden`; a visually hidden
  copy holds the final value from the first render, so the server markup, assistive tech
  and a reader without script all get the true figure. An invisible sizer with the final
  value in the same grid cell keeps the box's width fixed while digits change; print
  shows the sizer and hides the frame.
- **A reading-position bar is decoration.** A screen reader's own cursor already tracks the
  position; a `progressbar` would repeat it as a widget only scrolling changes, and would
  need a scroll listener in every browser to keep its value current. It is also not motion
  (a position read straight off the scroll, no easing), so reduced motion keeps it.
- **`renderToString` adds `<link rel="preload">` for an `<img>`**: an exact-markup SSR test
  uses a non-image child.
- **A check for "no scroll handler" wraps `addEventListener` in a page of its own.** An
  init script cannot be removed from a page, so it goes on a second page in the same
  context, closed in a `finally`, and filters recorded stacks by module path with a
  positive control (the probe's own listener).
- **A view timeline belongs to the nearest scroll container, of either axis.** The
  showcase's demo frame scrolls sideways (`overflow-x: auto`, which makes `overflow-y`
  auto too), so Parallax measured the frame and never moved with the page; the check
  read a constant translate. The frame is now `open` for that demo, and the component
  says to keep it out of scrolling boxes.
- **A theme lever and a collapse must both be proven.** `--PARALLAX-SHIFT` derives from the
  reveal distance, so zeroing that distance zeroes it too and a check of reduced motion
  passed with the token's own `!important` zero deleted. The check now sets the token the
  way a theme would before asserting it still holds at 0, with the same override moving
  the layer as its positive control.
- **Inserted decoration shifts a prose flow.** ReadingProgress's bar is the region's first
  child, so prose's `* + h2` gave the first heading a section step; what follows the bar
  now resets its top margin.
- **CDP cannot emulate `pointer` or `hover`.** `Emulation.setEmulatedMedia` accepts the
  features and changes nothing; a touch-enabled second context really is coarse and
  hoverless. And Chrome drops a radial gradient's default `at 50% 50%` when serialising,
  so a parser of computed gradients splits at top-level commas, not on `at`.
