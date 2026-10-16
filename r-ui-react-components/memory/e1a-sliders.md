# Sliders and Rating (round four, e1a)

- **One frame for N thumbs.** Slider and RangeSlider are thin adapters over one internal
  frame (values in, values out). Single-thumb behaviour is the N = 1 case of the
  multi-thumb rules, so keys, drag, commit and marks exist once. ColorPicker's own
  sliders take the same pointer drag, pointer position and one-axis keys.
- **A commit is the end of a gesture, measured against its start.** Snapshot the values
  when a gesture begins (press, first handled keydown) and compare on release, key up,
  or blur mid-key; report only if something moved. A held key repeats keydown and sends
  one keyup, so it commits once. A gesture that ends where it began commits nothing.
- **A press that hands focus between thumbs is not a blur that ends the gesture.** Keep a
  "pressing" flag for the pointer's lifetime and ignore blur while it is set.
- **Stacked thumbs need a slop, not equality.** A pointer never lands exactly on a value,
  so "press exactly on coincident thumbs" never happens in a browser. Within half a
  thumb (converted to value units from the rendered sizes) the press grabs the pair and
  the drag's direction from the press point picks the thumb.
- **Track the active pointer in a ref, not with `hasPointerCapture`.** Capture still makes
  the drag follow outside the element, but jsdom has no capture; with a ref, a stubbed
  rail rectangle plus `fireEvent.pointerDown/Move/Up` unit-tests the drag and commit-once.
- **Centre a label on a position in both directions with a zero-width flex anchor**
  (`inline-size: 0; justify-content: center`), not `translate: -50%`, which is physical
  and lands on the wrong side in RTL. `flex-start` / `flex-end` on the same anchor make
  the end labels flush with the rail's ends.
- **A hidden overlay part is `display: none`, not `visibility: hidden`.** A hidden box
  still counts toward scrollable overflow, so an invisible value bubble near an edge would
  widen its demo's scroller.
- **A rating is one slider, not a radio group.** Half steps would double the radios and
  "no rating" would need an uncheckable radio; the slider says "No rating" and "3.5 out of
  5" in its value text, with one tab stop. Read-only is a display, not a disabled
  control: an image named by its value, out of the tab order, drawn at any fraction.
- **An icon drawn twice is a clean partial fill.** An outline in line ink, and a
  `currentColor` copy clipped from the inline start to the fraction; RTL fills from the
  right for free, and a caller retints with a `text-*` class on the root.
