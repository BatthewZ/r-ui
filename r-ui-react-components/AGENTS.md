# AGENTS — @batthewz/r-ui-react-components

Rules for anyone (human or agent) writing components in this package. Read the family's
`ETHOS.md` (decisions and design principles) and `CLAUDE.md` first; this file is how they
apply here. Each rule is enforced by a gate where one can be written (`bun run check`), and
the gate is named.

## Layout

```
src/
  index.ts                 re-exports every group + hooks + util. Never edited per component.
  styles.css               the CSS aggregator. Never edited per component.
  tokens.css               this package's DOMAIN tokens (series, trend, chart, KPI…)
  floating.css             the top-layer reset for floating panels (shared internal)
  hooks/                   shared hooks (useFloating, useRovingFocus, useVirtualRows…)
  util/                    cn, SlotClassNames, mergeProps/mergeRefs, format*, domainColor, safeUrl,
                           tone (the shared tone vocabulary; internal, not in util/index)
  components/
    primitives/ form/ overlays/ data/ navigation/ layout/
      index.ts             the group's barrel: one `export` line per component
      styles.css           the group's CSS (plain rules, tokens only)
      <Name>.tsx           a component (compound parts in the same file or <Name>/)
      <Name>.test.tsx      its tests
showcase/                  the consumer app (vite): `bun run showcase:dev`
  sections/<group>/<Name>.tsx   one demo section per component (auto-discovered)
  pages/<Page>.tsx              Overview, Dashboard, Marketing, Stress
  registry.ts                   discovers sections/*/*.tsx (never edited per component)
  shell/                        app shell, View panel, router, section collection
scripts/                   the gates (`verify:*`) and their own tests
  browser/                 real-browser checks, run by `bun run browser:check`
```

## Components by group

| Group | Components |
|---|---|
| primitives | `Button`, `IconButton`, `Badge`, `StatusLabel`, `Card`, `Alert`, `Spinner`, `Skeleton`, `Kbd`, `Divider`, `Avatar`, `Link` |
| form | `Field`, `Input`, `Textarea`, `Select`, `SearchInput`, `Checkbox`, `RadioGroup` (+ `Radio`), `Switch`, `SegmentedControl`, `NumberInput` |
| overlays | `Tooltip`, `Popover`, `DropdownMenu`, `Dialog`, `Drawer`, `ToastProvider` + `useToast` |
| data | `Table`, `DataTable`, `VirtualizedTable`, `StatCard`, `Sparkline`, `Meter`, `DescriptionList`, `EmptyState` |
| navigation | `AppShell`, `Tabs`, `Breadcrumbs`, `Pagination`, `NavList` |
| layout | `Stack`, `Inline`, `Grid`, `Container`, `Section`, `Prose` |

Groups build on each other in one direction: `primitives` depends on nothing else here;
`form`, `overlays`, `data` and `navigation` may use `primitives` (and `data` uses `form`'s
`Checkbox`). Import through the group's barrel (`../primitives`). Use what exists before
writing a local copy: a tone's glyph and mark come from `util/tone`, a loading bar is
`Skeleton`, an icon-only control is `IconButton`.

## Adding a component (touch only your group)

1. Write `src/components/<group>/<Name>.tsx` (+ `<Name>.test.tsx`).
2. Add one line to `src/components/<group>/index.ts`: `export { Name, type NameProps } from "./Name";`
3. CSS the utilities cannot express goes in `src/components/<group>/styles.css`.
4. Add `showcase/sections/<group>/<Name>.tsx`:
   ```tsx
   export const meta = { title: "Name", group: "<group>", order: 10, description: "What the demo proves." };
   export default function NameSection() { /* every state, side by side */ }
   ```
   Import the component from `../../../src` (or the group path). The Overview page, its TOC
   and the anchor `#/overview/<group>-<file>` appear automatically.
5. `bun run check`.

You never edit `src/index.ts`, `src/styles.css`, `src/tokens.css`, another group's files,
or the showcase shell. If you think you must, that is a question for whoever owns the
shared file, not an edit.

## CSS: who imports what (decision)

The consumer's CSS entry imports the CSS package FIRST, then this package:

```css
@import "@batthewz/r-ui-css";
@import "@batthewz/r-ui-css/examples/themes/<name>"; /* optional, opt-in */
@import "@batthewz/r-ui-react-components/styles";
```

