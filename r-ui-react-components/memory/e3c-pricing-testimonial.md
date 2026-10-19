# Pricing, PricingTable and Testimonial (round four, e3c)

- **Cards that must line up across a row share their rows.** Plan cards hold different
  amounts (a price note, no description, a long name), so their prices and actions drifted.
  Each `<li>` and the card in it are `grid-rows-subgrid` spanning the five parts; an absent
  part renders an empty box so every card keeps five tracks. When the list wraps to one
  column each card simply spans its own five rows. The card is not a size container
  (`@container-normal`): containment makes a grid its own, and it stops being a subgrid.
- **Speak a change where the value is observed, not in the handler.** The billing
  announcement compares the rendered billing with the last one seen (state set during
  render), so a parent driving a controlled `billing` is spoken too and the first render is
  silent. The live region is mounted empty from the start; a region inserted with its text
  is not reliably announced.
- **A spoken list is `Intl.ListFormat`, not a hard-coded comma.** The per-plan prices in the
  announcement are joined by the locale's own `unit` list style.
- **A sticky head and a sticky column in one scroller need different stacking.** The body's
  pinned cells stay at `z-index: auto`, so the head (`z-raised`) passes over them while the
  table scrolls down; at the same z-index the later body cells would paint over the head.
  Nothing positioned may sit in the value cells, or it paints over the pinned column.
- **A scroller is every sticky's frame, both axes.** A table root that scrolls sideways is
  also the frame its head sticks to, so the head cannot stick to the page. The comparison
  table caps its own height (to the viewport, overridable) so the head has something to
  stick inside.
- **A pinned row header paints its own fill.** `Table stickyHeader` bands the head's cells
  only, so the pinned feature cells take their opaque fill from the group sheet
  (`--r-marketing-pricing-surface`) and the row's hover wash is re-drawn over it as a
  `background-image`.
- **A press-to-explain term on `Tooltip`.** The tooltip never opens on touch by design, so the
  term's own click opens it (controlled `open`); the trigger's press-dismiss runs first on
  pointerdown, and the click reopens it. The open is not routed through floating-ui as a click,
  so a mouse leaving still closes it: fine for a description, and touch has no hover to lose.
- **A person's name is not a `<cite>`** (WHATWG: cite is a work's title). The quote's source
  work is the `<cite>`; the person is in the `<figcaption>`, which also names the `<figure>`
  in browsers (Testing Library's name computation does not follow figcaption, so that claim
  is a browser check).
- **Quotation marks belong to the language.** `quotes: auto` (inherited) with `open-quote` /
  `close-quote` on the first and last paragraph gives „…“ under `lang="de"` and «…» in
  Arabic with no label to translate.
- **A `rowgroup` header is a row header to the accessibility tree.** Tests that list a
  table's feature names filter row headers by `scope="row"`.
