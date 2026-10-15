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
  print.css                how components print, by the classes and attributes they render
  hooks/                   shared hooks (useFloating, useRovingFocus, useVirtualRows, useRowHeight…)
  util/                    cn, SlotClassNames, mergeProps/mergeRefs, format*, domainColor, safeUrl,
                           tone (the shared tone vocabulary and its class tables),
                           labels (the `labels` prop merge), children (element children,
                           fragments flattened), error-line (the error message look) and
                           text-match (folding, matching, MatchText); the last five internal,
                           not in util/index. util/preferences is also
                           the `./theme-script` subpath, imported by build tools: it stays
                           free of React and of any import
  components/
    primitives/ form/ overlays/ commands/ data/ navigation/ layout/ preferences/ motion/
    disclosure/ charts/ content/ dates/ steps/ marketing/
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
| form | `Field`, `Input`, `Textarea`, `Select`, `SearchInput`, `Checkbox`, `RadioGroup` (+ `Radio`), `Switch`, `SegmentedControl`, `NumberInput`, `Combobox`, `MultiSelect`, `TagInput`, `FileUpload`, `OTPInput`, `ColorPicker`; form state: `useForm` + `Form`, `useFieldArray`, `useFormState`, `useFormValue`, `ErrorSummary`, `FormActions`; for custom controls: `useFieldValue`, `useFieldInputProps`, `useFieldMessage` |
| overlays | `Tooltip`, `Popover`, `DropdownMenu`, `ContextMenu` (one shared menu, `menu-internals`), `Dialog`, `Drawer`, `ToastProvider` + `useToast` |
| commands | `CommandPalette` + `useCommandPaletteShortcut` |
| data | `Table`, `DataTable`, `VirtualizedTable`, `StatCard`, `Sparkline`, `Meter`, `DescriptionList`, `EmptyState`, `Timeline` (+ `ActivityFeed` preset) |
| navigation | `AppShell`, `Tabs`, `Breadcrumbs`, `Pagination`, `NavList`, `RouterProvider` |
| layout | `Stack`, `Inline`, `Grid`, `Container`, `Section`, `Prose` |
| preferences | `ThemeSwitcher`, `DensitySwitcher`, `InputSwitcher`, `PreferencesMenu`, `ThemeScript` |
| motion | `ScrollReveal`, `Stagger`, `startViewTransition` / `useViewTransition` |
| disclosure | `Collapsible`, `Accordion` |
| charts | `LineChart`, `BarChart`, `Heatmap` |
| content | `CopyButton`, `CodeBlock`, `Markdown` |
| dates | `Calendar`, `RangeCalendar`, `DatePicker`, `DateRangePicker` |
| steps | `Stepper`, `Wizard` |
| marketing | `Hero`, `MediaCard`, `Carousel` |

Groups build on each other in one direction, and `verify:group-deps` fails on any cycle in
the import graph between groups (and `hooks`, `util`, which import no group):

| Group | May use |
|---|---|
| primitives, layout, motion | nothing else here (hooks and util only) |
| overlays, navigation, disclosure | `primitives` |
| form | `primitives`, `overlays` (ColorPicker's Popover; the selection listbox's exit helpers) |
| data | `primitives`, `form` (DataTable's `Checkbox`), `overlays` (Timeline's Tooltip) |
| charts, content | `primitives`, `data` (`Table`, the series slots); charts also `overlays/internal` |
| dates, preferences | `primitives`, `form`, `overlays` |
| steps | `primitives`, `form` (the Wizard runs on `useForm`) |
| marketing | `primitives`, `layout` |
| commands | `primitives`, `form`, `overlays`; nothing imports it |