`src/styles.css` does **not** import `@batthewz/r-ui-css` (same decision as the previous
generation). The consumer owns that import, so the contract compiles once, in the
consumer's Tailwind build, next to the consumer's own `@theme` and theme files; a second
import here would compile the contract twice and let a library choose the app's themes.
What `styles.css` does:

- imports `tokens.css` **unlayered** (it carries `@theme inline`, which must stay in
  Tailwind's theme layer);
- imports `floating.css` and every group's `styles.css` with `layer(components)`, so a
  caller's utility (`className`) beats a component rule at any specificity;
- registers this package's sources with `@source "../src/**/*.{ts,tsx}"` (relative to the
  file, so it works from `src/` and from the published `dist/`).

A group `styles.css` holds plain rules only: no `@theme`, no `@source`, no `@import`
(they cannot live inside a layer). **Never import CSS from a `.ts`/`.tsx`**: the bundler
injects it unlayered and it beats `className` (`verify:no-css-imports`).

## Class names are global: prefix them

Every class or `@keyframes` name a stylesheet defines carries its owner's prefix:
`r-<group>-…` in `src/components/<group>/styles.css` (`r-form-frame`,
`r-navigation-shell-main`, `r-overlays-dialog`), `r-<file>-…` in a shared stylesheet
directly under `src/` (`r-floating-top-layer`). Groups written in parallel invent the same
short names, and a consumer's own `.card` would merge with ours. Utilities and the
contract's classes (`prose`, `hit-area`) are used, never defined, here. Gated by
`verify:class-prefix`. The showcase's own classes are `sc-…` (it is a consumer).

## Tokens only

Components speak the contract's tokens and this package's domain tokens. Nothing else.

| Need | Use | Never |
|---|---|---|
| spacing | `p-r3`, `gap-r4`, `mt-r2` (`--R-SIZE-1..6`, 1 = largest) | `p-4`, `px-3`, `gap-2`, `mt-4` |
| control / row height | `h-control`, `min-h-row`, `size-icon`, `min-h-hit` | `h-8`, `h-9`, `w-9` |
| UI text | `text-body-1..3`, `text-h1..h6` | `text-sm`, `text-xs` |
| colour | `bg-surface-0`, `text-fg-secondary`, `border-border-strong`, `bg-primary`, `text-fg-on-primary`, `bg-status-error-bg` | `bg-blue-500`, `text-white`, `#hex`, `oklch(…)` |
| radius / shadow | `rounded-sm/md/lg/xl/full`, `shadow-sm/md/lg` | bare `rounded`, bare `shadow` |
| data | `bg-series-1..8`, `bg-seq-1..7`, `text-trend-good/bad/flat`, `stroke-chart-grid` | a status colour for "series 4" |

Allowed raw values: `0`, `px` (the 1px hairline), `full`, `auto`, fractions (`w-1/2`),
keywords (`min-h-dvh`), and `var(--TOKEN)` arbitrary values (`h-(--CONTROL-H)`). A raw
px/rem/hex/rgb/oklch literal in a class string, an inline style or component CSS fails
`verify:no-raw-tailwind` (it also scans the showcase). Strings are read with the
TypeScript scanner, so a hoisted constant is caught too; comments never are. If no
token fits, that is a contract question (for `@batthewz/r-ui-css`, or a domain token in
`src/tokens.css`), never an excuse.

The CSS package has no primitive tier: themes write role values directly. So "no
primitives read in components" reduces to "no raw literals", which the gate above
enforces.

## Domain tokens (`src/tokens.css`)

Owned here because their names encode a domain (they fail the contract's
three-criteria test). Current set:

- colours, each a `--C-<NAME>-LIGHT` / `--C-<NAME>-DARK` pair:
  `SERIES-1..8`, `SEQ-1..7` (1 = greatest magnitude), `TREND-GOOD`, `TREND-BAD`,
  `STATUS-SERIOUS` / `TEXT-SERIOUS` / `STATUS-SERIOUS-BG` / `TEXT-ON-SERIOUS`,
  `STATUS-STALE` / `TEXT-STALE` / `STATUS-STALE-BG` / `TEXT-ON-STALE`, `CHART-GRID`,
  `CHART-AXIS`.
  Utilities: `*-series-N`, `*-seq-N`, `*-trend-good|bad|flat`, `*-status-serious(-bg)`,
  `*-fg-serious`, `*-fg-on-serious`, `*-status-stale(-bg)`, `*-fg-stale`, `*-fg-on-stale`,
  `*-chart-grid|axis`. `TEXT-ON-*` is the ink on the mark used as a fill (a solid
  Badge); `verify:domain-contrast` holds it to 4.5:1 on its mark in every theme.
  `trend-flat` aliases the contract's `--C-TEXT-SECONDARY`.
