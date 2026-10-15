# Measuring and tuning colour pairs

- **Measure, don't estimate.** OKLCH -> OKLab -> linear sRGB -> relative luminance -> WCAG
  ratio. Before trusting the script, reproduce known figures (white/black 21, #767676 on white
  4.54, #0000ff on white 8.59); the tests do.
- **Stay inside sRGB.** At very high or very low lightness the available chroma is tiny (a
  near-white has room for about 0.003). Out-of-gamut colours render per engine, so the check
  measures both clipping and chroma reduction and keeps the worse ratio, and flags them.
- **Move lightness, keep hue and chroma** so a theme still reads as itself.
- **Mark and fill at once is the hard constraint.** A role that is drawn on surfaces (>= 3:1)
  and also filled under text (>= 4.5:1) is forced deep on a light theme. That is why accent
  text and status text have their own tokens, and why a vivid accent ends up a deep vivid hue.
- **Warning is the tightest status**: an amber mark at 3:1 on the lightest recessed rung sits
  right at the limit for dark on-text. Tune the mark and its on-text together.
- **Dark themes are designed, not inverted**: surfaces still run 0 lightest -> 3 darkest, text
  is lifted rather than pure white, and the on-text of light fills inverts to dark ink.
- **A partial theme can pass every pair and still be broken.** A dark scheme that inherits
  light colours measures fine, so the check also requires text to sit on the correct side of
  the canvas for the declared scheme.
- **Examples are a regression corpus, not the contract.** A green table across them says
  nothing about a consumer's theme; the rule in the theme contract is what counts.
