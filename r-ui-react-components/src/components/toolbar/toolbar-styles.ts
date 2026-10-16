/**
 * The touch spacing of every toolbar row (the toolbar, a group, a ToggleGroup).
 *
 * `r-toolbar-spaced` sets the gap to the overhang two icon-sized neighbours'
 * hit areas would share, so they never overlap. The second class lets a hit
 * area that follows another grow toward it again: the contract's `hit-area`
 * stops that growth because a plain row has no such gap, and here the gap is
 * there, so every control gets its whole hit area. It is a utility (an
 * arbitrary variant) because the contract's rule is one, and a group rule sits
 * in a lower layer.
 */
export const SPACED_CLASSES =
  "r-toolbar-spaced [&_.hit-area+.hit-area::before]:[inset-inline-start:min(0%,calc((100%_-_var(--HIT-MIN))_/_2))]";