- sizes (density-dependent): `--CHART-H` (`h-chart`), `--BAR-THICK` (`h-bar`/`w-bar`),
  `--HEAT-CELL` (`size-heat-cell`), `--KPI-MIN`, `--KPI-MAX`, and `--KPI-VALUE`
  (`text-kpi`, container-sized with `cqi`).

**How a domain colour follows the theme (`--SCHEME-DARK`).** Every theme declares
`--SCHEME-DARK: 0|1`. A domain colour is blended **at the read**:

```css
color-mix(in oklch, var(--X-LIGHT), var(--X-DARK) calc(var(--SCHEME-DARK) * 100%))
```

That expression is the `@theme inline` value of each utility, so `bg-series-1` evaluates
it at the element that paints. No theme ever has to name a domain token; a theme MAY
override a pair by name to retune it. Never read one half (`var(--C-SERIES-1-DARK)`):
it ignores the scheme (`verify:domain-pairs`). Where a utility cannot reach (an SVG
`stop-color`, an inline style, a chart library), use `domainColor("SERIES-1")` /
`seriesColor(1)` from `src/util/domain-color.ts`.

**How a domain size follows density.** Same pattern as the contract: per-density NAMED
values on `:root` (`--CHART-H-COMFORTABLE`, `--CHART-H-COMPACT`), which a theme may
override; `[data-density]` only SELECTS (`--CHART-H: var(--CHART-H-COMPACT)`). A theme
never writes the selected name. `--KPI-VALUE` is re-declared at every density boundary
and is never `@property`-registered (that would resolve its `cqi` at the declaring element).

Adding a domain token: declare it in `src/tokens.css` (pair, or per-density named values
+ selection), expose it in `@theme inline`, mirror the utility name in
`src/util/style.ts` (`verify:token-mirror`), and for a colour add it to
`DOMAIN_COLORS` in `src/util/domain-color.ts` (a test compares them).

## Authoring rules

- **No density props.** Density comes from `[data-density]` on any ancestor; a compact
  card inside a comfortable page just works because tokens re-derive there. A component
  may pass a `data-density` attribute through to its root (so a caller can scope it),
  never a `density`/`size="compact"` prop that re-implements it.
- **No viewport logic in components.** Adapt to your own width with `@container` and
  `cqi` (`@container` utilities, `@sm:` variants). A `@media (width …)` query never
  appears in a component, and a viewport never redefines a token.
- **Every state is designed**: rest, hover, active, focus-visible (always visible,
  ≥ 3:1; the contract's base gives every focusable element a ring, so don't remove it
  without restoring it), selected, disabled, loading, empty, error, and stale where data
  can age. The showcase section shows them side by side.
- **Hit areas: the contract's `hit-area` utility, never a local copy.** Small-looking
  controls (a label-less checkbox, a switch, a ghost icon button, a breadcrumb link) meet
  `--HIT-MIN` with `hit-area` (an invisible, centred `::before` behind the control's own
  content); never by growing the visual. Controls that are `h-control`/`min-h-row` already
  meet it (both are `max(density, --HIT-MIN)`). Overlapping hit areas resolve by paint
  order: siblings in a row are handled by the utility, but anything that stacks (a list of
  checkboxes) must be a floor apart instead. A labelled check row is its own target and is
  padded to `--HIT-MIN` tall, so its box needs no pseudo-element.
- **One quiet wash.** Hover on a chrome-less control (ghost button, menu item, page
  number, nav link, breadcrumb, stepper, segment) is the primary ink at 8% (pressed 12%):
  `hover:bg-fg-primary/8`, or `color-mix(in oklab, var(--C-TEXT-PRIMARY) 8%, transparent)`
  in CSS. A surface rung reads as a hole on a dark theme's raised card.