So `overlays` never imports `form`: a component that needs both sits in a group above them
(that is why `CommandPalette` is its own `commands` group), and logic two groups share moves
down to `util` (`util/text-match`: folding, matching and the bold match highlight).
Floating panels outside `overlays` (the selection listbox, the chart tooltip) take the
exit-animation helpers from `overlays/internal`, the one deep import allowed. Otherwise
import through the group's barrel (`../primitives`). Use what
exists before writing a local copy: a tone's glyph and mark come from `util/tone`, an error
message's look from `util/error-line`, a loading bar is `Skeleton`, an icon-only control is
`IconButton`, a row-height probe is `useRowHeight`.

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
   and the anchor `#/overview/<group>-<file>` appear automatically (each section is its own
   lazy chunk). A demo element that is designed to scroll sideways (a wide table, a code
   block's lines) carries `data-sc-scrolls`, or `overview-matrix` reports it as a spill.
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
- imports `floating.css`, every group's `styles.css` and `print.css` with
  `layer(components)`, so a caller's utility (`className`) beats a component rule at any
  specificity;
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
| lines | bare `border` / `border-b` / `divide-y`; in CSS `var(--BORDER-WIDTH) solid …` | `border-2`, `border: 1px solid …` |
| stacking | `z-raised` (sticky table head), `z-sticky` (sticky header), `z-docked` (bottom nav, fixed bars), `z-bypass` (skip link); in CSS `var(--LAYER-*)`; floating panels use the top layer | `z-10`, `z-index: 2` |
| data | `bg-series-1..8`, `bg-seq-1..7`, `text-trend-good/bad/flat`, `stroke-chart-grid` | a status colour for "series 4" |

Allowed raw values: `0`, `px` (the 1px hairline), `full`, `auto`, fractions (`w-1/2`),
keywords (`min-h-dvh`), `var(--TOKEN)` arbitrary values (`h-(--CONTROL-H)`), and the few
lengths that name a unit rather than a size: `1em`, `1lh`, `1ch` (either sign), `100dvh`,
and `100cqi` (a part sized as a ratio of its container: `calc(100cqi * 0.38)`). Any other
length in any unit (`px`, `rem`, `em`, `ch`, `lh`, `vw`, `vh`, `cqi`…), a hex/rgb/oklch
literal, in a class string, an inline style or a stylesheet anywhere under `src/` or in the
showcase, fails `verify:no-raw-tailwind`, and so does a numeric z-index or a line (border,
outline, box-shadow, a `shadow-[inset…]` utility) drawn at a fixed `1px` instead of the
theme's `--BORDER-WIDTH`. A floating panel's width cap is `.r-overlays-surface`'s (a panel
that is wider by design sets `--r-overlays-measure`), never its own `100vw`. Strings are read with the
TypeScript scanner, so a hoisted constant is caught too; comments never are. If no
token fits, that is a contract question (for `@batthewz/r-ui-css`, or a domain token in
`src/tokens.css`), never an excuse.

One exemption: a showcase file named `*.examples.*` holds a consumer's DATA (the brand
palette a ColorPicker demo offers: values the user picks and the form submits, painted by
no class or stylesheet), and the token gates skip it. The exemption stops at the showcase:
under `src/` an `.examples.` file is scanned like any other.

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
  `CHART-AXIS`, `CODE-KEYWORD` / `CODE-STRING` / `CODE-NUMBER` / `CODE-FUNCTION` / `CODE-TYPE`.
  Utilities: `*-series-N`, `*-seq-N`, `*-trend-good|bad|flat`, `*-status-serious(-bg)`,
  `*-fg-serious`, `*-fg-on-serious`, `*-status-stale(-bg)`, `*-fg-stale`, `*-fg-on-stale`,
  `*-chart-grid|axis`, `text-code-keyword|string|number|function|type`, plus
  `text-code-comment|property|addition|deletion` (aliases of the contract's muted, secondary,
  success and error text roles). `TEXT-ON-*` is the ink on the mark used as a fill (a solid
  Badge); `verify:domain-contrast` holds it to 4.5:1 on its mark in every theme.
  `trend-flat` aliases the contract's `--C-TEXT-SECONDARY`.
- forced colors (Windows High Contrast) follow the contract's four rules. Status, trend
  and chart chrome map both halves of each pair to a system colour; the series and
  sequential palettes keep their colours (the colour is the information, and a series is
  also labelled), and their `bg-` fills opt out of repainting through same-name `@utility`
  companions, as `bg-status-serious` / `-stale` do; their blend follows the forced
  palette's scheme, because the contract sets `--SCHEME-DARK` from it there. The code
  colours become CanvasText (weight and slant carry keyword and comment). A new pair needs
  one or the other (`verify:domain-pairs`).
