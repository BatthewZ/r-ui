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
                           locale (LocaleProvider, useLocale, useLabels, LabelsProp and the
                           LabelsRegistry every component adds its labels to),
                           tone (the shared tone vocabulary and its class tables),
                           children (element children, fragments flattened), error-line (the
                           error message look) and text-match (folding, matching, MatchText);
                           the last four internal, not in util/index. util/preferences is also
                           the `./theme-script` subpath, imported by build tools: it stays
                           free of React and of any import
  components/
    primitives/ form/ overlays/ commands/ data/ navigation/ layout/ preferences/ motion/
    disclosure/ charts/ content/ dates/ steps/ marketing/ feedback/ toolbar/ filters/
    guards/ boards/
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
| primitives | `Button`, `IconButton`, `Badge`, `StatusLabel`, `Chip`, `Card`, `Alert`, `Spinner`, `Skeleton`, `Kbd`, `Divider`, `Avatar`, `AvatarGroup`, `Link` |
| form | `Field`, `Input`, `Textarea`, `Select`, `SearchInput`, `Checkbox`, `RadioGroup` (+ `Radio`), `Switch`, `SegmentedControl`, `NumberInput`, `CurrencyInput`, `PasswordInput`, `MaskedInput`, `Combobox`, `MultiSelect`, `TagInput`, `FileUpload`, `AvatarUpload`, `OTPInput`, `ColorPicker`, `Slider`, `RangeSlider`, `Rating`; form state: `useForm` + `Form`, `useFieldArray`, `useFormState`, `useFormValue`, `ErrorSummary`, `FormActions`; for custom controls: `useFieldValue`, `useFieldInputProps`, `useFieldMessage` |
| overlays | `Tooltip`, `Popover`, `HoverCard`, `DropdownMenu`, `ContextMenu` (one shared menu, `menu-internals`), `Dialog`, `Drawer`, `ToastProvider` + `useToast` |
| commands | `CommandPalette` + `useCommandPaletteShortcut` |
| data | `Table`, `DataTable`, `VirtualizedTable`, `StatCard`, `Sparkline`, `Meter`, `DescriptionList`, `EmptyState`, `Timeline` (+ `ActivityFeed` preset) |
| navigation | `AppShell`, `Tabs`, `Breadcrumbs`, `Pagination`, `NavList`, `TreeView`, `RouterProvider` |
| layout | `Stack`, `Inline`, `Grid`, `Container`, `Section`, `Prose`, `ScrollPanel`, `Splitter` |
| preferences | `ThemeSwitcher`, `DensitySwitcher`, `InputSwitcher`, `PreferencesMenu`, `ThemeScript` |
| motion | `ScrollReveal`, `Stagger`, `startViewTransition` / `useViewTransition` |
| disclosure | `Collapsible`, `Accordion` |
| charts | `LineChart`, `BarChart`, `Heatmap` |
| content | `CopyButton`, `CodeBlock`, `Markdown` |
| dates | `Calendar`, `RangeCalendar`, `DatePicker`, `DateRangePicker` (+ `withTime`), `TimeField`, `TimePicker` |
| steps | `Stepper`, `Wizard` |
| marketing | `Hero`, `MediaCard`, `Carousel` |
| feedback | `ProgressBar`, `ProgressRing`, `Banner`, `ErrorBoundary` (+ `ErrorFallback`). Progress is work toward done; a measured value that moves both ways is `Meter` (data) |
| toolbar | `Toolbar` (+ `Item`, `Group`, `Separator`), `ToggleGroup` |
| filters | `FilterBar` (+ `filtersToSearchParams` / `searchParamsToFilters`) |
| guards | `RequireAuth` |
| boards | `Kanban` |

Groups build on each other in one direction, and `verify:group-deps` fails on any cycle in
the graph between groups (and `hooks`, `util`, which import no group). An edge is an import
or a class borrowed by name: dates writing `"r-form-frame"` depends on form as surely as an
import would, so a class from another group is used only where that group is a dependency
below (and `verify:utilities-exist` fails if the class is renamed away):

