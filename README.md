# r-ui

Workspace for the r-ui design-system family: four packages in one bun workspace. Read
[ETHOS.md](ETHOS.md) for the decisions behind them and [CLAUDE.md](CLAUDE.md) for the
working rules.

| Package | What it is |
| --- | --- |
| [`r-ui-css/`](r-ui-css/) | `@batthewz/r-ui-css`: the token contract (colour, surfaces, type, spacing, shape, depth, motion), the four sizing axes and three example themes, as Tailwind v4 CSS. Zero JavaScript. |
| [`r-ui-tw-merge/`](r-ui-tw-merge/) | `@batthewz/r-ui-tw-merge`: `cn()`, a tailwind-merge that knows the r-ui-css utility names. Zero CSS. |
| [`r-ui-react-components/`](r-ui-react-components/) | `@batthewz/r-ui-react-components`: React 19 components on the two packages above (primitives, form, overlays, data, navigation, layout), the domain tokens a dashboard needs, and the showcase app. |
| [`r-ui-renderer/`](r-ui-renderer/) | `@batthewz/r-ui-renderer`: renders JSON ViewSpec documents (written by a model, a CMS or a backend) as the library's components, while they stream; validates them without React, on a server or from the `r-ui-validate` CLI; and ships the model-facing reference and the playground app. |

Dependencies run one way: `r-ui-css + r-ui-tw-merge → r-ui-react-components → r-ui-renderer`.

```sh
bun install
bun run check   # every package's gates (r-ui-react-components' includes typecheck, lint and tests)
bun run test    # every package's tests
```

## Releasing

Each package versions on its own (the bump rule is in [CLAUDE.md](CLAUDE.md)). To release,
bump the `version` in the package's `package.json`, record it in its `CHANGELOG.md`, commit
and push, then:

```sh
npm login             # once per machine, or when the token expires
bun run release       # publishes every package whose version is not on npm yet
```

The script skips packages whose version is already published, runs each remaining package's
`check` and tests, and publishes in dependency order. It tags each release `<folder>@<version>`
and pushes the tags. `bun run release --dry-run` rehearses all of it without publishing.

## The showcase

```sh
cd r-ui-react-components
bun run showcase:dev    # open the printed URL
bun run browser:check   # every real-browser check against a fresh showcase (needs playwright-cli)
```

Four pages, switched from the top bar, each viewable in any theme (the default and the CSS
package's examples, nightfall, harbour and atelier, plus the showcase's own reskins in
`r-ui-react-components/showcase/themes/`), density and input from the **View** panel:

- **Overview**: every component, every state, one section each.
- **Dashboard**: an operations dashboard built from library components only, in an `AppShell`
  that picks full sidebar, icon rail or bottom nav by viewport.
- **Marketing**: a landing page on the fluid display and section scales, with ordinary UI
  components inside it at UI scale.
- **Stress**: hostile cases: nested density boundaries, floating panels from a clipping card,
  10,000 virtualized rows, extreme and translated content, right-to-left.

## The renderer's playground

```sh
cd r-ui-renderer
bun run playground:dev   # open the printed URL
```

An editor with a live preview and an issue panel, a streaming replay that feeds an example
document through the parser at a chosen rate, and a **View** panel for theme, density and
input. The example documents (an operations dashboard, an analytics overview, an incident
report, a settings form, a team directory, release notes, a marketing page) are in
`r-ui-renderer/src/examples/`.

## mockup/

The original scratchpad: a mockup of the response-ui-css token idea, re-aimed at dashboards. It seeded the r-ui-css design and is kept as reference only. Open `mockup/index.html` in a browser; there is no build step or dependency. Use the **View** button to switch scheme, input and density.

| File | What it is |
| --- | --- |
| `mockup/tokens.css` | The token system. This is the point of the mockup. |
| `mockup/app.css` | Components and layout. Components only read tokens. |
| `mockup/app.js` | Seeded fake data and plain-DOM charts. |

### The four axes

The viewport is not one of them.

| Axis | Set by | Drives |
| --- | --- | --- |
| Scheme | OS setting, or `html[data-scheme]` | Every colour, via `light-dark()`: one declaration per token |
| Density | `[data-density]` on **any** element | Spacing, type, row and control height, chart height, bar thickness |
| Input | `@media (pointer: coarse)`, or `html[data-input]` | `--HIT-MIN`, the 44px touch floor |
| Container | The widget's own width | `--KPI-VALUE` (via `cqi`), plus `@container` rules for columns and legends |

The viewport only moves grid areas and picks the sidebar mode (full, rail, or bottom nav). Search `mockup/app.css` for `@media (width`: those queries only appear in the Layout section.

### Things worth poking at

- **Axes combine.** Choose Compact + Touch: text shrinks, but rows and controls stay at 44px (`--ROW-H: max(density, hit floor)`). The View panel shows the resolved values.
- **Subtree density.** In devtools, put `data-density="compact"` on just the Services card. Only that card tightens. This works because the derived tokens are re-declared on `[data-density]`. If they were declared on `:root` only, they would inherit already resolved and ignore the card's density.
- **Container sizing.** One `--KPI-VALUE` declaration sizes each KPI by its own tile width. The Services table drops columns based on the card's width, not the screen's.
- **The type scale stays flat.** Body text is 13–14px at every screen width. More room means more columns, not bigger text.
- **Colour roles.** Series colours are for marks only. Status colours are marks paired with an icon and a label. Trend colours are text-safe and keyed to sentiment, so "error rate down" shows green. UI selection uses ink, so it never looks like a data series.