- **Floating panels render in place, promoted to the top layer. Never portal.** Use
  `useFloating` (`src/hooks/use-floating.ts`): render the panel as a DOM sibling of its
  trigger, spread `floatingStyles`, and the hook gives it `popover="manual"` and
  `showPopover()`. It escapes every clip and stacking context, yet inherits custom
  properties (density!) from where it is written. `FloatingPortal` is deliberately not
  re-exported; portalling to `<body>` would make a dropdown inside a compact card render
  comfortable. Pass `open` if the panel stays mounted while closed. While the anchor is
  scrolled out of view the hook sets `data-reference-hidden` and `src/floating.css` hides
  the panel (it stays mounted and comes back with the anchor).
- **Compound components** for anything with parts (`Menu`, `Menu.Trigger`, `Menu.Item`),
  sharing state through context; consistent prop names (`size`, `variant`, `tone`) across
  the library; forward refs (React 19: `ref` is a prop).
- **Slots.** `className` styles the root; `classNames?: SlotClassNames<"label" | "icon">`
  styles named internals (inline union, so unknown keys are type errors). Merge with
  `cn()` from `src/util/style.ts`, root last: `cn(base, className)`.
- **Data**: numbers through `src/util/format.ts` (`formatNumber`, `formatCompact`,
  `formatPercent`, `formatUnit`, `formatDelta`, `formatBytes`); missing renders "—"
  (`MISSING`), never "NaN" or "0". Tabular figures come from the base. Series colours by
  entity, in fixed order, never cycled; a 9th series folds into "Other"; a line that sums
  them is the primary ink (`Sparkline series="total"`), never a series colour. Status colour is
  always paired with an icon and a label. Trend colour is keyed to sentiment, not direction.
- **Content never widens its box.** Every text slot that can receive a caller's string breaks
  an unbroken word (`break-words` + `min-w-0` in a bounded track, `[overflow-wrap:anywhere]`
  where the track is sized by content: a list term, a KPI value). A slot that sits beside
  another (card actions beside the title) is `min-w-0 max-w-full` and wraps under it when it
  does not fit, rather than squeezing it. Tables choose per cell: `truncate` (default, one
  line, full value in `title`), `truncate={false}` (one line at content width) or `wrap`
  (several lines; never in `VirtualizedTable`). The Stress page's extremes panel holds a case
  for each, and `stress-matrix.js` fails on any spill.
- **UI inside prose stays UI**: a button in a prose region still uses `h-control` and UI
  text, never prose leading.
- **A landmark can be demoted.** A part that renders a landmark a host page may already own
  takes `as` (`AppShell.Main as="div"` inside a page with its own `<main>`).
- **Accessibility is design**: names for icon-only controls, keyboard paths
  (`useRovingFocus` for composite widgets), logical properties (`ps-`, `me-`,
  `inset-inline-*`) for RTL, `prefers-reduced-motion` handled by the contract's motion
  tokens (use them; never hard-code durations).
- **Never suppress** a TypeScript or ESLint error (`noInlineConfig` is on). Fix it.

## The gates (`bun run check`)

| Script | Asserts |
|---|---|
| `verify:no-css-imports` | no `.ts`/`.tsx` under `src/` imports CSS |
| `verify:no-raw-tailwind` | no Tailwind defaults / raw literals in `src/components/**` or `showcase/**` (fixture test proves it goes red) |
| `verify:utilities-exist` | every class written in a class context under `src/` and `showcase/` generates CSS in the real Tailwind build. The CSS package removes Tailwind's colour, text-size, radius, shadow, weight, leading, tracking and easing scales, so `font-bold`, `leading-tight` or `bg-gray-100` compile to nothing; a plain class (`sc-shell`) must exist in the compiled CSS, and `bg-${tone}` fragments are reported. A name ending in `class(es)`/`className(s)` makes a string a class list; an array or object under such a name counts as one only where some file uses it as classes (`ERROR_CLASSES` may list kinds of error), and is still checked for dead utilities otherwise (fixture test proves both directions) |
| `verify:domain-pairs` | every domain colour has LIGHT and DARK, is exposed only through the blend, and no source reads one half |
| `verify:series-palette` | series 1–8 stay distinct in both schemes: lightness band, chroma floor, adjacent ΔE ≥ 15 normal / ≥ 6 protan+deutan, first three all-pairs; plus any theme that overrides a pair |
| `verify:domain-contrast` | domain text ≥ 4.5:1 and domain status marks ≥ 3:1 on canvas + surfaces 0–3, in every theme the CSS package ships (discovered, never named) |
| `verify:token-mirror` | every `@theme` name in `src/tokens.css` is mirrored in `cn`, both directions |
| `verify:class-prefix` | every class and keyframes name defined in `src/**/*.css` carries its owner's prefix (fixture test proves it goes red) |
| `typecheck`, `lint`, `test` | tsc strict (+ `noUncheckedIndexedAccess`), eslint (narrow, no suppressions), vitest (jsdom) |

