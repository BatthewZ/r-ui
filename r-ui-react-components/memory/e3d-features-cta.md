# FeatureGrid, FeatureRows, HowItWorks, CallToAction, EmailCapture (round four, e3d)

- **One numeric toggle beats a rule block per width.** HowItWorks turns from a column into a
  row at a width that depends on its step count, and a container query cannot count. A
  literal container variant per count sets one custom property (`--r-marketing-how-h`, 0 or
  1) on the list; every length blends the two forms with it (`calc(h * a + (1 - h) * b)`),
  and flex wrapping does the rest: a basis of `(1 - h) * 100%` puts each step on its own
  line or shares one line. Keywords (`grid-auto-flow`) cannot be blended, so the layout
  avoids them. A connector draws one edge only (inline-start in a column, block-start in a
  row), so its box's other extent is free.
- **Borrowing a marker look means borrowing what sizes it.** The steps group's marker class
  reads `--r-steps-marker`, declared on its root class, so a component that reuses the marker
  carries that root class too. Both are class edges in the group graph (marketing → steps).
- **A server error set during submit blocks the retry.** `setErrors` keeps a path's message
  until its value changes, and a submit validates first, so pressing again with the same
  address fails on the old message. Clear the path in `onSubmitCapture` on the `Form` (it
  passes capture handlers through); the store's own outlet then still describes the field in
  the commit the next failure appears, and its focus request moves focus there.
- **Report a failure through the form, not local state.** A message held in component
  state renders in one commit and joins `aria-describedby` in the next (the Field registers
  it in an effect), so focus moved in the same commit lands on an undescribed field. The
  form's error path has the outlet, which counts in the commit the error appears.
- **Announce success from a region that was already there.** The status element is mounted
  empty from the start; success fills it and focuses it (`tabIndex={-1}` only then), and the
  form unmounts beside it.
- **A stretched link on a borderless item sits on the item.** MediaCard's `::after` is inset
  by minus the border width to cover the card's border; on an item without one, that
  hairline reaches past a grid's edge and widens its scroller.
- **The raw-length gate reads demo prose.** A section description saying "56rem" fails it;
  name the container step (`@4xl`) instead.
