# Response dashboard scratchpad

A mockup of the response-ui-css token idea, re-aimed at dashboards. Open `index.html` in a browser; there is no build step or dependency. Use the **View** button to switch scheme, input and density.

| File | What it is |
| --- | --- |
| `tokens.css` | The token system. This is the point of the mockup. |
| `app.css` | Components and layout. Components only read tokens. |
| `app.js` | Seeded fake data and plain-DOM charts. |

## The four axes

The viewport is not one of them.

| Axis | Set by | Drives |
| --- | --- | --- |
| Scheme | OS setting, or `html[data-scheme]` | Every colour, via `light-dark()`: one declaration per token |
| Density | `[data-density]` on **any** element | Spacing, type, row and control height, chart height, bar thickness |
| Input | `@media (pointer: coarse)`, or `html[data-input]` | `--HIT-MIN`, the 44px touch floor |
| Container | The widget's own width | `--KPI-VALUE` (via `cqi`), plus `@container` rules for columns and legends |

The viewport only moves grid areas and picks the sidebar mode (full, rail, or bottom nav). Search `app.css` for `@media (width`: those queries only appear in the Layout section.

## Things worth poking at

- **Axes combine.** Choose Compact + Touch: text shrinks, but rows and controls stay at 44px (`--ROW-H: max(density, hit floor)`). The View panel shows the resolved values.
- **Subtree density.** In devtools, put `data-density="compact"` on just the Services card. Only that card tightens. This works because the derived tokens are re-declared on `[data-density]`. If they were declared on `:root` only, they would inherit already resolved and ignore the card's density.
- **Container sizing.** One `--KPI-VALUE` declaration sizes each KPI by its own tile width. The Services table drops columns based on the card's width, not the screen's.
- **The type scale stays flat.** Body text is 13–14px at every screen width. More room means more columns, not bigger text.
- **Colour roles.** Series colours are for marks only. Status colours are marks paired with an icon and a label. Trend colours are text-safe and keyed to sentiment, so "error rate down" shows green. UI selection uses ink, so it never looks like a data series.