| Group | May use |
|---|---|
| primitives, layout, motion | nothing else here (hooks and util only) |
| overlays, navigation, disclosure, feedback | `primitives` |
| guards, boards | `primitives`; nothing imports them |
| form | `primitives`, `overlays` (ColorPicker's Popover; the selection listbox's exit helpers), `feedback` (AvatarUpload's `ProgressRing`) |
| data | `primitives`, `form` (DataTable's `Checkbox` and filter controls), `overlays` (Timeline's Tooltip, the columns menu), `navigation` (DataTable's `Pagination`) |
| charts, content | `primitives`, `data` (`Table`, the series slots); charts also `overlays/internal` |
| dates, preferences | `primitives`, `form`, `overlays` (dates also borrows form's frame and option classes by name) |
| steps | `primitives`, `form` (the Wizard runs on `useForm`) |
| marketing | `primitives`, `layout` |
| commands | `primitives`, `form`, `overlays`; nothing imports it |
| toolbar | `primitives`, `form`, `overlays` (filters uses its `ToggleGroup`) |
| filters | `primitives`, `form`, `overlays`, `dates`, `toolbar` (one bar over the existing controls); nothing imports it |

So `overlays` never imports `form`: a component that needs both sits in a group above them
(that is why `CommandPalette` is its own `commands` group), and logic two groups share moves
down to `util` (`util/text-match`: folding, matching and the bold match highlight).
Floating panels outside `overlays` (the selection listbox, the chart tooltip) take the
exit-animation helpers from `overlays/internal`, the one deep import allowed. Otherwise
import through the group's barrel (`../primitives`). Use what
exists before writing a local copy: a tone's glyph and mark come from `util/tone`, an error
message's look from `util/error-line`, a loading bar is `Skeleton`, an icon-only control is
`IconButton`, a value shown as a removable token is `Chip`, a row-height probe is
`useRowHeight`.

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
TypeScript scanner, so a hoisted constant is caught too; comments never are. A bare word
that is also a utility (`shadow`, `rounded`) counts only in a class context (a word list or
a label holds words). If no
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
  padded to `--HIT-MIN` tall, so its box needs no pseudo-element. A hit area never covers a
  scrollbar or reaches past a scroller's padding: a gutter between scrolling panes
  (Splitter's separator) puts `hit-area` on a gutter-sized part shifted to hang over the
  pane after it only (the pane before has its scrollbar against the gutter), and a slider's
  rail is inset by half the floor so an end thumb's hit area stays inside the slider.
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
- **Translatable strings: one `labels` prop, read through the locale provider.** Every
  string a component writes itself (names, announcements, `aria-roledescription`, empty
  states, spoken summaries) is a label. A component with words of its own:
  1. declares `export interface XLabels` and `export const DEFAULT_X_LABELS: XLabels`;
  2. registers its key, `X`, beside them (the key is the `X` of `XLabels`; components that
     share one set share one key: the charts read `Chart`, the preference controls
     `PreferencesMenu`):
     ```ts
     declare module "../../util/locale" {
       interface LabelsRegistry {
         X: XLabels;
       }
     }
     ```
  3. takes `labels?: LabelsProp<XLabels>` and reads them with
     `const labels = useLabels("X", DEFAULT_X_LABELS, labelsProp)`, unconditionally, before
     any early return (it is a hook). The result layers defaults < every enclosing
     `LocaleProvider`'s `labels.X` (outer to inner) < the instance's `labels`; a map-valued
     label (the tone words) merges key by key, `undefined` keeps what is under it.
  4. exports `XLabels` and `DEFAULT_X_LABELS` from its group's barrel.
  A label set that extends another (`DatePickerLabels extends CalendarLabels`) is read under
  its own key only; a component passes its merged labels to the parts it renders. A label
  that needs a number takes the raw number (a translation needs it for plural rules) and
  formats it itself. No loose `closeLabel` / `clearLabel` / `messages` props. Tone words come
  from `TONE_LABELS` in `util/tone`, unpunctuated (a component adds its own `": "`). A
  per-instance accessible name is the caller's `aria-label`, spread after the default.
  `src/util/locale.test.tsx` holds the type contract (a wrong key or field fails to compile).
- **Locale: one source.** Every `Intl` path (the `format*` helpers, `dateTimeFormatter`,
  collation, `parseLocaleNumber`) gets its locale from `useLocale(localeProp)`: the
  component's own `locale` prop, else the nearest `LocaleProvider`'s, else `undefined` (the
  runtime's default). A component with no `locale` prop calls `useLocale()`. What a
  component formats itself always passes that locale; a label function receives raw numbers
  and formats them itself (a translation knows its own locale). A `locale` prop's doc says
  "Omitted: the `LocaleProvider`'s, else the runtime's".
- **A toggle keeps its name.** A button that flips a state is named for the action once
  ("Show password") and carries the state in `aria-pressed`; only its icon changes ("Hide
  password, pressed" would read as a contradiction).
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
- **A size container has no width of its own.** `Field`, `Pagination` and `FormActions` are
  `@container` roots (inline-size containment), so their intrinsic width is zero: in a bare
  flex row they collapse to nothing. Give them a track (a grid cell, `grow` with a basis);
  a part that places one (DataTable's footer pager) does the same. And a part that hides a
  box while still measuring it keeps that box out of scrollable overflow (a hidden box
  still counts): anchored where no scroller reaches, its paint contained.
- **A bounded box with actions scrolls its body, not the actions.** A panel, side sheet or
  card with a fixed or capped height and an action row is a `ScrollPanel` (`Body` scrolls,
  `Footer` holds the row below the scroller), so the scrollbar stops at the footer. Sticky
  stays for content whose scroller is the page (`FormActions sticky` on a long page form)
  and for a table's head inside its own scroller. `Dialog` and `Drawer` already lay out
  this way (`Dialog.Body` scrolls, `Dialog.Footer` does not).
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
  already render (a scroller let go, a panel printed open); it never defines a class. A
  windowed list (VirtualizedTable, a windowed TreeView) prints the rows it has mounted, in
  flow, with a note that it holds more. The `print-pages` check prints three pages from a
  dark theme.
- **A rule in a group stylesheet cannot beat a utility on the same element.** The group
  CSS sits in `layer(components)`, under `utilities`: a resting `border-border` utility
  wins over a `:hover { border-color }` rule. Write the state as a utility variant too
  (`hover:border-border-strong`), or the rest state as a rule.
- **Never suppress** a TypeScript or ESLint error (`noInlineConfig` is on). Fix it.

## The gates (`bun run check`)

| Script | Asserts |
|---|---|
| `verify:no-css-imports` | no `.ts`/`.tsx` under `src/` imports CSS; each finding on its own import's line (fixture test proves it goes red) |
| `verify:no-raw-tailwind` | no Tailwind defaults / raw literals (negative ones too; a bare word such as `shadow` only where a class context reaches it, so data strings stay data) in `src/**` (minus `tokens.css`; hooks and util included) or `showcase/**` (showcase `*.examples.*` data excepted): lengths in every unit, `em`, `ch`, `lh`, viewport and container units included, except the unit lengths above; no numeric z-index, bracketed or not (the contract's layer scale instead); no numbered line width or offset (`border-2`, `ring-2`); no fixed `1px` line in a border, outline or box-shadow, in a stylesheet, a style object or a line utility's arbitrary value (`--BORDER-WIDTH` instead). One allowance, an exact declaration in one file with its reason (the unpromoted overlay cap's `100vw`); a near-copy still fails. Findings are `<file>:<line>`, one declaration per line (fixture test proves each rule, the allowance and its near-copy) |
| `verify:utilities-exist` | every class written in a class context under `src/` and `showcase/` generates CSS in the real Tailwind build. The CSS package removes Tailwind's colour, text-size, radius, shadow, weight, leading, tracking and easing scales, so `font-bold`, `leading-tight` or `bg-gray-100` compile to nothing; a plain class (`sc-page`) must exist in the compiled CSS, and `bg-${tone}` fragments are reported. A name ending in `class(es)`/`className(s)` makes a string a class list; an array or object under such a name counts as one only where its own file uses it as classes, or a file that imports it does (matched by the import, never by spelling: a local `classes` elsewhere is another binding; `ERROR_CLASSES` may list kinds of error), and is still checked for dead utilities otherwise (fixture test proves both directions, an aliased import and a same-named local) |
| `verify:domain-pairs` | every domain colour has LIGHT and DARK, is exposed only through the blend, and no source under `src/` or `showcase/` reads one half (a templated name included); under forced colors every pair maps to a system colour except the series and sequential palettes, and every meaning-bearing fill (`bg-series-*`, `bg-seq-*`, a status mark with an on-ink) opts out of repainting |
| `verify:series-palette` | series 1–8 stay distinct in both schemes: lightness band, chroma floor, adjacent ΔE ≥ 15 normal / ≥ 6 protan+deutan, first three all-pairs; plus any theme that overrides a pair (fixture test proves it goes red) |
| `verify:domain-contrast` | domain text (trend, serious/stale text and on-inks, code colours) ≥ 4.5:1 and domain status marks ≥ 3:1 on canvas + surfaces 0–3, in every theme the CSS package ships (discovered, never named) and in its print palette (`:root` inside `@media print`); no theme sets a domain size's selected name (`--CHART-H`) where `:root` declares its per-density names. `--theme <file>` measures a consumer's theme instead; installed, it is the `r-ui-domain-contrast` bin (fixture test proves each rule, and that zero themes, code roles or density sizes fails) |
| `verify:token-mirror` | every `@theme` name in `src/tokens.css` is mirrored in `cn`, both directions (fixture test proves it goes red) |
| `verify:class-prefix` | every class and keyframes name defined in `src/**/*.css` carries its owner's prefix (fixture test proves it goes red) |
| `verify:group-deps` | the graph between component groups (plus `hooks`, `util` and the root barrel `index`), from every import and re-export in shipped modules and every `r-<group>-` class another group's strings name (tests, `.examples.` files and comments excluded), has no cycle; prints the hops of any cycle with file and line (fixture test proves it goes red, through a deep import, a type re-export, a group↔util pair and a class borrowed against the import direction) |
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
| `forced-colors-states.js` | under emulated forced colours (the default and a dark theme at 1280, the rail at 900, the bottom nav at 375): every audited "on" state differs from "off" in a property that survives forcing (checked, switch, selected segment and tab, current markers, pressed Button and IconButton, selected row, invalid edges, disabled, accordion, meter, skeleton, avatar (its hairline at `--BORDER-WIDTH`), menu highlight, the progress track's edge (dashed while indeterminate) and the ring's solid track under its arc); a focused control shows exactly one solid ring, never one invisible on its own fill; `--SCHEME-DARK` follows the forced palette (light and dark), not the theme; the rail and bottom-nav fills keep their text |
| `charts-interaction.js` | charts at both densities × fine/coarse × 1280/375 in two themes: plot height is `--CHART-H`, axis labels ≥ 10px, inside the chart and never overlapping; hover snaps the crosshair and the top-layer tooltip matches the table; Home/ArrowRight/End move it and the status announces the row; a touch tap inspects; every chart has its named table, "Show as table" swaps it in, hostile data renders notes and a table |
| `content-code.js` | the Dashboard requests no lowlight module; the Overview requests lowlight's core and exactly the grammars its blocks name plus what they embed; tokens render; Copy puts the exact source on the clipboard and announces; tokens ≥ 4.5:1 as painted in the dark theme; at 375 nothing spills outside a scroller and long lines scroll then wrap; under forced colours tokens collapse to the block's ink, keeping weight, slant and the marked-line bar |
| `content-markdown.js` | hostile Markdown: no script-capable `href`/`src`, raw HTML as visible text, no tracking request; prose paragraphs on the prose scale while the CodeBlock keeps UI text and table rows `--ROW-H`; a task box sits inside its list's indent with the text on the list's column, at both densities; at 375 nothing spills past the section outside a scroller |
| `selection-inputs.js` | Combobox, MultiSelect and TagInput with real keys in a compact clipping card: filtering, `aria-activedescendant`, choose, Escape; the list in place, in the top layer, past the clip and hit-testable, options the card's `--ROW-H`; chips added and removed by keys; a refused tag; at 375 and coarse, chip rows a whole number of `--CONTROL-H`, every target ≥ 44px and a chip's remove button answering its hit area; a MultiSelect narrower than `--COLUMN-MD` folds into "n selected", which ArrowLeft reaches, Enter unfolds (focus on a remove button), and which answers the 44px floor at coarse |
| `dates-pickers.js` | a day cell is `--CONTROL-H`; keyboard across a month boundary; a range by keyboard; locale typed entry and a refusal; the range popup from a compact clipping card is in place, in the top layer, the card's density, past the clip and hit-testable, its trigger at the card's `--CONTROL-H` and Clear / Cancel / Apply on one footer row, Clear at the start; at 375 one month and inside the viewport; at coarse every cell ≥ 44px |
| `uploads-file-otp.js` | FileUpload: one named zone; a wrong type and an oversize file, picked one at a time, are refused into the zone's description and the Field goes invalid; progress advances, Cancel aborts and keeps focus in the row (Retry), Retry uploads, a failure shows its reason, Remove refocuses the zone and drops the submitted value. OTPInput: one textbox, a paste of "123-456" fills six boxes and completes once, Backspace / arrows / replace, the right code verifies; the masked PIN and a plain recovery code, focused with a box selected, paint no ink they lack with the input at opacity 0 (each box one glyph; screenshots decoded in the page and compared per pixel, over 16/255 counts as ink, since toggling opacity moves anti-aliased edges by a level or two; the pair is retaken if the row moved between its shots), plain and under forced colours, with a positive control (inked input text changes the shot). At 375 + coarse every zone and box ≥ 44px, a remove button answers its hit area, nothing spills |
| `colour-picker.js` | ColorPicker: the area and hue thumbs move by keys (value, thumb and hidden input follow); hex and in-gamut `oklch()` entries round-trip, chroma past sRGB is lowered to the edge with its note, `#ff0000` converts in the oklch field; an unreadable entry is a Field error; swatches are one radio tab stop; the contrast readout matches an independent computation; from a clipping compact card the popup is in place, top layer, card-sized and past the clip (below or flipped above); coarse hit areas; forced-colour edges (the checked swatch alone is Highlight) |
| `commands-palette.js` | CommandPalette: Ctrl+K opens the shell's palette, typing ranks, arrows + Enter run after it closes with focus home, a nested page and Backspace, Recent, an async page, Escape; compact-card rows 30px fine / 44px coarse; the highlighted row has its accent bar, and under forced colours is the opaque system Highlight |
| `overlays-context-menu.js` | ContextMenu: right-click opens at the pointer, Shift+F10 at the focused element with focus back on Escape; a Dashboard row's DropdownMenu and ContextMenu list and walk identically; a row menu acts on its row and the head opens none; compact items are the card's `--ROW-H` (44px coarse) and the menu escapes the clip (below or above); a long press opens it and keeps focus in it after the release, a moving touch does not; under forced colours the focused item alone is Highlight |
| `steps-wizard.js` | Stepper marker = `--ICON + 2 × --R-SIZE-5`; Next on an invalid step stays and focuses the field (including after a blur-time error, so the click is not lost), the server check is busy then blocks; heading focus per step; Back keeps values; only completed steps are selectable; narrow collapses; compact + coarse floors; five forced-colour states differ |
| `timeline-layout.js` | Timeline: every event an `<li>` in a named `<ol>` with an ISO, focusable `<time>`; Tab onto one shows its full reading in a describing Tooltip; sticky day headers in its own scroller; toned events have a glyph and a word, stateless a dot, and glyph, edge, dot and connector survive forced colours; compact is shorter; no spill at 375; the rail is on the inline start in RTL; every thread (icon→dot, dot→dot, dot→icon) is mark · gap · line · gap · next mark, the gap `--R-SIZE-6` from each mark's drawn edge (±1px), at comfortable and compact, LTR and RTL, and the last event draws no line |
| `marketing-components.js` | MediaCard: two tab stops per card, the whole card hit-tests to its link, the save action takes its own press, a lazy 16:9 image, hover lifts and firms the edge (the edge alone under reduced motion). Carousel: per view by its own width, one-slide steps, keys, every slide reachable, no default autoplay, opt-in autoplay paused by hover and reduced motion, RTL; two quick presses on the dots during a smooth scroll land on the third slide; no spill at 375 |
| `print-pages.js` | Dashboard, Marketing and Overview printed (emulated) from a dark theme: white canvas, every text ≥ 4.5:1 on what prints behind it, shell chrome / menus / toasts / copy / pagination / drop zones and every `data-print="hide"` gone, table heads repeat and do not stick, nothing clipped, closed panels open, one tab per tab row, a VirtualizedTable without spacers and with its note, a windowed TreeView's rows in flow with its note; `page.pdf()` renders each to several pages |
| `sliders-interaction.js` | Slider: a drag moves to the pointer, follows past the rail's end and commits once on release; keys step, page and jump, each press commits once, none at the bound; RTL ArrowLeft raises; mark labels centred on their ticks, the end labels flush; vertical ArrowUp raises. RangeSlider: thumbs push and never cross, by drag and by keys, in RTL too. Rating: half steps, Delete clears, presses pick half or whole, hover previews, an empty submit focuses it invalid, read-only images named by value. Compact thumbs are smaller; at coarse + 375 a thumb answers 20px from its centre and nothing scrolls sideways; forced colours keep the fill (Highlight), the thumb and track edges |
| `feedback-progress.js` | ProgressBar: a determinate bar fills its share and says what it shows (floored, never 100% early); the indeterminate sweep moves, and under reduced motion runs no animation and stands still, striped across the track, beside its word |
| `feedback-banner-boundary.js` | Banner: a dismissal under `dismissKey` survives a reload and Restore clears it; a sticky band sits on its scroller's edge at the sticky layer. ErrorBoundary: a thrown widget is contained (siblings kept, no page error, the showcase's boundary untripped), details show the error, retry recovers, and a retry that fails again leaves focus on the new Try again |
| `time-field.js` | TimeField: the frame is `--CONTROL-H`; digits type and move on ("9" completes the hours), End/ArrowUp wrap without carry, Backspace empties and the form submits nothing; 12-hour "1030p" submits 22:30; the focused segment's band and the frame's ring, kept under forced colours; a refused time is invalid and described; RTL keeps the hours left; compact card frames are the card's height; at coarse every segment ≥ 44px, touching, and hit at its centre; no spill at 375 |
| `time-picker-range.js` | TimePicker: the list opens in place, in the top layer past a clipping compact card, its options the card's `--ROW-H`, centred on the value; keys and typed digits move; Enter chooses and the form saves. DateRangePicker `withTime`: times beside each date, the wire carries local instants with their offset, a preset submits two instants 24 hours apart; at 375 the panel fits; coarse options and the list button's hit area ≥ 44px |
| `datatable-rows.js` | DataTable: detail rows expand and span the row; a sticky bulk bar on the frame's bottom edge, focus to select-all when the selection clears; filters narrow and clear; pages (the pager laid out after the range, inside the frame), rows per page and Next; at 375 + coarse the pager and bar stay inside the frame |
| `datatable-columns.js` | DataTable columns: the columns menu in the top layer (a required column unavailable) hides a column, Escape closes it with focus home; a separator's value is its drawn width, min two `--CONTROL-H`, max `--MEASURE`, arrows / Home / End / double click; a drag widens by the pointer and stops at the min, mirrored in RTL; in a table already at its own width a drag widens the column by the full amount and its truncating neighbour keeps its min (the table grows); a double click restores the column's own width; pinned cells stay put and win hit tests while the table scrolls, the edge rule only while scrolled (and under forced colours); coarse handles 22px wide |
| `toolbar-keyboard.js` | Toolbar: one tab stop, Shift+Tab returns to the last control; arrows, Home and End walk every control in DOM order (mirrored in RTL), an `aria-disabled` control is a stop and a disabled one is passed over; radios inside move focus only until Space; a text input keeps its arrows and Home while its caret can move. ToggleGroup: multiple keeps two pressed; single checks as the arrows move, mirrored in RTL |
| `toolbar-layout.js` | Toolbar overflow: in a narrow box the trailing movable units leave for More (the pinned Select stays), More lists them in bar order and acts; they come back when it widens; at coarse the gap is the whole hit-area overhang and no two hit areas overlap, a press 1px inside each edge reaches its control; at fine the gap falls back; at 375 + coarse no toolbar spills (hidden units included) |
| `navigation-focus.js` | two-page Pagination hands focus from the arrow it disables to the other one and back, link mode does at the last page; a Tabs whose selected tab is disabled has exactly one tab stop, the first enabled tab, and Tab lands on it |
| `filters-bar.js` | FilterBar on the dashboard demo: it opens on its sample URL (chips in option order, the query line, the count equal to the table's own total, spoken politely); Clear all by Enter empties it, focus on the first control, the count shown at once and spoken once settled; a keyboard-only pass through every control (combobox, toggles, range thumb, date presets, search) gives five chips in definition order and the query line; Tab reaches each chip's remove button, Enter and Delete remove with focus on the chip that took its place, and the last one's removal empties its control |
| `filters-layout.js` | FilterBar by its own width: a narrow box folds into "Filters (n)" with chips and count still drawn; its modal drawer (in place, top layer, inside the viewport) holds the same filters in order and edits them by keys, Escape returns focus; Clear all lands on the first drawn control; RTL remove on the inline end; compact + coarse chips a whole `--CONTROL-H` line apart with 44px remove targets; at 375 no bar draws past its box or the page, long chips truncate, and the drawer does not scroll sideways |
| `tree-keyboard.js` | TreeView with real keys: one tab stop, then the focused row's own actions, then out; APG arrows, Home/End, `*`, typeahead; a chevron press keeps focus on its row; RTL mirrors Left/Right; tri-state checks with a disabled child; lazy children (busy row never focusable, an error row retries, an empty branch becomes a leaf); links navigate through the router; a 2,550-row windowed tree mounts under 200 rows and End reaches the last; every row's accessible name is its label alone, never its actions |
| `tree-layout.js` | TreeView: a row is exactly `--ROW-H` (with control-height actions in it), each level indents `--R-SIZE-2` (mirrored in RTL), the chevron turns (at rest, after its transition); compact rows shorter; at coarse + 375 rows ≥ 44px, presses 20px off a chevron's centre toggle it, nothing spills and a long name breaks; forced colours keep the selected fill, checked box and current bar Highlight |
| `tree-require-auth.js` | RequireAuth, watched by a MutationObserver while the demo really waits: the protected card never appears in any DOM state whose status is not "authenticated" (and does once it is), "loading" removes it in the same commit, `authorize` refuses, `onUnauthenticated` runs once per arrival and the sign-in link goes through the RouterProvider; the fallbacks are a status, a named link and a message, and the card's content is reachable only once authenticated |
| `hovercard-splitter-card.js` | HoverCard: opens after its delay (not before), a group named by its trigger, in the top layer; the pointer crosses the gap into it and it stays; Escape from anywhere closes a hover-opened card; keyboard focus opens it without moving focus, Tab walks in and out, Escape returns to the trigger; the touch toggle; a compact card escapes a clip at the frame's density; at 375 it keeps `--R-SIZE-2` from both edges |
| `hovercard-splitter-panes.js` | Splitter: separators named and valued from their panes, panes drawn at the shares; a drag follows by pointer capture and stops at a token minimum; Home/End/arrows; Enter collapses (inert) and restores; RTL; stacked; nested splitters move independently; a controlled sidebar; the gutter is `--R-SIZE-5` and its hit area meets the floor (24 fine, 44 coarse) without growing; at coarse + 375 nothing scrolls sideways |
| `form-inputs-text.js` | PasswordInput keeps value, focus and selection across show/hide (by press and by key; Chromium resets a swapped field's selection on its next style update), the strength meter follows the score; MaskedInput's caret on insert, delete, paste and a refusal, RTL; CurrencyInput types in de-DE and formats on blur, the symbol on the locale's side, JPY without fraction digits; at coarse + 375 frames are `--CONTROL-H`, the toggle's hit area ≥ 44px, nothing spills; forced-colour strength segments |
| `form-inputs-avatars.js` | AvatarUpload with a real image and canvas: a refused type describes the button, the crop at zoom 2 proven on pixels, the progress ring over the stage, cancel and failure with focus on the next action; AvatarGroup overlaps by a quarter of `--CONTROL-H` (mirrored in RTL), its "+n" names the rest and `renderOverflow`'s popover lists them; coarse sizes, no spill at 375, the chip's edge under forced colours |
| `kanban-keyboard.js` | Kanban by keyboard: Space picks up, arrows move within and across columns with the drop line in the gap, a WIP limit announced, Enter commits one change with focus kept, Escape and blur cancel; RTL arrows follow what is drawn; a keyed move scrolls its column into view; a folded column takes a card |
| `kanban-pointer.js` | Kanban by mouse and touch: a few pixels before a drag starts, a top-layer preview under the pointer, the drop line in the gap, one commit on release, a drag from a button swallows its click, Escape cancels; edge scrolling (snap let go while dragging); touch scrolls when it moves first and picks up after a hold; forced colours draw the source, target and line without colour |
| `kanban-layout.js` | Kanban: card padding follows density, wide columns within `--COLUMN-MD`…`--COLUMN-LG`, a narrow board snaps at 85% columns, a folded column is a strip; at coarse every card, add and collapse button meets 44px; at 375 no board or page spills (visually hidden counts included) and a card's content never reaches past it |
| `form-state-submit.js` | the empty submit focuses the first invalid field in DOM order, described, with an error summary in page order; a summary link focuses its field clear of the sticky row; a fix clears its error; the async check's pending state and answer; a server error by path; the long form's row sticky at the sticky layer; the FormActions demo's ScrollPanel scrolls only its body, the footer outside it on the panel's bottom edge at both ends of the scroll; at 375 / compact / coarse the controls are `--CONTROL-H`, nothing scrolls sideways and the actions stack |

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