The showcase is the Playwright target: `bun run showcase:dev`, then drive it. The View
panel sets `data-theme`/`data-density`/`data-input` on `<html>` and shows the resolved
`--CONTROL-H`, `--ROW-H`, `--HIT-MIN`, `--R-SIZE-3`, `--BodyText-1`. Each section renders
behind its own error boundary (`[data-section-error]` when tripped), so one broken demo
never blanks the page.

## Browser checks (`bun run browser:check`)

What jsdom cannot see (layout, hit testing, the top layer, CSS) is settled in a real
browser by `scripts/browser/*.js`. `bun run browser:check` starts the showcase on a free
port, opens one `playwright-cli` session, runs every script with `run-code` (a script
throws to fail and returns a summary to pass), then closes the session and stops the
server. `bun run browser:check <name>` runs the scripts whose file name contains `<name>`.
It needs a browser (`playwright-cli install-browser`) and is not part of `check`.

| Script | Asserts |
|---|---|
| `data-virtualized-rows.js` | 10,000 rows: a row is exactly `--ROW-H`, scroll height = rows × row height + head, the last row mounts at the end, and a live input switch and a stylesheet that retunes `--ROW-H-COMPACT` (no attribute moves) both re-measure |
| `hit-areas.js` | at coarse input a lone IconButton answers outside its box, a dense toolbar never hands a press on one button to its neighbour, a checkbox's own box takes the press, stacked labelled checkboxes are a floor apart; at fine input nothing grows |
| `floating-hide.js` | an open Popover hides while its trigger is scrolled out of view and comes back anchored |
| `overview-matrix.js` | the whole Overview in 3 themes × 2 densities × fine/coarse × 1280/375: no console or page error, no tripped section boundary, no horizontal scroll in the page or in any demo |
| `dashboard-layout.js` | the Dashboard on every axis at 1440/375 without errors or sideways scroll; full sidebar / rail / bottom nav at 1440 / 900 / 375; KPI tiles in one row at 1440; rows exactly the page's and the compact card's `--ROW-H`; empty search and a toast work |
| `marketing-page.js` | UI inside prose stays at `--CONTROL-H` and UI type on every axis; display type grows monotonically with no step at 640; no sideways scroll at 375, pricing table included |
| `stress-matrix.js` | the Stress page in 3 themes × 2 densities × fine/coarse × 1280/375: no error, no tripped panel, no sideways scroll, and no element whose child box or text line reaches past its own edges; every `KnownBug` repro listed in `KNOWN_BUGS` still reproduces (empty today) |
| `stress-density.js` | density re-derives at every nested boundary, both ways; menu, popover, tooltip and select opened in a clipping compact card are compact, in the top layer, unclipped and hit-testable |
| `stress-virtualized.js` | a 10,000-row table whose own density flips mid-scroll shows exactly the rows its scroll position predicts, both ways |
| `stress-contrast.js` | every visible text element on the Stress page, as painted (tints and washes composited), reads at 4.5:1 or better in the dark example theme, menus and toasts open |

A new script is an `async (page) => { … }` expression that starts from `page.url()`, sets
the View through `localStorage["r-ui-showcase:view"]`, validates its harness against one
value it can predict from source, and cleans up the stored View.

## Testing

Integration over mocks: render the real component, drive it with
`@testing-library/user-event`, assert what a user perceives (roles, names, focus). Never
`|| true` in an assertion and never an assertion behind an `if`. jsdom computes no
layout and loads no CSS; anything about size, colour or paint is a Playwright check
against the showcase, not a vitest test.
