# Forced colors in the components (batch B, b6)

How the existing components were made to read under Windows High Contrast, and what a new
component must do. The contract's four rules (r-ui-css AGENTS.md) still apply; these are
the cases they did not cover on their own.

- **Computed styles are the forced values.** Under `emulateMedia({ forcedColors: "active" })`
  `getComputedStyle` reports what is painted: a wash reads as Canvas with the author's alpha,
  a dropped shadow as nothing. So "on differs from off" is testable, but compare fills with
  Canvas folded to "no fill", or a Canvas-at-8% hover counts as a highlight.
- **Gradients are dropped too, not only shadows.** A `background-image` gradient vanishes
  unless its element opts out. Draw a marker as a pseudo-element with its own opt-out, so
  nothing else in the cell is taken out of repainting.
- **A line role used as a fill is a trap.** `--C-BORDER-STRONG` is CanvasText under forced
  colors and a system colour is kept, so a switch track filled with it became a black pill
  that swallowed its CanvasText thumb. Fill with Canvas there, and look for every other
  place a border or text role is used as a background.
- **A plain `background: var(--C-PRIMARY)` (or `--C-TEXT-PRIMARY`) keeps its fill but loses
  its text**: the browser plates text in Canvas. Only the contract's `bg-` utilities opt out
  by themselves; a stylesheet fill needs `forced-color-adjust: none` (rail bubble, badges,
  skip link, brand mark).
- **Selection is a Highlight fill, and focus on it needs another colour.** A ring in
  `--C-FOCUS` (Highlight) inset on a Highlight fill is invisible. Inside a selected fill the
  ring turns HighlightText and sits one ring-width further in, leaving a band of fill around
  it. The contract's fill companions remap the status text roles inside the fill and
  `--C-FOCUS` for its descendants (a destructive menu item and a control in a selected row
  read with no local rule); a ring drawn inside the element's OWN fill is still the
  component's to recolour, since the contract cannot know a ring is inset.
- **Invalid loses its red, so it gets a second cue**: a doubled edge, beside the message.
- **Keep normal rendering byte-identical.** Every fix sits behind `forced-colors:` or the
  media query; screenshot diffs outside forced colors showed only animation frames.
- Enforced by the `forced-colors-states` browser check (on/off pairs, edges, focus rings,
  the rail and the bottom nav).
