# Primitives: lessons (2026-10-15)

- **A looping animation cannot ride the duration tokens.** Under reduced motion they collapse
  to 0.01ms; an `infinite` animation at that duration samples a random phase every frame, which
  is a strobe, not stillness. Decorative loops (skeleton pulse) take `motion-reduce:animate-none`;
  an activity spinner keeps Tailwind's fixed `animate-spin`, because a frozen arc reads "stuck".
- **A fill needs its own on-ink token before anything writes on it.** The domain marks
  `serious` and `stale` are mid-tones that a guessed light or dark ink does not clear 4.5:1 on,
  so a solid chip was withheld by type until `--C-TEXT-ON-SERIOUS/-STALE` existed and
  `verify:domain-contrast` measured them. Withhold by type, then relax by token; never guess.
- **A hover for a fill with no hover token: mix toward the primary ink, in oklab.** The primary
  ink is always on the opposite side of the ramp from an on-fill text, so contrast only grows.
  Mixing in oklch drags the fill's hue toward the ink's near-neutral hue (red went orange).
- **Ink-at-alpha beats a surface rung for washes that must read on any host.** Ghost hover and
  skeleton bars use `bg-fg-primary/N`: a surface rung is recessed (darker) in every theme, so on
  a dark theme's raised card a rung-3 skeleton reads as a hole, and on a tinted alert a rung-2
  hover reads as a grey patch.
- **Pseudo-element hit area: `inset: min(0%, calc((100% - var(--HIT-MIN)) / 2))`.** Percent
  insets resolve per axis, so one declaration grows a non-square box symmetrically to the floor
  and stays flush when the box is already bigger. It now lives in the contract as `hit-area`;
  three groups had each written their own copy, and one of them stole presses from the input
  it surrounded.
- **A control that draws a box lines up with its neighbours.** A bordered or filled icon
  button beside Buttons and fields takes `--CONTROL-H`; only the chrome-less (ghost) one stays
  a compact square, because nothing visible shows its height.
- **`aria-describedby` for a new-tab hint, not hidden text in the link.** Accessible-name
  computation concatenates inline children without a space ("Docs(opens in a new tab)") and
  the hint becomes part of the name; a `hidden` description element keeps the name the visible
  text and still serves `aria-describedby`.
- **A card header must decide by content whether its actions fit, and a grid cannot.** The
  first header was a 2-column grid (`minmax(0,1fr) auto`) behind a 24rem container query. An
  `auto` track takes up to its max-content before an `fr` track gets anything, so an unbreakable
  Badge in the actions starved the title to 0px; `minmax(0,auto)` does not change that. The
  query also stacked a one-link header ("All incidents") in a 23rem dashboard card. And every
  non-part child (Marketing's feature icon) was auto-placed into whichever cell was free. Now
  the header groups everything but `Card.Actions` into one text block (`basis-column-sm`,
  grows) and lets flex-wrap drop the actions under it only when they do not fit beside it;
  the actions are `min-w-0 max-w-full` and cap each child, so nothing widens the card.
- **A gate's false positive is the gate's bug.** `verify:utilities-exist` once followed
  `isText = shape === "text"` to the parameter default `"text"` and called it a dead class; the
  workaround (a literal class map) was fine code, but the fix belonged in the extractor, which
  now skips everything that can only be a boolean (comparisons, conditions, the left of `&&`).
