# Media group (Image, Lightbox, MasonryGrid): lessons (2026-10-19, round 4)

- **A size from a prop goes in as a unitless custom property, scaled in CSS.** An inline
  `width` would beat the caller's `className` (`w-full`); `--r-media-image-w: 1600` read as
  `calc(var(--r-media-image-w) * 1px)` in the group stylesheet sits in the components layer,
  so any utility wins, and `1px` used as a unit (no line drawn) passes the raw-value gate.
  The same trick carries the masonry offsets.
- **A picture's root is a `<span>`, displayed block.** A thumbnail lives inside a `<button>`
  or a link, whose content model is phrasing only.
- **`complete && naturalWidth > 0` at mount is "already loaded".** A cached picture (or one
  loaded before hydration) may be complete before React listens; read it in a layout effect.
  The flip side: a demo that replays a fade must load a fresh address each time, and a
  fragment does not make one (the memory cache keys without it); use a query.
- **Keep the placeholder under the picture until the picture is opaque.** Unmounting it at
  `loaded`, or fading both at once, shows the bare box mid-fade; the placeholder fades out
  with a delay of the picture's own duration, so reduced motion (both tokens collapse) still
  swaps at once.
- **An undecodable `data:` URI is the error demo.** A 404 logs a console error, which fails
  the Overview matrix (the marketing lesson holds here too).
- **React's `preload()` remembers every address for the document's life.** A second call is a
  no-op even after the `<link>` was removed, so tests that assert preloads use addresses no
  other test touched.
- **`asChild` on a link: the trigger prevents navigation itself and leaves modified clicks
  alone.** `mergeProps` runs the child's handler first and skips ours if it called
  `preventDefault()`, so a child that "stops the link" would also stop the viewer. A link to
  the full file is the progressive-enhancement trigger.
- **Focus home after a dialog is the opener, recorded at open.** `<dialog>` restores focus to
  what was focused at `showModal()`, but not every engine focuses a pressed button. A trigger
  records itself; a controlled open is recorded by a child rendered before `Dialog.Content`,
  whose layout effect runs before `showModal()` moves focus in.
- **Masonry in source order: the CSS grid picks the columns, the script only stacks.**
  `repeat(auto-fill, minmax(floor, 1fr))` gives the column count by the grid's own width (and
  RTL, and the gap); the script reads the resolved `grid-template-columns` (a px list in a
  browser, empty in jsdom), puts every item in row 1 of its shortest column with a top margin,
  and the row grows to the tallest column. Greedy shortest-column means each item starts no
  higher than the one before it, so reading down follows tab order. Re-layout from a
  ResizeObserver is deferred a frame: placing changes the observed grid's height, and doing it
  inside the callback is a "ResizeObserver loop" console error.
- **One grid row cannot fragment across pages.** On paper the items fall back to the plain
  source-order grid (`@media print` in the group stylesheet), each `avoid-break`.
- **Playwright treats `aria-disabled="true"` as disabled.** `click()` waits for it to enable
  and times out; a check that presses a disabled-but-focusable control forces the click.
