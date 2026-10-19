# Kanban (round four, e2e)

- **One target, two inputs.** Pointer and keyboard drags share one state: the card being
  moved, where it started and where it would land. Pointer geometry and arrow keys only
  produce a target; drawing, announcing and committing exist once, and a drop commits one
  `onValueChange`.
- **The moving card stays where it is until it lands.** A line shows the landing place
  instead of re-ordering the lists live. Nothing moves under the pointer (no layout shift,
  so midpoint hit-testing cannot oscillate), and during a keyboard drag the focused card is
  never re-parented. Only the drop re-renders it, in another list or another order, which
  drops focus to `<body>`: give it back in a layout effect keyed on the value, and only when
  focus fell to `<body>` (a parent that refuses the move must not have focus stolen later).
- **Measure the line, don't insert it in the flow.** An absolutely placed line, offset from
  the neighbouring cards' `offsetTop` and half the list's row gap, is crossed into CSS as a
  unitless custom property (`calc(var(--…) * 1px)`).
- **A press is a click until it travels.** A few pixels of threshold keep links and buttons
  in a card working; after a real drag, the release's click is swallowed once in the capture
  phase (removed after a tick). `dragstart` is prevented on the card, or the browser's native
  drag of a link or image inside takes the pointer (`pointercancel`).
- **Touch: hold to pick up, move first to scroll.** The press is cancelled past a small slop
  (or by the browser's own `pointercancel` when it starts scrolling). Once picked up, moves
  must not scroll: the board carries a non-passive `touchmove` listener for its whole life,
  because a listener added at the long press arrives after the browser has classified the
  touch's moves as uncancellable. `contextmenu` and `selectstart` are prevented while a touch
  press is pending.
- **Snap mandatory fights edge scrolling.** Every small programmatic scroll snaps back to a
  column. The snap is a container-variant utility the component drops while a drag is in
  progress (a group stylesheet rule cannot beat the utility).
- **A scroller clips at its padding box, both axes.** `overflow-x: auto` also clips
  vertically, so a drop target's outline and a header button's coarse hit area at a column's
  top edge were cut off; the board's scroller is padded.
- **A wrapper that `Omit`s from a props type with a union name** (`aria-label` |
  `aria-labelledby`) loses the union: both become optional and the spread no longer
  satisfies the component. Re-add the name the wrapper requires.

Enforced by the vitest suites (`Kanban.test.tsx`, `kanban-model.test.ts`) and
`scripts/browser/boards-kanban.js`.
