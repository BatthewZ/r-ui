# Theming the showcase as a consumer

Lessons from reskinning the showcase with a set of its own themes (light and dark, sans,
serif, mono and display faces, border-led and glow-led depth, denser and roomier densities).

- **A theme the showcase wants to try belongs to the showcase.** The CSS package's examples
  ship; a trial theme is a consumer's file. Listed in the showcase's theme list, it is run on
  every axis by the browser checks for free, because they iterate the listed themes. The
  price is wall clock: every listed theme multiplies the sweeps.
- **An exemption needs a replacement gate.** A theme file is raw values by design, so the
  raw-value gate skips the showcase's themes, and `verify:showcase-themes` holds them to what
  a shipped theme meets instead: the contract's contrast and theme rules, this package's
  domain contrast and series palette. Without it, a theme rots silently as tokens move.
- **A tinted, deeper light ramp tightens every mark, including the domain ones.** A sand ramp
  whose deepest rung sat a few hundredths below the default's passed the contract and still
  dropped the library's serious mark under 3:1. Lift the rung (hold its hue) before
  overriding a domain token: the override fixes one pair, the rung fixes the ramp.
- **The warning trap follows the ramp.** The darker warning mark a deeper rung demands
  starves the default dark on-ink; darken the on-ink with it.
- **A face's default figures leak into data.** Some humanist faces default to old-style
  figures, and `tabular-nums` alone keeps them old-style. Name `lining-nums` in the data
  numerals; keep old-style for prose if the voice wants it.
- **Only faces something renders download.** A display face reads as unloaded on a page with
  no display text. Check faces on a page that paints every role.
- **Clip chroma, not lightness.** Vivid magenta, violet and teal leave sRGB easily at mid
  lightness. Pull chroma to the gamut edge at the same L and H, so contrast stays where it
  was measured.
- **A theme's faces and densities move findings, not just looks.** A narrow face put a
  short-labelled Checkbox under the coarse floor, and a wide one a narrow table column's
  filter, both already-known findings in new places. A compact denser than the default's
  let coarse hit areas at a scroller's or frame's edge (a table cell's preview toggle, a
  marquee's pause button) overhang into it: those components rely on their container's
  padding, which a theme may shrink.
- **A long theme list breaks the demos that draw every theme.** Segments are all visible, so
  a segmented switcher demo takes a handful of themes and the select takes them all.
- **A theme's normal duration races the demos' own timers.** Simulated progress ticking
  every 300ms leaves the page still between ticks only while its transitions are shorter:
  past about 200ms the sweeps' "settled" wait never comes. Keep long motion on the slow
  tier (dialogs, sheets), where a theme's weight reads anyway.
- **Move status away from the brand, never the meaning.** A brand next to a status hue (gold
  beside warning, rust beside error) moves the status hue (warning to orange, error to
  crimson); the role keeps its meaning.
