# Marketing group (Hero, MediaCard, Carousel): lessons (2026-10-15, round 3)

- **A heading in a content-sized track needs `overflow-wrap: anywhere`.** A centred hero
  stacks its text column with `items-center`, so the column is fit-content wide; `break-word`
  does not lower min-content, so one long word set the title (and the column) wider than the
  container. `anywhere` does. Any slot whose box is sized by its content takes it.
- **Making a component a size container moves every `cqi` inside it.** The page hero's title
  used to size to a Grid wrapper inside the page; as a Hero it sizes to the Hero. A check that
  hard-coded "36px at 375" went red; predict from the token's own clamp over the measured
  container width instead of a remembered number.
- **The stretched link owns the card, so a click test cannot click the text under it.**
  Playwright's `locator.click()` refuses (the link "intercepts pointer events", by design).
  Hit-test with `elementFromPoint` (the pseudo-element reports its link) and press with a raw
  `page.mouse.click`.
- **Actions above a stretched link need paint order, not z-index.** The link's `::after` is
  positioned; the actions come later in the tree and are `position: relative`, so they paint
  and hit-test above it with no z-index. Badges earlier in the tree fall under it and the
  press goes to the link, which is right for a non-interactive label.
- **The card's ring lives on the stretched box.** The link zeroes its own outline
  (`outline: 0 none`, for forced colours) and its `::after` draws the ring around the card, so
  the card must not clip (`overflow`); the media box clips its own corners instead.
- **Carousel geometry in reading order.** Measure each slide's start edge against the track's
  start edge (right edge in RTL, minus `scroll-padding`), then convert the delta to
  `scrollLeft`'s sign. One code path does next, previous, Home/End and dots in both directions;
  `scrollLeft` is negative in RTL in every current engine.
- **Peek only when something is left to peek at.** The slide basis subtracts the peek times
  `clamp(0, count - per, 1)` (count as an inline custom property, per from container-query
  utilities), so a row that fits has no stub at its end.
- **A broken-image demo must not log.** A 404 `src` is a console error, which fails the
  Overview matrix; an undecodable `data:` URI fails the image silently.
- **A decorative layer clips with `overflow: clip`, never `hidden`.** A `hidden` box is the
  nearest scroll container, so a view timeline inside (a Parallax) follows it instead of the
  page and never moves. The same holds for every frame between the layer and the page (the
  showcase's demo frames clip too). Paint order, not z-index, puts the content above: the
  layer comes first and the content after it is positioned.