- sizes (density-dependent): `--CHART-H` (`h-chart`), `--BAR-THICK` (`h-bar`/`w-bar`),
  `--HEAT-CELL` (`size-heat-cell`), `--SPARK-H` (`h-spark`), `--KPI-MIN`, `--KPI-MAX`,
  and `--KPI-VALUE` (`text-kpi`, container-sized with `cqi`).

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
must not write the selected name (`--CHART-H`): its selector outranks `[data-density]` on
`<html>`, so the page would lose its density. The CSS package's theme-rules check knows only
the contract's names; for domain sizes `verify:domain-contrast` holds it, for the shipped
themes and for a consumer's (`--theme`). `--KPI-VALUE` is
re-declared at every density boundary and is never `@property`-registered (that would resolve its `cqi` at the declaring element).

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
  `cn()` from `src/util/style.ts`, root last: `cn(base, className)`. `className` is
  always the root, even when the interesting part is a trigger or an input; there is no
  `root` slot, and inner parts are slots (`trigger`, `input`, `panel`).
- **Translatable strings: one `labels` prop.** A component with words of its own takes
  `labels?: LabelsProp<XLabels>` and exports `DEFAULT_X_LABELS`, merged with `mergeLabels`
  from `src/util/labels.ts` (a map-valued label such as the tone words merges key by key;
  `undefined` keeps the default). No loose `closeLabel` / `clearLabel` / `messages` props.
  Tone words come from `TONE_LABELS` in `util/tone`, unpunctuated (a component adds its
  own `": "`). A per-instance accessible name is the caller's `aria-label`, spread after
  the default.
- **Destructive is `variant="danger"`** on `Button`, `IconButton` and menu items, never a
  tone (`tone` means status).
- **Popup controls are controllable**: `open` / `defaultOpen` / `onOpenChange` through
  `useControllableState`, with what opening or closing does (a draft reset) keyed to the
  observed change, so a parent's `open` runs it too.
- **Disabled items and the keyboard (decision).** Menu items and commands (`DropdownMenu`,
  `ContextMenu`, `CommandPalette`) stay focusable with `aria-disabled`: arrows land on
  them and activation does nothing (APG menu). Listbox options (`Combobox`,
  `MultiSelect`) are skipped: the input keeps focus and `aria-activedescendant` never
  names a disabled option. Disabled tabs are skipped. `useRovingFocus` passes over
  natively `disabled` items (they cannot take focus) and keeps `aria-disabled` ones in
  the walk, so a widget that wants an inert item discoverable uses `aria-disabled`.
- **Descendant ids come from the item's key**, never its (filtered) index.
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
- **Internal links go through the router config.** A part that renders an internal link
  resolves its element with `useLinkElement` and its current state with `useIsCurrent`
  (`src/util/router.tsx`), so one `RouterProvider` reaches it; an explicit `as` / `current`
  still wins. Never hard-code `<a>` for an internal `href`.
