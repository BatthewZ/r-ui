# Colour: lessons (round 3, c6 — ColorPicker)

- **Edit in OKLCH, keep the value inside sRGB.** The area is lightness × chroma at one hue,
  so "lighter" is one axis and contrast moves with it. Every value (hex or `oklch()`) names
  an sRGB colour: chroma is lowered at constant lightness and hue, and the chroma the user
  asked for is remembered, so sweeping the hue through a narrow gamut (cyan) and back gives
  it back. A note says when what is shown is less than what was asked.
- **Round `oklch()` chroma down, not to nearest.** A colour on the gamut's edge, written to
  three places and rounded up, parses back a hair outside and flickers the "outside sRGB"
  note for a value the picker itself produced. Floor the chroma, and judge "outside" with a
  small tolerance.
- **Believe the last edit only while it still formats to the value.** Hex cannot carry a
  grey's hue or an out-of-gamut request; keeping the edit as state and trusting it while
  `format(edit) === value` keeps both, and any value that moved for another reason (a
  parent, the form, a reset) wins outright. The old library's HSV memory did the same.
- **Spectra are data, not styling.** Gradient stops and the area's pixels are computed from
  the colour maths at runtime (a canvas for the area, `rgb()` strings for tracks), never
  colour literals; the parts a theme should own (hatch, checkerboard, rings) read tokens.
  A brand palette in the showcase is user data and sits in an `.examples.` file, which the
  token gates skip.
- **A canvas paints its out-of-gamut pixels clear** and the element behind it draws a hatch
  from tokens: the gamut's edge is visible in every theme with no colour chosen for it.
  jsdom has no `CanvasRenderingContext2D`: guard on it, and test the painter as a pure
  function over a pixel array.
- **A thumb that must be `position: absolute` cannot carry `hit-area`** (the utility sets
  `position: relative` and wins over component CSS). Put `hit-area` on an inner span that
  fills the thumb.
- **`aria-labelledby="<label> <value>"`** names a popup trigger with its value; an element
  hidden itself gets no computed name in Testing Library, so query a promoted (jsdom-hidden)
  dialog by role and read its `aria-label` attribute.
- **A theme colour for a readout is resolved where the control renders**: a hidden probe
  with `color: var(--C-SURFACE-0)` and `getComputedStyle`, re-read when `<html>`'s
  attributes change (a theme switch).
