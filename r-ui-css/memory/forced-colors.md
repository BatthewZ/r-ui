# Forced colors, as Chromium actually renders them

Measured with Playwright's `emulateMedia({ forcedColors: "active" })`.

- **Borders always show.** Translucent and `transparent` border colours are repainted as an opaque
  system colour; that is what makes `border border-transparent` a forced-colors edge.
- **Fills and shadows go.** Backgrounds become Canvas (alpha kept) and `box-shadow` is dropped,
  so a state drawn only by a fill or a shadow ring disappears.
- **An author's system colour is kept, even through `var()`.** A `color-mix()` of one is not: it
  is repainted like any other colour. SVG `fill`/`stroke` are not forced at all.
- **Text gets a Canvas backplate.** Text on a kept system-colour fill (HighlightText on
  Highlight) lands on the plate and vanishes; icons get no plate. So a meaning-bearing fill must
  opt out (`forced-color-adjust: none`) and give its subtree colours chosen for the fill. The
  package does this in companion `@utility` blocks on the fill utilities, re-declaring the
  neutral ink and line roles on the element so descendants inherit fill-appropriate values.
- **Watch for a fill that is itself a role.** `bg-fg-primary` paints `--C-TEXT-PRIMARY`;
  remapping that role inside the fill repainted the fill too.
- **Map every role, then check the mapping is complete.** A new `--C-*` without a forced mapping
  would keep its brand colour inside every opted-out fill; the theme-rule check catches it.
- **Focus is an outline.** A base-layer `!important` beats every later layer, which is the one
  place an `!important` is the contract: `outline-style: solid` on `:focus-visible`.