- **A form control binds through `Field`.** Inside `<Field name="…">` in a `Form`, the
  control reads and writes the form's value: a value-based control takes `useFieldValue`
  (the `useControllableState` contract plus the form, and the native `name`), a native text
  control spreads `useFieldInputProps(props)`, and a control that renders its own message
  (a picker's "not a date") registers it with `useFieldMessage` and names it in its own
  `aria-describedby` too. A caller-controlled `value` is left alone. Every control also
  takes id, description, error, `aria-invalid`, `required` and `disabled` from `useFieldControl`.
- **Dates are calendar dates, not instants.** A date value is a `Date` at local midnight,
  read only through local getters; the wire format (`name` submission, `toISODate`) is
  `YYYY-MM-DD` built from those getters, never `toISOString()` (it moves a local midnight to
  the previous day west of Greenwich). A preset may still return instants; its id travels
  with the value.
- **A reset outline is zeroed, not just `none`.** The contract forces `outline-style: solid`
  on `:focus-visible` under forced colours, which revives `outline: none` as a second ring;
  an inner part whose frame draws the ring writes `outline: 0 none`.
- **A landmark can be demoted.** A part that renders a landmark a host page may already own
  takes `as` (`AppShell.Main as="div"` inside a page with its own `<main>`).
- **Accessibility is design**: names for icon-only controls, keyboard paths
  (`useRovingFocus` for composite widgets), logical properties (`ps-`, `me-`,
  `inset-inline-*`) for RTL, `prefers-reduced-motion` handled by the contract's motion
  tokens (use them; never hard-code durations).
- **Paper is a state too.** The CSS package prints every theme as ink on paper and owns
  the `data-print` conventions (`hide`, `only`, `break-before`, `avoid-break`, `exact`,
  `flow`). A part that only a screen can use (a copy, submit or "Show more" button, a row's
  actions) renders `data-print="hide"`; a unit that should stay on one page renders
  `avoid-break` (Card does); colour that IS the data renders `exact` on the smallest element
  that carries it. Put the attribute before `{...props}` so a caller can override it.
  `src/print.css` adapts what predates the convention by classes and attributes components
  already render (a scroller let go, a panel printed open); it never defines a class. The
  `print-pages` check prints three pages from a dark theme.
- **A rule in a group stylesheet cannot beat a utility on the same element.** The group
  CSS sits in `layer(components)`, under `utilities`: a resting `border-border` utility
  wins over a `:hover { border-color }` rule. Write the state as a utility variant too
  (`hover:border-border-strong`), or the rest state as a rule.
- **Never suppress** a TypeScript or ESLint error (`noInlineConfig` is on). Fix it.

## The gates (`bun run check`)

| Script | Asserts |
|---|---|
| `verify:no-css-imports` | no `.ts`/`.tsx` under `src/` imports CSS; each finding on its own import's line (fixture test proves it goes red) |
| `verify:no-raw-tailwind` | no Tailwind defaults / raw literals (negative ones too) in `src/**` (minus `tokens.css`; hooks and util included) or `showcase/**` (showcase `*.examples.*` data excepted): lengths in every unit, `em`, `ch`, `lh`, viewport and container units included, except the unit lengths above; no numeric z-index, bracketed or not (the contract's layer scale instead); no numbered line width or offset (`border-2`, `ring-2`); no fixed `1px` line in a border, outline or box-shadow, in a stylesheet, a style object or a line utility's arbitrary value (`--BORDER-WIDTH` instead). One allowance, an exact declaration in one file with its reason (the unpromoted overlay cap's `100vw`); a near-copy still fails. Findings are `<file>:<line>`, one declaration per line (fixture test proves each rule, the allowance and its near-copy) |
| `verify:utilities-exist` | every class written in a class context under `src/` and `showcase/` generates CSS in the real Tailwind build. The CSS package removes Tailwind's colour, text-size, radius, shadow, weight, leading, tracking and easing scales, so `font-bold`, `leading-tight` or `bg-gray-100` compile to nothing; a plain class (`sc-page`) must exist in the compiled CSS, and `bg-${tone}` fragments are reported. A name ending in `class(es)`/`className(s)` makes a string a class list; an array or object under such a name counts as one only where some file uses it as classes (`ERROR_CLASSES` may list kinds of error), and is still checked for dead utilities otherwise (fixture test proves both directions) |
| `verify:domain-pairs` | every domain colour has LIGHT and DARK, is exposed only through the blend, and no source under `src/` or `showcase/` reads one half (a templated name included); under forced colors every pair maps to a system colour except the series and sequential palettes, and every meaning-bearing fill (`bg-series-*`, `bg-seq-*`, a status mark with an on-ink) opts out of repainting |
| `verify:series-palette` | series 1–8 stay distinct in both schemes: lightness band, chroma floor, adjacent ΔE ≥ 15 normal / ≥ 6 protan+deutan, first three all-pairs; plus any theme that overrides a pair (fixture test proves it goes red) |
| `verify:domain-contrast` | domain text (trend, serious/stale text and on-inks, code colours) ≥ 4.5:1 and domain status marks ≥ 3:1 on canvas + surfaces 0–3, in every theme the CSS package ships (discovered, never named) and in its print palette (`:root` inside `@media print`); no theme sets a domain size's selected name (`--CHART-H`) where `:root` declares its per-density names. `--theme <file>` measures a consumer's theme instead; installed, it is the `r-ui-domain-contrast` bin (fixture test proves each rule, and that zero themes, code roles or density sizes fails) |
| `verify:token-mirror` | every `@theme` name in `src/tokens.css` is mirrored in `cn`, both directions (fixture test proves it goes red) |
| `verify:class-prefix` | every class and keyframes name defined in `src/**/*.css` carries its owner's prefix (fixture test proves it goes red) |
| `verify:group-deps` | the import graph between component groups (plus `hooks`, `util` and the root barrel `index`), from every import and re-export in shipped modules (tests and `.examples.` files excluded), has no cycle; prints the hops of any cycle with file and line (fixture test proves it goes red, through a deep import, a type re-export and a group↔util pair) |
| `verify:no-html-injection` | no `dangerouslySetInnerHTML`, `innerHTML` / `outerHTML` assignment, `insertAdjacentHTML`, `document.write` or `createContextualFragment` in `src/` or `showcase/` (fixture test proves it goes red) |
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
server. `bun run browser:check <name>` runs the scripts whose file name contains `<name>`;
`node scripts/browser-check.mjs --print <name>` prints the code to `run-code` by hand. Every
script runs with `scripts/lib/browser-prelude.js` in scope:

- `waitForShowcase(page)` waits until `<html data-showcase-ready>` names the page in the
  hash (the shell sets it once the page and every chunk it suspends on have committed;
  pages and Overview sections are lazy chunks). Call it after every load or page change
  instead of a long timeout of your own.
- `showcaseThemes(page)` lists the themes the showcase publishes on
  `<html data-showcase-themes>`, each with what it is (`dark` from `--SCHEME-DARK`, its UI
  and display faces); `darkTheme(page)` is the first dark one. A check picks a theme by
  property and never names an example theme; a matrix covers every listed theme.
- `collectErrors(page, { filter })` collects console and page errors until `stop()`.
- The runner wraps every script in a `finally` that calls `resetShowcase`: stored View
  cleared, emulation off, the default viewport, a fresh load. A script that throws halfway
  cannot hand its state to the next, and its own error is reported over a reset error.

It needs a browser (`playwright-cli install-browser`) and is not part of `check`.

| Script | Asserts |
|---|---|
| `data-virtualized-rows.js` | 10,000 rows: a row is exactly `--ROW-H`, scroll height = rows × row height + head, the last row mounts at the end, and a live input switch and a stylesheet that retunes `--ROW-H-COMPACT` (no attribute moves) both re-measure |
| `hit-areas.js` | at coarse input a lone IconButton answers outside its box, a dense toolbar never hands a press on one button to its neighbour, a checkbox's own box takes the press, stacked labelled checkboxes are a floor apart; at fine input nothing grows |
| `floating-hide.js` | an open Popover hides while its trigger is scrolled out of view and comes back anchored; at 375 the DateRangePicker's capped popup and a Dashboard row menu keep their own `--R-SIZE-2` from both edges of `clientWidth`, and a promoted panel's cap resolves against `100%`, never `vw` (headless runs with hidden scrollbars, so the computed cap is what tells them apart) |
| `overview-matrix.js` | the whole Overview in every listed theme × 2 densities × fine/coarse × 1280/375: no console or page error, no tripped section boundary, no horizontal scroll in the page, and no scroll container inside a demo (the frame or any inner one) whose content is wider than it; a scroller designed to scroll is marked `data-sc-scrolls` in the demo (on it or a wrapper), which excuses scrollers inside it only |
| `dashboard-layout.js` | the Dashboard on every axis at 1440/375 without errors or sideways scroll; full sidebar / rail / bottom nav at 1440 / 900 / 375, measured inside the Dashboard's own frame; the frame covers the showcase's sidebar at 1440 and leaves the showcase's bottom nav clear at 375; KPI tiles in one row at 1440, the full sidebar's column exactly `--COLUMN-MD`, every KPI sparkline exactly `--SPARK-H` (shorter at compact); rows exactly the page's and the compact card's `--ROW-H`, the services rows with their actions button inside; Open incidents is a Timeline of four complete events; empty search and a toast work |
| `marketing-page.js` | UI inside prose stays at `--CONTROL-H` and UI type on every axis; display type grows monotonically with no step at 640 (predicted from the token's clamp over the Hero's width); the hero is the library's Hero, display role and size, edge to edge; no sideways scroll at 375, pricing table included |
| `theme-fonts.js` | a theme that names web faces gets them (picked by its faces: each one LOADED in `document.fonts`, body and heading resolve to them); the default theme downloads neither |
| `motion-overlay-exit.js` | Popover and Dialog stay painted, inert and fading for some frame after they close, focus is home at once, both are gone within 1s; the popover fades in too; under reduced motion the close is instant; a dialog opens on its `autoFocus` control (one that is not its first focusable) and the alertdialog on its Cancel; Escape closes a hover-opened Tooltip while focus stays in a field; a toast's Dismiss hands focus to the next toast and the last one's back to its trigger |
| `motion-scroll-reveal.js` | a ScrollReveal card below the fold starts hidden, fades in when scrolled into view and stays revealed; under reduced motion it is shown from the start |
| `disclosure-accordion.js` | Accordion rows are exactly `--ROW-H` (comfortable, compact, coarse); arrows / Home / End / Enter on real keys, the disabled last header crossed both ways; the panel's height animates open and closed and is instant under reduced motion |
| `stress-matrix.js` | the Stress page in every listed theme × 2 densities × fine/coarse × 1280/375: no error, no tripped panel, no sideways scroll, and no element whose child box or text line reaches past its own edges; every `KnownBug` repro listed in `KNOWN_BUGS` still reproduces (empty today) |
| `stress-density.js` | density re-derives at every nested boundary, both ways; menu, popover, tooltip and select opened in a clipping compact card are compact, in the top layer, unclipped and hit-testable |
| `stress-virtualized.js` | a 10,000-row table whose own density flips mid-scroll shows exactly the rows its scroll position predicts, both ways |
| `stress-contrast.js` | every visible text element on the Stress page, as painted (tints and washes composited), reads at 4.5:1 or better in a dark theme, menus and toasts open |
| `forced-colors-states.js` | under emulated forced colours (the default and a dark theme at 1280, the rail at 900, the bottom nav at 375): every audited "on" state differs from "off" in a property that survives forcing (checked, switch, selected segment and tab, current markers, pressed Button and IconButton, selected row, invalid edges, disabled, accordion, meter, skeleton, avatar (its hairline at `--BORDER-WIDTH`), menu highlight); a focused control shows exactly one solid ring, never one invisible on its own fill; `--SCHEME-DARK` follows the forced palette (light and dark), not the theme; the rail and bottom-nav fills keep their text |
| `charts-interaction.js` | charts at both densities × fine/coarse × 1280/375 in two themes: plot height is `--CHART-H`, axis labels ≥ 10px, inside the chart and never overlapping; hover snaps the crosshair and the top-layer tooltip matches the table; Home/ArrowRight/End move it and the status announces the row; a touch tap inspects; every chart has its named table, "Show as table" swaps it in, hostile data renders notes and a table |
| `content-code.js` | the Dashboard requests no lowlight module; the Overview requests lowlight's core and exactly the grammars its blocks name plus what they embed; tokens render; Copy puts the exact source on the clipboard and announces; tokens ≥ 4.5:1 as painted in the dark theme; at 375 nothing spills outside a scroller and long lines scroll then wrap; under forced colours tokens collapse to the block's ink, keeping weight, slant and the marked-line bar |
| `content-markdown.js` | hostile Markdown: no script-capable `href`/`src`, raw HTML as visible text, no tracking request; prose paragraphs on the prose scale while the CodeBlock keeps UI text and table rows `--ROW-H`; a task box sits inside its list's indent with the text on the list's column, at both densities; at 375 nothing spills past the section outside a scroller |
| `selection-inputs.js` | Combobox, MultiSelect and TagInput with real keys in a compact clipping card: filtering, `aria-activedescendant`, choose, Escape; the list in place, in the top layer, past the clip and hit-testable, options the card's `--ROW-H`; chips added and removed by keys; a refused tag; at 375 and coarse, chip rows a whole number of `--CONTROL-H`, every target ≥ 44px and a chip's remove button answering its hit area; a MultiSelect narrower than `--COLUMN-MD` folds into "n selected", which ArrowLeft reaches, Enter unfolds (focus on a remove button), and which answers the 44px floor at coarse |
| `dates-pickers.js` | a day cell is `--CONTROL-H`; keyboard across a month boundary; a range by keyboard; locale typed entry and a refusal; the range popup from a compact clipping card is in place, in the top layer, the card's density, past the clip and hit-testable, its trigger at the card's `--CONTROL-H` and Clear / Cancel / Apply on one footer row, Clear at the start; at 375 one month and inside the viewport; at coarse every cell ≥ 44px |
| `uploads-file-otp.js` | FileUpload: one named zone; a wrong type and an oversize file, picked one at a time, are refused into the zone's description and the Field goes invalid; progress advances, Cancel aborts and keeps focus in the row (Retry), Retry uploads, a failure shows its reason, Remove refocuses the zone and drops the submitted value. OTPInput: one textbox, a paste of "123-456" fills six boxes and completes once, Backspace / arrows / replace, the right code verifies. At 375 + coarse every zone and box ≥ 44px, a remove button answers its hit area, nothing spills |
| `colour-picker.js` | ColorPicker: the area and hue thumbs move by keys (value, thumb and hidden input follow); hex and in-gamut `oklch()` entries round-trip, chroma past sRGB is lowered to the edge with its note, `#ff0000` converts in the oklch field; an unreadable entry is a Field error; swatches are one radio tab stop; the contrast readout matches an independent computation; from a clipping compact card the popup is in place, top layer, card-sized and past the clip (below or flipped above); coarse hit areas; forced-colour edges (the checked swatch alone is Highlight) |
| `commands-palette.js` | CommandPalette: Ctrl+K opens the shell's palette, typing ranks, arrows + Enter run after it closes with focus home, a nested page and Backspace, Recent, an async page, Escape; compact-card rows 30px fine / 44px coarse; the highlighted row has its accent bar, and under forced colours is the opaque system Highlight |
| `overlays-context-menu.js` | ContextMenu: right-click opens at the pointer, Shift+F10 at the focused element with focus back on Escape; a Dashboard row's DropdownMenu and ContextMenu list and walk identically; a row menu acts on its row and the head opens none; compact items are the card's `--ROW-H` (44px coarse) and the menu escapes the clip (below or above); a long press opens it and keeps focus in it after the release, a moving touch does not; under forced colours the focused item alone is Highlight |
| `steps-wizard.js` | Stepper marker = `--ICON + 2 × --R-SIZE-5`; Next on an invalid step stays and focuses the field (including after a blur-time error, so the click is not lost), the server check is busy then blocks; heading focus per step; Back keeps values; only completed steps are selectable; narrow collapses; compact + coarse floors; five forced-colour states differ |
| `timeline-layout.js` | Timeline: every event an `<li>` in a named `<ol>` with an ISO, focusable `<time>`; Tab onto one shows its full reading in a describing Tooltip; sticky day headers in its own scroller; toned events have a glyph and a word, stateless a dot, and glyph, edge, dot and connector survive forced colours; compact is shorter; no spill at 375; the rail is on the inline start in RTL |
| `marketing-components.js` | MediaCard: two tab stops per card, the whole card hit-tests to its link, the save action takes its own press, a lazy 16:9 image, hover lifts and firms the edge (the edge alone under reduced motion). Carousel: per view by its own width, one-slide steps, keys, every slide reachable, no default autoplay, opt-in autoplay paused by hover and reduced motion, RTL; two quick presses on the dots during a smooth scroll land on the third slide; no spill at 375 |
| `print-pages.js` | Dashboard, Marketing and Overview printed (emulated) from a dark theme: white canvas, every text ≥ 4.5:1 on what prints behind it, shell chrome / menus / toasts / copy / pagination / drop zones and every `data-print="hide"` gone, table heads repeat and do not stick, nothing clipped, closed panels open, one tab per tab row, a VirtualizedTable without spacers and with its note; `page.pdf()` renders each to several pages |
| `navigation-focus.js` | two-page Pagination hands focus from the arrow it disables to the other one and back, link mode does at the last page; a Tabs whose selected tab is disabled has exactly one tab stop, the first enabled tab, and Tab lands on it |
| `form-state-submit.js` | the empty submit focuses the first invalid field in DOM order, described, with an error summary in page order; a summary link focuses its field clear of the sticky row; a fix clears its error; the async check's pending state and answer; a server error by path; the sticky row on its scroller's bottom edge; at 375 / compact / coarse the controls are `--CONTROL-H`, nothing scrolls sideways and the actions stack |

A new script is an `async (page) => { … }` expression that starts from `page.url()`, sets
the View through `localStorage[SHOWCASE_VIEW_KEY]`, reloads and calls `waitForShowcase(page)`,
and validates its harness against one value it can predict from source. It counts a list
before taking its minimum or calling `every` on it (`Math.min()` of nothing is `Infinity`),
and a check for an absence first proves the selector matches something. The runner resets
the View after it.

## Testing

Integration over mocks: render the real component, drive it with
`@testing-library/user-event`, assert what a user perceives (roles, names, focus). Never
`|| true` in an assertion and never an assertion behind an `if`. jsdom computes no
layout and loads no CSS; anything about size, colour or paint is a Playwright check
against the showcase, not a vitest test.
