# Print: what the browser does to a page on paper

- **A theme beats `:root`, so print must be `!important`, and themes must never be.** The same
  mechanism as reduced motion and forced colors; a theme's own `!important` would silently
  outrank all of them, so the theme-rule check forbids it.
- **Backgrounds drop, text colours stay.** Unless the reader asks, Chromium prints no
  background colour or image. A dark theme printed as designed is light ink on white. A fill
  that carries its own `on-*` ink (primary button, solid status badge, selected row) loses
  the fill and keeps light ink, so those fills opt into `print-color-adjust: exact` (same-name
  `@utility` companions, like the forced-colors ones). Opt in only where colour is data or
  carries text; `print-color-adjust` is inherited.
- **Transitions outrank `!important`.** Switching to print restyles everything at once, and
  any property with a transition (a disclosure's grid track, a button's colours) is caught at
  its screen value. In a `content-visibility: auto` subtree it may never advance. Print turns
  `transition` off; animations stay, because an animation's fill can be what shows content.
- **A shadow token cannot be `none`.** Shadow utilities list the token with other shadows,
  where `none` is invalid; a flat shadow is `0 0 transparent`.
- **`emulateMedia({ media: "print" })` is not printing.** It applies print styles to the
  screen renderer; Blink's own darkening of light text when backgrounds are dropped does not
  run. Measure computed colours against what would print behind them, then confirm with
  `page.pdf()`.
- **A preview toggle can flip the real rules.** Rewriting each `@media print` rule's
  `media.mediaText` to `all` (and `not print` to `not all`) through the CSSOM previews the
  shipped rules without a second copy of them.
