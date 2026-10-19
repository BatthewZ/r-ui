# The Marketing page rebuilt from the library (round four, e4b)

- **A site header inside a host with its own sticky bar sticks under that bar.** A
  `SiteHeader` sticks at 0 of its scroller; inside the showcase the document already
  has a sticky top bar, so the page measures that bar and sets it as the header's
  `--r-marketing-site-header-top`, which moves where it sticks and how far it slides
  when hidden (moving only `top` left a strip of the hidden header under a shorter
  bar). The page root is `isolate`, so the header's sticky layer stacks inside the page
  and, mid-slide, passes under the host's bar instead of over it.
- **Scroll padding is every sticky bar above the target.** In-page anchors land under
  the header unless the scroller pads by `--r-marketing-site-header-h`, plus any bar
  the host already sticks there. The page sets it on the document while mounted and
  restores it on unmount, so other pages keep their own.
- **A transparent header's hero clears it by padding, not by margin.** The header takes
  no room, so the hero's own background runs under it; the hero's top padding is the
  bar height plus its usual section step.
- **Decorative motion layers hold only decoration.** `Parallax` is `aria-hidden` and
  `inert`, so a product card with text cannot ride in one; the illustrations beside
  feature rows (`alt=""`) can. Check a motion component's a11y contract before
  choosing where it goes.
- **A component's own `<img>` is not prose's image.** Prose's flow rule (`* + img`
  gets a top margin, and images a radius) matched the picture `Image` places
  absolutely after its placeholder and pushed it down its own box. `Image` now resets
  its pictures' margin and radius (a class beats prose's bare-element selectors), so
  no `data-not-prose` is needed; the page check proves the picture flush.
- **A pinned column paints a surface: name the one it sits on.** `PricingTable`'s
  feature column fills `--r-marketing-pricing-surface`, by default the canvas a
  marketing section sits on; a comparison on a card or band names its own.
- **One locale switch reaches only what reads the locale.** A `LocaleProvider` around
  the page re-formats every library price and figure; the page's own dates and numbers
  must read `useLocale()` too, or the switch looks half-done.
- **A band before a plain footer doubles the edge.** The band draws `border-y` and the
  plain `Footer` its own `border-t`; drop the footer's when a band meets it.
- **A navigation list panel renders its links only once open.** A test collecting a
  page's links opens it first, or the set silently misses them.
- **Section headings are a library part.** Every section after the hero opened with the
  same eyebrow, display heading and lead, eight times on one page; that is
  `SectionHeading` now. A figures row (a value and a label, three times) stayed a page
  composition of `Grid` and `CountUp`: one use, and nothing in it a component would own.
- **Two calls in a closing band read as clutter.** The closing CTA offered the hero's two
  buttons and an email form, the buttons pushed to the band's end above a start-aligned
  form. One action, then the alternative under it in one column, reads in order.
