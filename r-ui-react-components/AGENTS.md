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
  hooks/                   shared hooks (useFloating, useRovingFocus, useVirtualRows, useRowHeight,
                           usePressDrag: the one press-to-drag engine…)
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
    guards/ boards/ media/
      index.ts             the group's barrel: one `export` line per component
      styles.css           the group's CSS (plain rules, tokens only)
      <Name>.tsx           a component (compound parts in the same file or <Name>/)
      <Name>.test.tsx      its tests
showcase/                  the consumer app (vite): `bun run showcase:dev`
  sections/<group>/<Name>.tsx   one demo section per component (auto-discovered)
  pages/<Page>.tsx              Overview, Dashboard, Marketing, Stress (+ Solo and All, for the browser checks)
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
| motion | `ScrollReveal`, `Stagger`, `startViewTransition` / `useViewTransition`, `Parallax`, `CountUp`, `ReadingProgress`, `Spotlight` (decoration on decorative layers only: none takes a label or a key) |
| disclosure | `Collapsible`, `Accordion` |
| charts | `LineChart`, `BarChart`, `Heatmap` |
| content | `CopyButton`, `CodeBlock`, `Markdown` |
| dates | `Calendar`, `RangeCalendar`, `DatePicker`, `DateRangePicker` (+ `withTime`), `TimeField`, `TimePicker`, `EventCalendar` (month, week, day, agenda) |
| steps | `Stepper`, `Wizard` |
| marketing | `Hero`, `MediaCard`, `Carousel`, `SiteHeader`, `NavigationMenu` (+ `navigationMenuLinks`), `Footer` (+ `Column`, `Link`, `SocialLink`), `LogoCloud`, `Pricing`, `PricingTable`, `Testimonial`, `FeatureGrid` (+ `Item`), `FeatureRows` (+ `Row`), `HowItWorks` (+ `Step`), `CallToAction`, `EmailCapture`, `SectionHeading` |
| media | `Image`, `Lightbox` (+ `Lightbox.Trigger`), `MasonryGrid` |
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
| dates, preferences | `primitives`, `form`, `overlays` (dates also borrows form's frame and option classes by name, and the EventCalendar's day panel takes the exit helpers from `overlays/internal`); dates also `data` (the `SeriesSlot` type, `EmptyState`) |
| steps | `primitives`, `form` (the Wizard runs on `useForm`) |
| media | `primitives`, `overlays` (Lightbox's `Dialog`), `layout` (the `Space` type) |
| marketing | `primitives`, `layout`, `form` (EmailCapture, Pricing's toggle, Testimonial's read-only `Rating`), `data` (PricingTable's `Table`), `overlays` (NavigationMenu's panels: the exit helpers from `overlays/internal` and the `.r-overlays-surface` cap; SiteHeader's `Drawer`; PricingTable's `Tooltip`), `disclosure` (the narrow header's `Accordion`), `media` (MediaCard's `Image`), `steps` (HowItWorks borrows the marker's look by class: `r-steps-stepper`, `r-steps-marker`, `r-steps-marker-number`) |
| commands | `primitives`, `form`, `overlays`; nothing imports it |
| toolbar | `primitives`, `form`, `overlays` (filters uses its `ToggleGroup`) |
| filters | `primitives`, `form`, `overlays`, `dates`, `toolbar` (one bar over the existing controls); nothing imports it |

So `overlays` never imports `form`: a component that needs both sits in a group above them
(that is why `CommandPalette` is its own `commands` group), and logic two groups share moves
down to `util` (`util/text-match`: folding, matching and the bold match highlight).
Floating panels outside `overlays` (the selection listbox, the chart tooltip, NavigationMenu's panels) take the
exit-animation helpers from `overlays/internal`, the one deep import allowed. Otherwise
import through the group's barrel (`../primitives`). Use what
exists before writing a local copy: a tone's glyph and mark come from `util/tone`, an error
message's look from `util/error-line`, a loading bar is `Skeleton`, an icon-only control is
`IconButton`, a value shown as a removable token is `Chip`, a row-height probe is
`useRowHeight`, and anything dragged by pointer or touch goes through `usePressDrag`
(`hooks/use-press-drag`, internal: threshold, touch hold, edge scrolling, Escape and the
swallowed click), never its own window listeners.

## Adding a component (touch only your group)

1. Write `src/components/<group>/<Name>.tsx` (+ `<Name>.test.tsx`).
2. Add one line to `src/components/<group>/index.ts`: `export { Name, type NameProps } from "./Name";`
3. CSS the utilities cannot express goes in `src/components/<group>/styles.css`.
4. Add `showcase/sections/<group>/<Name>.tsx`:
   ```tsx
   export const meta = { title: "Name", group: "<group>", order: 10, description: "What the demo proves." };
   export default function NameSection() { /* every state, side by side */ }
   ```
   Import the component from `../../../src` (or the group path); `group` is the folder's
   name (the id is read from the path, so a mismatch lists the section as invalid). The
   group's page (`#/overview/<group>`, with its "On this page" rail and sidebar entry),
   the anchor `#/overview/<group>-<file>` (that section on its group's page), the
   all-sections route `#/all` and the solo route `#/solo/<group>-<file>` appear
   automatically (each section is its own lazy chunk; a group's page loads only its own).
   A new group also wants an icon in `showcase/shell/group-icons.ts` (else a folder). The
   showcase's command palette lists every component the group barrels export, by name: one
   named like a section file opens that section; one demoed inside another component's
   section is listed in that section's `meta.components` (`components: ["RangeCalendar"]` in
   Calendar's), or `showcase/shell/components.test.ts` fails. A demo element that is designed to scroll sideways (a wide table, a code
   block's lines) carries `data-sc-scrolls`, or `sweep-overview` reports it as a spill.
   The demo frame scrolls sideways, so it is a scroll container: a demo whose
   scroll-driven effect must follow the page (a view timeline attaches to the nearest
   scroll container) sets `frame: "open"` in its `meta`.
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
  `CHART-AXIS`, `RATING` (Rating's fill: data, never the accent), `CODE-KEYWORD` /
  `CODE-STRING` / `CODE-NUMBER` / `CODE-FUNCTION` / `CODE-TYPE`.
  Utilities: `*-series-N`, `*-seq-N`, `*-trend-good|bad|flat`, `*-status-serious(-bg)`,
  `*-fg-serious`, `*-fg-on-serious`, `*-status-stale(-bg)`, `*-fg-stale`, `*-fg-on-stale`,
  `*-chart-grid|axis`, `*-rating`, `text-code-keyword|string|number|function|type`, plus
  `text-code-comment|property|addition|deletion` (aliases of the contract's muted, secondary,
  success and error text roles). `TEXT-ON-*` is the ink on the mark used as a fill (a solid
  Badge); `verify:domain-contrast` holds it to 4.5:1 on its mark in every theme.
  `trend-flat` aliases the contract's `--C-TEXT-SECONDARY`.
- forced colors (Windows High Contrast) follow the contract's four rules. Status, trend,
  chart chrome and the rating fill map both halves of each pair to a system colour; the series and
  sequential palettes keep their colours (the colour is the information, and a series is
  also labelled), and their `bg-` fills opt out of repainting through same-name `@utility`
  companions, as `bg-status-serious` / `-stale` do; their blend follows the forced
  palette's scheme, because the contract sets `--SCHEME-DARK` from it there. The code
  colours become CanvasText (weight and slant carry keyword and comment). A new pair needs
  one or the other (`verify:domain-pairs`).
- sizes (density-dependent): `--CHART-H` (`h-chart`), `--BAR-THICK` (`h-bar`/`w-bar`),
  `--HEAT-CELL` (`size-heat-cell`), `--SPARK-H` (`h-spark`), `--KPI-MIN`, `--KPI-MAX`,
  and `--KPI-VALUE` (`text-kpi`, container-sized with `cqi`).
- motion: `--PARALLAX-SHIFT`, how far `Parallax` drifts at its medium strength (subtle
  reads half, strong one and a half; no utility). A length, by default
  `--MOTION-DISTANCE-LG` × 4, so a theme tones parallax down or off without moving
  reveals. Reduced motion and print set it to `0px !important` in `tokens.css` (the
  contract's own pattern for its distances), so no theme override survives either;
  `motion-extras-parallax` proves it with a theme-like override.

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
  the panel (it stays mounted and comes back with the anchor). A panel's gap is a token's
  name (`offset: "--R-SIZE-6"`, read at the reference so it follows density), never a px
  number.
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
- **A page-wide CSS hook is the owner's, and named so.** A group stylesheet writes to
  `:root` (or any rule with no class of its own) only to publish its own
  `--r-<group>-…` value that content outside the component must read: today
  `--r-marketing-site-header-h` (the bar's height, declared on `:root` and every
  `[data-density]` so it re-derives there), which a hero under a transparent header pads by
  and a scroller under a sticky one uses as `scroll-padding-block-start`; and
  `--r-navigation-shell-bottom-inset`, the shown bottom navs' block size, which
  `AppShell.BottomNav` measures and writes on `<html>` from script (no stylesheet rule) and
  the toast region adds to its bottom offset. They are public API.
  The other direction is a hook the owner only reads, with a fallback, and a caller sets on
  the component or an ancestor: `--r-marketing-site-header-top`, the offset a sticky
  `SiteHeader` sticks at (and slides past when hidden) under a bar the host already sticks.
  A group sheet never re-points a contract token or another group's lever page-wide
  (`verify:class-prefix`).
- **One stretched link.** A card or item whose title link covers it (MediaCard, a linked
  FeatureGrid item) uses `r-marketing-stretched-link`: its `::after` covers the nearest
  positioned ancestor and draws the focus ring around it; a host with no border sets
  `--r-marketing-stretched-inset: 0`. Secondary actions after it are positioned to stay
  their own targets.
- **Site navigation is disclosure navigation, never `role="menu"`** (NavigationMenu,
  SiteHeader): links stay links, buttons carry `aria-expanded`, panels follow their button.
- **`<cite>` holds the source work** (a case study, a review site), never a person's name
  (WHATWG); the person is in the `<figcaption>` (Testimonial).
- **A size container cannot be a subgrid.** `@container` applies layout containment, and a
  contained grid lays out on its own: `Card` is a container, so a card that must share its
  parent's rows passes `@container-normal` with `grid-rows-subgrid` (Pricing's plans).
- **A picture's box is not an `<img>`.** `Image` takes the file's width as its preferred
  size, which is also its min-content size (a replaced `<img>` shrinks; a box does not): in
  a track sized by content, pass `w-full` or give the track a zero minimum.
- **The runtime floor is ES2022** (`tsconfig` `target` and `lib`, plus `ES2023.Intl`):
  `Intl.ListFormat` and friends are inside it. Build a list, date or relative-time
  formatter through `util/format` (`listFormatter`, `dateTimeFormatter`, …), which caches it
  and falls back to the runtime's locale on a malformed tag.
- **A view timeline follows the nearest scroll container**, whatever axis it scrolls:
  `overflow-x: auto` makes both axes scroll, so `Parallax` or `ReadingProgress` inside a
  sideways scroller measures that box, not the page, and holds still. Say so where a
  component runs on one, and keep its demos out of scrolling frames.
- **Decoration in a flow is not content.** A part a component inserts before the caller's
  content (ReadingProgress's bar) resets the margin of what follows it, so a prose region's
  first heading keeps its first-child spacing (`* + h2` would otherwise add a section step).
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
  flow, with a note that it holds more. The `sweep-print` check prints three pages from a
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
| `verify:domain-contrast` | domain text (trend, serious/stale text and on-inks, code colours) ≥ 4.5:1 and domain marks (serious/stale status, the rating fill) ≥ 3:1 on canvas + surfaces 0–3, in every theme the CSS package ships (discovered, never named) and in its print palette (`:root` inside `@media print`); no theme sets a domain size's selected name (`--CHART-H`) where `:root` declares its per-density names. `--theme <file>` measures a consumer's theme instead; installed, it is the `r-ui-domain-contrast` bin (fixture test proves each rule, and that zero themes, code roles or density sizes fails) |
| `verify:token-mirror` | every `@theme` name in `src/tokens.css` is mirrored in `cn`, both directions (fixture test proves it goes red) |
| `verify:class-prefix` | every class and keyframes name defined in `src/**/*.css` carries its owner's prefix, and a rule with no class of its own (`:root`, `[data-density]`) declares only the owner's `--r-<group>-…` custom properties (`src/tokens.css` excepted: page-wide names are its job) (fixture test proves both go red) |
| `verify:group-deps` | the graph between component groups (plus `hooks`, `util` and the root barrel `index`), from every import and re-export in shipped modules and every `r-<group>-` class another group's strings name (tests, `.examples.` files and comments excluded), has no cycle; prints the hops of any cycle with file and line (fixture test proves it goes red, through a deep import, a type re-export, a group↔util pair and a class borrowed against the import direction) |
| `verify:no-html-injection` | no `dangerouslySetInnerHTML`, `innerHTML` / `outerHTML` assignment, `insertAdjacentHTML`, `document.write` or `createContextualFragment` in `src/` or `showcase/` (fixture test proves it goes red) |
| `verify:browser-tags` | every `scripts/browser/*.js` opens with valid tags: `@covers` (groups under `src/components/`, or `group/Component` exported by its barrel; `*` for a sweep only) and `@tier` (sweep, page or component) always, `@sections` (ids the showcase renders) and `@flags` (timing, touch) and `@cost` (seconds) as they apply, no unknown or repeated tag; every component group has a component-tier script or a reason in the gate's `UNCHECKED_GROUPS` (fixture test proves each goes red) |
| `typecheck`, `lint`, `test` | tsc strict (+ `noUncheckedIndexedAccess`), eslint (narrow, no suppressions), vitest (jsdom) |

The showcase is the Playwright target: `bun run showcase:dev`, then drive it. The View
panel sets `data-theme`/`data-density`/`data-input` on `<html>` and shows the resolved
`--CONTROL-H`, `--ROW-H`, `--HIT-MIN`, `--R-SIZE-3`, `--BodyText-1`. Each section renders
behind its own error boundary (`[data-section-error]` when tripped), so one broken demo
never blanks the page.

## Browser checks (`bun run browser:check`)

What jsdom cannot see (layout, hit testing, the top layer, CSS) is settled in a real
browser by `scripts/browser/*.js`. `bun run browser:check` builds the showcase, serves it
on a free port, runs every script with `run-code` in `playwright-cli` sessions (a script
throws to fail and returns a summary to pass), then closes every session and stops the
server, pass, fail or Ctrl-C. It needs a browser (`playwright-cli install-browser`) and is
not part of `check`.

What it runs against (`scripts/browser-check.mjs`):

- By default, a **development-mode build under `vite preview`**: bundled chunks as a
  consumer ships them, React's development build (so a duplicate key or a bad nesting
  still reaches the console the checks collect), source maps beside the chunks, and no hot
  reload under a running check. Every run builds first (about a second): a check never
  measures a build older than the source. `--production` builds and serves the production
  build (React's production mode: no development warnings to collect); `--dev` runs against
  the dev server, for debugging against live source. Each run keeps its build, logs and
  scratch under `node_modules/.cache/r-ui-browser-check/runs/<pid>/`, so two runs never
  share a file.
- **Shards.** The selection is split across N sessions (`scripts/lib/browser-shards.mjs`),
  all against the one server: packed greedily, longest first, by each script's last
  recorded time (`node_modules/.cache/r-ui-browser-check/durations.json`), else its
  `@cost`, else its tier's default. N defaults to what the memory allows (available memory
  less 1.5 GB, over a session's peak for the heaviest tier in the set: 2.8 GB with a sweep,
  1.2 GB with a page check, else 1 GB), capped at 4, and at 3 when a sweep is in the set;
  the budget is printed first. `--shards n` asks for n (the caps still hold). `--profile`
  and `--dev` run one session unless `--shards` says otherwise (the dev server compiles
  each module on its first request, and parallel sessions against a cold one time out).
  Scripts flagged `timing` run one by one after the shards, in a fresh session, with no
  other browser competing for the CPU.
  A session is reopened after a `touch` script (each shard runs them last) and after a
  failure. A navigation waits at most 30 s (playwright-cli's own page would wait forever),
  and a script that runs past four times its usual time (three minutes at least) is
  stopped and fails. `--shuffle <seed>` reorders every session's scripts by a seed, to
  prove none leans on what ran before it.
- **Failures and flakes.** A failed script runs again, alone, in a fresh session, after
  everything else. Passing then, it is reported **FLAKY**, which fails the run as a FAIL
  does: a flake is a bug to fix, never a pass. Each session writes its own log
  (`runs/<pid>/logs/<shard>.log`, `t.log` for the timing tail, `r.log` for re-runs); the
  merged results, sorted by name, are `summary.log` there, and the run ends with a summary
  of each session's time and memory peak.

Choosing what runs (criteria of different kinds narrow each other; values of one kind widen):

- `browser:check form- dates-`: scripts whose file name contains any filter.
- `--group form,dates`: scripts whose `@covers` names a group (a `*` sweep is reached by
  its tier, not by a group). `--tier sweep|page|component`.
- `--changed[=<ref>]`: the files changed since `ref` (default `HEAD`, untracked included)
  mapped to scripts, with the reason for each: a component change runs every script
  covering its group or a group that imports it (the `verify:group-deps` graph, walked
  backwards), a hook or util change its dependants, a token, global stylesheet or CSS
  package change everything, a section file the scripts whose `@sections` name it, a page
  the scripts that visit it; plus the sweep tier. A harness change (runner, prelude,
  shell) asks for one script run alone first. Nothing a browser sees changed: nothing runs.
- `--list` prints the selection and stops (with `--shards` or `--shuffle`, the plan too);
  `--print <name>` prints the code to `run-code` by hand; `--profile` adds each load's time and requests, each block's time, the reset
  and the session's peak memory; `--all` makes every `openSection` open its sections
  among all the others (`#/all`) instead of alone (to prove a converted check equal on both);
  `--seed n` picks which View combinations the sweeps load fresh (`viewMatrix`). By
  default it changes once a day; every run prints it, so `--seed` repeats a run's loads.

Every script opens with its tags (`scripts/lib/browser-tags.mjs` has the format;
`verify:browser-tags` holds them):

```js
// @covers   form/PasswordInput, form/MaskedInput    groups, or group/Component; `*` for a sweep over all
// @sections form-passwordinput form-maskedinput     the sections it opens (optional)
// @tier     component                               sweep | page | component
// @flags    timing touch                            timing: frame or ms windows; touch: dirties the session
// @cost     45                                      seconds, for packing before a run has timed it (optional)
```

A long list continues on the lines right after its tag, each indented past `//` by two
spaces or more (`//           form-currencyinput`).

Every script runs with `scripts/lib/browser-prelude.js` in scope:

- `openSection(page, ids, { view, width, height, reduced, forced, runway, settle })` opens
  one section id or a list (`<group>-<file>`) by itself on a fresh document:
  `#/solo/<ids>` renders only those sections, in a group page's exact markup
  (`showcase/shell/SectionFrame.tsx`), loading only their chunks. A section is exactly as
  wide there as on `#/all` (the shell's single `minmax(0, 1fr)` column, and
  headless scrollbars take no width), so a check measures the same layout on both routes. It sets the viewport (1280 × 900 unless
  given), reduced motion and forced colours before the load and stores `view` (theme,
  density, input) so the sections mount under it; `view.dir` is applied after. `runway`
  adds a viewport of page above and below. It throws if an id renders no section or a
  section trips its boundary, settles, and returns the first section's locator.
- `setView(page, { theme, density, input, dir, width, height, reduced, forced, settle })`
  switches any subset of the View live, without a reload, through the showcase's
  preference hooks (`window.__showcase.setView`, the same hooks as the View panel's
  switchers); `width` or `height` alone keeps the other side. It then settles and throws if
  `<html>` does not show what was asked for.
- `openPage(page, name, { view, width, height })` opens a whole page (`overview`,
  `dashboard`, `marketing`, `stress`) on a fresh document under `view`, the View stored and
  the document left for `about:blank` first so the page mounts once, then settles.
- `sweepViews(page, { themes, widths }, { load, check })` walks `viewMatrix`: every theme ×
  comfortable/compact × fine/coarse at each width. A combination marked fresh goes through
  `load(view)` (a new document); the rest are switched to live with `setView`, which is how a
  user switches and costs a fraction of a load. Fresh: the first at each width, plus one per
  theme laid out as an orthogonal array over density, input and width (so both values of each
  mount fresh every run), rotated by the seed. `check(view, label)` runs after each; a label
  ends in " (fresh)" after a load.
- `withClock(page, fn)` runs `fn(cp)` on a page of its own browser context with `cp.clock`
  installed before the showcase loads (a clock cannot be uninstalled, and the session's page
  runs every later check). The clock flows with real time; `cp.clock.runFor(ms)` fires every
  timer due at once (autoplay, a simulated upload, a hover delay), while frames and CSS keep
  running. Not where frames are sampled: the fake `requestAnimationFrame` follows the fake clock.
- `settle(page, { until })` waits two frames, the fonts and every finite animation on the
  document timeline (an infinite or scroll-driven one is not waited for), and names what
  is still running after its timeout. `until: "started"` (also `settle: "started"` on the
  two above) waits only for the animations already running, for a demo whose own timers
  keep starting new ones.
- `waitForShowcase(page)` waits until `<html data-showcase-ready>` names the page in the
  hash (the shell sets it once the page and every chunk it suspends on have committed;
  pages and sections are lazy chunks). Call it after every load or page change instead of
  a long timeout of your own.
- `showcaseThemes(page)` lists the themes the showcase publishes on
  `<html data-showcase-themes>`, each with what it is (`dark` from `--SCHEME-DARK`, its UI
  and display faces); `darkTheme(page)` is the first dark one. A check picks a theme by
  property and never names an example theme; a matrix covers every listed theme.
- `collectErrors(page, { filter })` collects console and page errors until `stop()`.
- `BROWSER_CHECK_BUILT` is true against a build (the default) and false under `--dev`. Only
  a claim about what the bundler made reads it: the grammar chunks content-code counts, the
  source-mapped stack frames motion-extras-parallax attributes.
- `mark(label)` times a block under `--profile` (the runner also marks numbered block
  comments, `// 3. …`, by itself).
- The runner wraps every script in a `finally` that calls `resetShowcase`: stored View
  cleared, emulation off, the default viewport, a fresh document on the blank route
  (`#/blank`, the shell with no page, so a reset loads no section). A script that throws
  halfway cannot hand its state to the next, and its own error is reported over a reset
  error. Every script starts there too.

One row per script: its tier (with its `@flags`), the groups its `@covers` names (`all` for
`*`), and what only it proves in a browser. A sweep runs in every gate (`--tier sweep`); a
page check loads a whole page; a component check opens its sections alone. What a row does not
name (key models, ARIA, flows) is the unit tests'.

| Script | Tier | Groups | Uniquely proves |
|---|---|---|---|
| `sweep-overview.js` | sweep | all | every section on one page (`#/all`) in every listed theme × 2 densities × fine/coarse × 1280/375 (each width and the seed's rotating combinations loaded fresh, the rest switched live): no console or page error, no tripped section boundary, no horizontal scroll in the page, and no scroll container inside a demo (the frame or any inner one) whose content is wider than it (a scroller designed to scroll is marked `data-sc-scrolls`); at coarse every pointer target is at least `--HIT-MIN` on both axes (box ∪ its hit areas ∪ labels; inline links in text and `hit-area` siblings a `--HIT-MIN` pitch apart pass; `data-sc-hit-exempt="<why>"` opts a demo element out; today's shortfalls are listed in `KNOWN_UNDER_FLOOR`, each still found or the list goes red); every `.h-control` is exactly the `--CONTROL-H` at its parent, `.size-control` on both axes, frames and `.min-h-control` at least it |
| `sweep-forced-colors.js` | sweep | all | under emulated forced colours (the default and a dark theme at 1280, the rail at 900, the bottom nav at 375): every audited "on" state differs from "off" in a property that survives forcing (checked, switch, selected segment and tab, current markers, pressed Button and IconButton, selected row, invalid edges, disabled, accordion, meter, skeleton, avatar (its hairline at `--BORDER-WIDTH`), menu highlight, the progress track's edge (dashed while indeterminate) and the ring's solid track under its arc); a focused control shows exactly one solid ring, never one invisible on its own fill; `--SCHEME-DARK` follows the forced palette (light and dark), not the theme; the rail and bottom-nav fills keep their text; a missing audited element fails the check |
| `sweep-floating.js` | sweep | overlays, form, dates, marketing, commands | the floating sweep: every floating component (menu, popover, tooltip, context menu, hover card, navigation panel, Combobox / MultiSelect / TagInput lists, colour, date, range and time pickers, command palette) opened as a user opens it from its compact `overflow: hidden` card on the Stress page, at fine and (live) coarse: a DOM descendant of the card, in the top layer, past the clip box and taking a press there, resolving the card's `--ROW-H` / `--CONTROL-H` / `--R-SIZE-3`, its rows, day cells and frames at the card's tokens (tooltip and hover-card padding, colour-picker width and swatches too); an open Popover hides while its trigger is scrolled out of view and comes back anchored; at 375 the DateRangePicker's capped popup and a Dashboard row menu keep their own `--R-SIZE-2` from both edges of `clientWidth`, and a promoted panel's cap resolves against `100%`, never `vw` |
| `sweep-hit-areas.js` | sweep | primitives, form | at coarse input a lone IconButton answers outside its box, a dense toolbar never hands a press on one button to its neighbour, a checkbox's own box takes the press, stacked labelled checkboxes are a floor apart; at fine input nothing grows |
| `sweep-print.js` | sweep | all | Dashboard, Marketing and all-sections (`#/all`) pages printed (emulated) from a dark theme: white canvas, every text ≥ 4.5:1 on what prints behind it, shell chrome / menus / toasts / copy / pagination / drop zones and every `data-print="hide"` gone, table heads repeat and do not stick, nothing clipped, closed panels open, one tab per tab row, a VirtualizedTable without spacers and with its note, a windowed TreeView's rows in flow with its note; `page.pdf()` renders each to several pages |
| `stress-matrix.js` | sweep | all | the Stress page in every listed theme × 2 densities × fine/coarse × 1280/375 (fresh per width and rotating, the rest live): no error, no tripped panel, no sideways scroll, and no element whose child box or text line reaches past its own edges; every `KnownBug` repro listed in `KNOWN_BUGS` still reproduces (empty today) |
| `stress-density.js` | sweep | primitives, data, form | density re-derives at every nested boundary, both ways; the clipping card's native select is the compact `--CONTROL-H`; at coarse every row and control in the compact cards is at least 44px |
| `stress-contrast.js` | sweep | all | every visible text element on the Stress page, as painted (tints and washes composited), reads at 4.5:1 or better in a dark theme, menus and toasts open |
| `dashboard-layout.js` | page | navigation, data, charts, filters, toolbar, feedback, overlays | the Dashboard on every axis at 1440/375 (fresh per width and rotating, the rest live) without errors or sideways scroll; full sidebar / rail / no navigation of its own at 1440 / 900 / 375, measured inside the Dashboard's own frame; the frame covers the showcase's sidebar at 1440 and leaves the showcase's bottom nav clear at 375; KPI tiles in one row at 1440, the full sidebar's column exactly `--COLUMN-MD`, every KPI sparkline exactly `--SPARK-H` (shorter at compact); rows exactly the page's and the compact card's `--ROW-H`, the services rows with their actions button inside; Open incidents is a Timeline of four complete events; empty search and a toast work; the FilterBar drives the table, its count, the charts' series and the URL (a reload opens on it, Clear all writes an empty `time=`); the header Toolbar folds into More when narrow and its hit areas never overlap at coarse; DataTable features (columns menu, a pinned Service column, detail rows, bulk actions, 10 rows a page); the rollout ProgressRing at 31/50; the Banner's dismissal hands focus to the title; no card's ErrorBoundary tripped, and the FilterBar folded at 375 |
| `showcase-overview.js` | page | navigation | the paged Overview: the index loads no section and links the sidebar's groups; a group's page holds only its own sections (under half the scripts `#/all` loads), titled and current in the sidebar; its rail sticks beside the sections when wide and sits above them at 375; a section link lands under the header with its entry `aria-current`; a rail press glides there (positions in between, the rail holding the pressed entry throughout) and jumps under reduced motion; plain scrolling moves the mark to the section being read (kept in the rail's own view, the last on screen at the page's end, the first at the top); the pager opens the next group at its top |
| `navigation-shell-rail.js` | page | navigation | the AppShell rail, taller than the screen (the showcase shell at 700px tall): collapsed from the full sidebar it scrolls, never sideways, to its last link and its expand toggle (in view, hit, and it expands); the last link's label bubble is fixed, shown, centred on the link and `--R-SIZE-3` past it, in LTR and RTL; at 900 the rail (no toggle) scrolls to its last link; an AppShell inside another's main collapses and expands by its own toggle while the outer sidebar stays full |
| `marketing-page.js` | page | marketing, layout, motion | UI inside prose stays at `--CONTROL-H` and UI type on every axis; display type grows monotonically with no step at 640 (predicted from the token's clamp over the Hero's width); the hero is the library's Hero, display role and size, edge to edge; no sideways scroll at 375, the pricing table scrolling in its own frame with the feature column pinned; the transparent site header sticks under the showcase's bar (its `--r-marketing-site-header-top`), turns solid on scroll, slides fully past the bar when hidden and under it mid-slide (the page's `isolate`), and the hero pads by its height + `--SECTION-2`; anchors land at both bars' height (±1px) and leaving clears the scroll padding; a figure's picture in prose is flush with its Image box; the essay's reading bar sticks under the showcase's bar and fills |
| `boards-kanban.js` | component · touch | boards | Kanban: card padding follows density, wide columns within `--COLUMN-MD`…`--COLUMN-LG`, a narrow board snaps at 85% columns, a folded column is a strip; at coarse every card and collapse button meets 44px; at 375 no board spills and a card's content never reaches past it; by keys (the model is Kanban.test.tsx's) the drop line sits in the gap, RTL arrows reach the column drawn on that side and a keyed move scrolls its column into view; by mouse and touch: a few pixels before a drag starts, a top-layer preview under the pointer, the drop line in the gap, one commit on release, a drag from a button swallows its click, Escape cancels; edge scrolling (snap let go while dragging); touch scrolls when it moves first and picks up after a hold; forced colours draw the source, target and line without colour |
| `charts-interaction.js` | component | charts | charts at both densities × fine/coarse × 1280/375 in two themes (fresh per width and rotating, the rest live): plot height is `--CHART-H`, axis labels ≥ 10px, inside the chart and never overlapping; hover snaps the crosshair, the top-layer tooltip matches the table and nothing is announced; the visually hidden table is in the accessibility tree and "Show as table" draws it in place (keys, tap, captions and hostile data are charts.test.tsx's) |
| `commands-palette.js` | component | commands | CommandPalette: Ctrl+K opens the shell's palette, typing ranks, arrows + Enter run after it closes with focus home, a nested page and Backspace, Recent, an async page, a component's name at the root opens its section (its own, or the one that demos it), Escape; the compact card's palette hands focus back; the highlighted row has its accent bar, and under forced colours is the opaque system Highlight |
| `content-code.js` | component | content | the Dashboard requests no lowlight module; opening the content sections requests lowlight's core and exactly the grammars their blocks name plus what they embed (in the build: the grammar chunks fetched); tokens render; Copy puts the exact source on the clipboard and announces; tokens ≥ 4.5:1 as painted in the dark theme; at 375 nothing spills outside a scroller and long lines scroll then wrap; under forced colours tokens collapse to the block's ink, keeping weight, slant and the marked-line bar |
| `content-markdown.js` | component | content | hostile Markdown: no script-capable `href`/`src`, raw HTML as visible text, no tracking request; prose paragraphs on the prose scale while the CodeBlock keeps UI text and table rows `--ROW-H`; a task box sits inside its list's indent with the text on the list's column, at both densities; at 375 nothing spills past the section outside a scroller |
| `data-datatable.js` | component | data | DataTable: the columns menu in the top layer (a required column unavailable) hides a column, Escape closes it with focus home; a separator's value is its drawn width, min two `--CONTROL-H`, max `--MEASURE`, arrows / Home / End / double click; a drag widens by the pointer and stops at the min, mirrored in RTL, and in a table already at its own width widens the column by the full amount while its truncating neighbour keeps its min; pinned cells stay put and win hit tests while the table scrolls, the edge rule only while scrolled (and under forced colours); coarse handles 22px wide; detail rows expand and span the row; the bulk bar on the frame's bottom edge in the sticky layer, focus to select-all when the selection clears; filters narrow and clear; pages (the pager laid out after the range, inside the frame), rows per page and Next; at 375 + coarse the pager and bar stay inside the frame; at 375 every table head scrolled under the page's sticky header loses the hit test to it |
| `data-timeline.js` | component | data | Timeline (its list semantics are Timeline.test.tsx's): Tab onto a `<time>` shows its full reading in a describing Tooltip; sticky day headers in its own scroller; toned events have a glyph and a word, stateless a dot, and glyph, edge, dot and connector survive forced colours; compact is shorter; nothing wider than its box at 375; the rail is on the inline start in RTL; every thread (icon→dot, dot→dot, dot→icon) is mark · gap · line · gap · next mark, the gap `--R-SIZE-6` from each mark's drawn edge (±1px), at comfortable and compact, LTR and RTL, and the last event draws no line |
| `data-virtualized.js` | component | data | VirtualizedTable, 10,000 rows: a row is exactly `--ROW-H`, scroll height = rows × row height + head, the last row mounts at the end, and a live input switch and a stylesheet that retunes `--ROW-H-COMPACT` (no attribute moves) both re-measure; on the Stress page a table whose own density flips mid-scroll shows exactly the rows its scroll position predicts, both ways |
| `dates-pickers.js` | component | dates | a day cell is `--CONTROL-H`; keyboard across a month boundary; a range by keyboard; locale typed entry and a refusal; the range popup's trigger at the compact card's `--CONTROL-H` and Clear / Cancel / Apply on one footer row, Clear at the start; at 375 one month and inside the viewport |
| `dates-time.js` | component | dates | TimeField: the frame is `--CONTROL-H`; digits type and move on ("9" completes the hours), End/ArrowUp wrap without carry, Backspace empties and the form submits nothing; 12-hour "1030p" submits 22:30; the focused segment's band and the frame's ring, the band kept under forced colours; a refused time's hour segment is invalid and described; RTL keeps the hours left; compact card frames are the card's height; at coarse every segment ≥ 44px, apart, and hit at its centre; no spill at 375. TimePicker: the list opens centred on the value (96 options at a 15-minute step); keys and typed digits move; Enter chooses and the form saves. DateRangePicker `withTime`: the wire carries local instants with their offset, a preset submits two instants 24 hours apart; at 375 the panel fits; at coarse the options are 44px and the list button answers a press 20px off its centre |
| `dates-event-month.js` | component | dates | EventCalendar month view: a lane is max(1lh + 2 × `--R-SIZE-6`, `--HIT-MIN`) (predicted, then read); chips while the calendar is at least `--MEASURE` wide, a multi-day bar spanning exactly its days' cells, chips one lane apart and "+n more" in the last lane; mirrored in RTL (and ArrowLeft goes forward); dots inside `--COLUMN-LG`; the day panel in the top layer under its cell, Escape home; PageDown / ArrowDown / Shift+PageUp keep focus in the grid that shows the day; coarse lanes `--HIT-MIN`; forced-colour chip edges, today's badge and a solid focus ring; at 375 dots, the panel inside the viewport, nothing past its cell |
| `dates-event-timegrid.js` | component | dates | EventCalendar week and day: an hour is 2 × `--ROW-H` (shorter compact), a block's top and height match its minutes, Thursday's overlapping meetings side by side inside their day, the now line at 10:40, scrolled to 08:00 under the header on load; the header sticks and paints over the days, End scrolls its block clear of it; at 375 the grid scrolls sideways (the page does not) with the gutter stuck and painted over the days; coarse targets ≥ `--HIT-MIN`, overlapping blocks too; RTL gutter on the right; forced-colour block edges, the now line and a solid ring |
| `dates-event-agenda.js` | component | dates | EventCalendar agenda and toolbar: rows at least `--ROW-H` (a one-line event included; `--HIT-MIN` at coarse); the time beside the title in one column when wide, above it at 375; nothing past its box at 375 and the long title wraps; linked events are real anchors; the toolbar wraps at 375 with Today, previous and next exactly `--CONTROL-H`; the view switch to the agenda and back; an empty month's empty state, and the loading demo busy with no empty state; forced-colour glyphs and marks (slot-less too); RTL time on the right; no sticky day header in print |
| `dates-event-slots.js` | component | dates | EventCalendar slot cursor: a slot row is (2 × `--ROW-H`) × slotMinutes/60 and the cells line up with the day columns and hour lines; Tab reaches the slot grid and arrows move a visible ring; Shift+arrows and Enter pick the range the state output shows, its draft pieces over exactly those slots, one per day over midnight; a mouse drag picks 10:00–12:00 and across days; a press on an event does not pick; Escape clears; dragging to the region's edge scrolls it and extends the draft; RTL; coarse; forced colours keep the draft edge and the ring |
| `dates-event-edit-timegrid.js` | component | dates | EventCalendar time-grid editing: a block dragged to another day and slot (the draft at the target, the source faded) is moved there once; the bottom grip resizes (shown on hover, after its fade); an all-day bar moves by days and its end grip resizes; a non-editable event does not move; Space, arrows and Enter move a block with focus kept on it, and Space never clicks it; Escape cancels; edge scrolling during a drag; coarse grips inside their event; forced colours; RTL |
| `dates-event-edit-month.js` | component | dates | EventCalendar month editing: a drag across days picks them (the draft over exactly those cells); a press without moving opens the day panel and its New event picks the day; Escape clears; a chip dragged to another day moves there keeping its time; an all-day bar's grip extends it; a non-editable event stays; coarse grip ≥ `--HIT-MIN` inside the bar; forced colours; an RTL drag runs back in time |
| `dates-event-pick-panel.js` | component | dates, overlays | EventCalendar's `renderSelection` with a `Popover` at the pick (`anchor`): a mouse drag opens the panel in the top layer beside the picked range's piece with focus in it; scrolling the time grid moves the panel with the range; a title and Enter add the booking at the picked slot and close it; a keyboard pick opens it too and Escape closes it, clears the pick and hands focus back to the slots; at 375 the panel falls back below the pick and stays inside the viewport |
| `dates-event-details.js` | component | dates, overlays | EventCalendar's `renderEventDetails` with a `Popover` at the event: a press on a month bar opens the app's details beside it (its own fields: owner, attachments, a runbook link) with focus in them, Escape hands focus back to the bar; a week block's details follow the grid's scrolling; at 375 an event opened from the day panel gets details inside the viewport |
| `dates-event-delete.js` | component | dates, overlays | EventCalendar's `onEventDelete` as the editable demo answers it: Delete on a focused block removes it, a real toast says so with Undo, and focus stays on an event; Undo draws it again at its time; an `editable: false` event says no key and Delete leaves it |
| `disclosure-accordion.js` | component · timing | disclosure | Accordion rows are exactly `--ROW-H` (comfortable, compact, coarse); arrows / Home / End / Enter on real keys, the disabled last header crossed both ways; the panel's height animates open and closed and is instant under reduced motion |
| `feedback.js` | component · timing | feedback | ProgressBar: a determinate bar fills its share and says what it shows (floored, never 100% early); the indeterminate sweep moves, and under reduced motion runs no animation and stands still, striped across the track, beside its word; a sticky Banner on its scroller's top edge at `--LAYER-STICKY` |
| `filters-bar.js` | component | filters | FilterBar on the dashboard demo: it opens on its sample URL (chips in option order, the query line, the count equal to the table's own total, spoken politely); Clear all by Enter empties it, focus on the first control, the count shown at once and spoken once settled; a keyboard-only pass through every control (combobox, toggles, range thumb, date presets, search) gives five chips in definition order and the query line; Tab reaches each chip's remove button, Enter and Delete remove with focus on the chip that took its place, and the last one's removal empties its control |
| `filters-layout.js` | component | filters | FilterBar by its own width: the time range has the search field's frame, its value at the content start and the calendar alone at the end; a narrow box folds into "Filters (n)" with chips and count still drawn; its modal drawer (in place, top layer, inside the viewport) holds the same filters in order and edits them by keys, Escape returns focus; Clear all lands on the first drawn control; RTL remove on the inline end; compact + coarse chips a whole `--CONTROL-H` line apart, each remove button taking a press at its centre; at 375 no bar draws past its box or the page, long chips truncate, and the drawer does not scroll sideways |
| `form-avatars.js` | component | form, primitives | AvatarUpload with a real image and canvas: a refused type describes the button, the crop at zoom 2 proven on pixels, the progress ring over the stage, cancel and failure with focus on the next action; AvatarGroup overlaps by a quarter of `--CONTROL-H` (mirrored in RTL), its "+n" names the rest and `renderOverflow`'s popover lists them; coarse sizes, no spill at 375, the chip's edge under forced colours |
| `form-colorpicker.js` | component | form | ColorPicker (entry, gamut and refusal are ColorPicker.test.tsx's): the area and hue thumbs move by keys (value, thumb and hidden input follow); swatches are one radio tab stop; the contrast readout matches an independent computation against the theme surface as painted; coarse hit areas; forced-colour edges (the checked swatch's differs) |
| `form-fileupload.js` | component | form | FileUpload (its flows are FileUpload.test.tsx's): one named zone; a real PNG through its file input is listed; at 375 + coarse every zone ≥ 44px, a remove button answers its hit area, nothing spills |
| `form-otpinput.js` | component | form | OTPInput (keys and paste are OTPInput.test.tsx's): one named textbox; the masked PIN and a plain recovery code, focused with a box selected, paint no ink they lack with the input at opacity 0 (screenshots decoded in the page and compared per pixel, over 16/255 counts as ink; the pair is retaken if the row moved between its shots), plain and under forced colours, with a positive control (inked input text changes the shot); at 375 + coarse every box ≥ 44px and nothing spills |
| `form-selection.js` | component | form | Combobox, MultiSelect and TagInput in a compact clipping card (the key models are the unit tests'): two-line options at least the card's `--ROW-H`; at 375 and coarse, chip rows a whole number of `--CONTROL-H`, every target ≥ 44px and a chip's remove button answering its hit area; a MultiSelect narrower than `--COLUMN-MD` folds into "n selected", which ArrowLeft reaches, Enter unfolds (focus on a remove button), and which answers the 44px floor at coarse |
| `form-sliders.js` | component | form | Slider (key steps and commits are Slider.test.tsx's): a drag moves to the pointer, follows past the rail's end and commits once on release; the bubble shows after a key; RTL ArrowLeft raises; mark labels centred on their ticks, the end labels flush; vertical ArrowUp raises. RangeSlider: thumbs push and never cross, by drag and by keys, in RTL too. Rating: presses pick half or whole, hover previews, an empty submit focuses it invalid, read-only images named by value; the filled star is the rating pair, not the accent, in a light and a dark theme. Compact thumbs are smaller; at coarse + 375 a thumb answers 20px from its centre and nothing scrolls sideways; forced colours keep the fill (Highlight), the thumb and track edges, a star's CanvasText fill beside an outline-only empty star (compared as painted pixels), a disabled rating's GrayText fill |
| `form-state-submit.js` | component | form, layout | the empty submit focuses the first invalid field in DOM order, described, with an error summary in page order; a summary link focuses its field clear of the sticky row; a fix clears its error; the async check's pending state and answer; a server error by path; the long form's row sticky at the sticky layer; the FormActions demo's ScrollPanel scrolls only its body, the footer outside it on the panel's bottom edge at both ends of the scroll; at 375 / compact / coarse nothing scrolls sideways and the actions stack |
| `form-text-inputs.js` | component | form | PasswordInput keeps value, focus and selection across show/hide (by press and by key; Chromium resets a swapped field's selection on its next style update), its strength segments painted filled and empty; MaskedInput's caret on insert, delete, paste and a refusal, RTL; at coarse + 375 `--CONTROL-H` is 44px, the toggle's hit area ≥ 44px, nothing spills; forced-colour strength segments (strength scoring and CurrencyInput are the unit tests') |
| `layout-splitter.js` | component | layout | Splitter: separators named and valued from their panes, panes drawn at the shares; a drag follows by pointer capture and stops at a token minimum; Home/End/arrows; Enter collapses (inert) and restores; RTL; stacked; nested splitters move independently; a controlled sidebar; the gutter is `--R-SIZE-5` and its hit area meets the floor (24 fine, 44 coarse) without growing; at coarse + 375 nothing scrolls sideways |
| `layout-container.js` | component | layout | a Container (page, measure, full; no gutter with `px-r4`; the gutter replaced by `px-r1`; a Grid of Cards inside) in a block, a Stack, an Inline and a grid cell at 1440 and 390: with the gutter its content is min(parent − 2 × `--GUTTER`, its cap) ±1px; every one fills its parent up to its max-inline-size, centred, inside its parent with every card inside its content box, no frame or page scrolling sideways; the Grid inside draws the columns its own width asks for |
| `layout-prose.js` | component | layout | a Prose article is exactly --MEASURE of its own body text wide (the region carries the body size), holds the same number of body characters at comfortable and compact, keeps its Button at --CONTROL-H in UI text and its `data-not-prose` note in UI text; the Typography section's prose-sizes block matches the article |
| `marketing-carousel.js` | component · timing | marketing | Carousel: per view by its own width (three in the page's column, one in a narrowed column and at 375), one-slide steps, keys, every slide reachable, no default autoplay, opt-in autoplay paused by hover and reduced motion (on a faked clock), RTL; two quick presses on the dots during a smooth scroll land on the third slide; every track computes `scrollbar-width: none` (a demo frame keeps its bar) yet still scrolls by wheel, shift + wheel and a touch swipe (real touch events in a second, touch-enabled context), prev / next and the status stay, forced colours keep the controls |
| `marketing-features.js` | component | marketing | FeatureRows alternate by grid placement only (DOM text then media); HowItWorks a row or a column by its own width, connectors `--R-SIZE-5` clear of each marker, row titles on one line, markers and lines kept under forced colours, RTL; FeatureGrid columns by its own width and stretched links that hit-test as one; the CallToAction band edge to edge with a fill (at 1280 and 375); EmailCapture inline at its own width (the wide form one row, the `--COLUMN-MD` one stacked) |
| `marketing-footer.js` | component | marketing | Footer: named column, legal and social landmarks; wide columns side by side, narrow by the footer's own width folds them into an accordion (click and Enter); German and Arabic through the LocaleProvider; coarse floors, social links a floor apart answering their hit areas, no spill at 375; print keeps the copyright and legal row only |
| `marketing-hero-backdrop.js` | component | marketing, motion | Hero's backdrop covers the hero's padding box and is clipped to it (a probe taller than the hero, with the demo frame's clip lifted, does not hit-test past the hero's top); it paints under the content (with the backdrop made hit-testable, the title and action still hit themselves) and a real press reaches the action; aria-hidden, inert, no pointer; the Parallax inside drifts shift × (2p − 1) with the page and is still under reduced motion; gone under forced colours and print; covers at 375 |
| `marketing-logocloud.js` | component · timing | marketing | LogoCloud: image logos `grayscale(1) invert(0)` on a light scheme and colour on hover, wordmarks in the secondary ink; the marquee moves toward the inline start at its speed (mirrored in RTL), copies `aria-hidden` and `inert`, clipped with no scrollbar; held by the toggle, hover and focus; keyboard focus brings each link into view and holds it; a static wrapped grid under reduced motion; coarse toggle; no logo cloud past its demo at 375 |
| `marketing-mediacard.js` | component | marketing | MediaCard: two tab stops per card, the whole card hit-tests to its link, the save action takes its own press, a lazy 16:9 image, hover lifts and firms the edge (the edge alone under reduced motion) |
| `marketing-pricing.js` | component | marketing | Pricing: one polite announcement per billing change naming every plan's price; the highlighted card's doubled edge and words (forced colours too); with one card's description made three lines longer, the price and action rows still line up (subgrid); coarse segments answer presses across their 44px frame and actions are 44px; one column at 375, nothing past its demo. PricingTable: its own scroller; scrolled down, the head stays on the frame's top and hit-tests over the body, its corner over the pinned column too; at 375 the table scrolls sideways in its frame with the feature names pinned and hit-testing to themselves (mirrored in RTL); explanations by Tab (a describing tooltip, Escape keeps focus), by hover and by a press at once. Testimonial: a figure with one blockquote and a named caption, `<cite>` the work (never a person) with the blockquote's `cite`, a rating named by value; the language's quotation marks; a grid of cards equally tall with captions level; each carousel slide filled to full height; coarse avatars; nothing past its figure or demo at 375 |
| `marketing-siteheader-layout.js` | component | marketing | SiteHeader by its own width (wide and folded in one viewport); the menu drawer (modal, top layer, the same links as the wide header, Product open on the current page, Escape and following a link close it); hide-on-scroll in its own scroller (never while focus is inside; instant under reduced motion); transparent → solid with its items ≥ 4.5:1 on what paints behind them, default and a dark theme; coarse floors; at 375 every frame folded, nothing spills, the drawer fits (from the left in RTL); the headers do not print |
| `marketing-siteheader-menu.js` | component · timing | marketing | NavigationMenu in the SiteHeader demos at 1440: disclosure semantics (no menu roles, `aria-expanded`, panel after its button, top layer); a mega panel spans the bar; real keys (Tab into and out of panels, Escape home, arrows along the bar and down, RTL); one panel at a time; hover intent (nothing in 60ms, open by 1s, not before 120ms), the bridge over the gap, a warm switch to the next panel timed in the page under 120ms; the current page's accent bar; compact rows are the compact `--ROW-H` |
| `media-image.js` | component · timing | media | Image: the file's ratio at its cell's width; "Load again" with the pictures held back goes pending → loading → loaded with every box the same size and nothing below moving (no layout shift); the blurred preview over the colour while loading, a cross-fade after, opaque and still two frames after loading under reduced motion; failures keep the glyph and alt in a box of the file's ratio; forced-colour outlines; no spill at 375 |
| `media-lightbox.js` | component · touch | media | Lightbox: thumbnails name their pictures; a modal named viewer opens on the pressed picture with focus on Close and its neighbours preloaded and the next ones out not; arrows, Home and End, Next disabled at the end; touch swipes (a vertical one does nothing); Escape hands focus back; RTL keys, sides and swipes mirror; a controlled open from another button; reduced motion; at 375 + coarse it fits with `--R-SIZE-2` gutters and its controls answer their hit areas |
| `media-masonry.js` | component | media | MasonryGrid: the column count the token floor predicts for the grid's own width; every item directly under the previous one in its column, none overlapping, tops never decreasing in source order; fewer columns as the container narrows (packed again each time); boxes the same before and after their pictures load; RTL starts on the right; Tab order and the Lightbox follow the source; nothing past its own box at 375 |
| `motion-extras-count-up.js` | component · timing | motion | CountUp below the fold waits on its start, counts in formatted frames that never fall once in view, keeps a fixed width and reads only the final value throughout, takes about its token duration and lands on the exact formatted value; every figure (percent, compact currency, unit, German, missing) ends exact; reduced motion shows the final value at once |
| `motion-extras-parallax.js` | component | motion | Parallax in its section (its frame `open`): the layer runs its view timeline, `translate` = shift × (2p − 1) at four scroll positions (p from geometry, ±2px) and grows as the page scrolls, the layer covers the box and is the box plus twice the shift, layout and hit tests never move (the box is hidden and inert); `--PARALLAX-SHIFT` is `--MOTION-DISTANCE-LG` × 4 by default and a theme-like override moves it; no motion component registers a scroll listener (a build's stack frames read through its source maps); still under reduced motion (override included); no spill at 375 |
| `motion-extras-reading.js` | component | motion | ReadingProgress in its own scroller: the fill's drawn share and `scale` equal the share predicted from geometry at five positions (the `contain` range), the bar sits on the scroller's top taking no space (the heading starts where it does) and no press, hangs from the right in RTL and is thinner compact, keeps tracking under reduced motion, paints a visible colour under forced colours and is not printed |
| `motion-extras-spotlight.js` | component | motion | Spotlight follows a real mouse (custom properties and the gradient's centre), goes out on leave; every text on the card keeps 4.5:1 under the wash in every theme (composited on a canvas); nothing on a touch move, the View's coarse input, a real touch context (`(pointer: coarse)`, `(hover: none)`), reduced motion, forced colours or paper; no spill at 375; the shares are registered and do not inherit (the card computes 0.5 at rest; every child stays at 0.5 while lit) |
| `motion-view-transitions.js` | component | motion | the View transitions demos, read while each runs: the library hook's layout switch captures its six cards; the drill-down, price roll, feature tour and theme reveal each capture only their own elements and the page, run their own animations (a morph over an instant page swap, roll and slide keyframes, a reveal from the press), carry their direction or origin on `<html>` and remove it after, and land where they say (focus into the panel and home again); under reduced motion every press applies at once, with `data-sc-vt` at no frame |
| `motion-overlay-exit.js` | component · timing | overlays | Popover and Dialog stay painted, inert and fading for some frame after they close, focus is home at once, both are gone within 1s; the popover fades in too; under reduced motion the close is instant; a dialog opens on its `autoFocus` control (one that is not its first focusable) and the alertdialog on its Cancel; Escape closes a hover-opened Tooltip while focus stays in a field; a toast's Dismiss hands focus to the next toast and the last one's back to its trigger; a dismissed toast slides out before its slot collapses, the toasts above glide (no jump at unmount), and under reduced motion it is gone within 100ms |
| `motion-scroll-reveal.js` | component · timing | motion | a ScrollReveal card below the fold starts hidden, fades in when scrolled into view and stays revealed; under reduced motion it is shown from the start |
| `navigation-focus.js` | component | navigation | two-page Pagination hands focus from the arrow it disables to the other one and back, link mode does at the last page; a Tabs whose selected tab is disabled has exactly one tab stop, the first enabled tab, and Tab lands on it |
| `navigation-tree.js` | component | navigation | TreeView: a row is exactly `--ROW-H` (with control-height actions in it), each level indents `--R-SIZE-2` (mirrored in RTL), the chevron turns (at rest, after its transition); compact rows shorter; at coarse + 375 rows ≥ 44px, presses 20px off a chevron's centre toggle it, nothing spills and a long name breaks; forced colours keep the selected fill, checked box and current bar Highlight; a checked box in `--C-ACCENT`; a real press on an ancestor's chevron leaves focus on it; RTL draws the chevron right of its label; a 2,550-row windowed tree mounts under 200 rows, End reaches the last, in view, at `--ROW-H` (the keyboard model, checks, lazy rows and links are TreeView.test.tsx's) |
| `overlays-context-menu.js` | component · touch | overlays | ContextMenu: right-click opens at the pointer, Shift+F10 at the focused element with focus back on Escape; a Dashboard row's DropdownMenu and ContextMenu list and walk identically; a row menu acts on its row and the head opens none; a long press opens it and keeps focus in it after the release, a moving touch does not; under forced colours the focused item is Highlight and the next is not |
| `overlays-hovercard.js` | component · timing | overlays | HoverCard: opens after its delay (not before), a group named by its trigger, in the top layer; the pointer crosses the gap into it and it stays; Escape from anywhere closes a hover-opened card; keyboard focus opens it without moving focus, Tab walks in and out, Escape returns to the trigger; the touch toggle; at 375 it keeps `--R-SIZE-2` from both edges |
| `overlays-toast-bottomnav.js` | component | overlays, navigation | on the showcase's shell at 375: the published inset equals the bottom nav's height, and the toast stack ends `--R-SIZE-2` above the nav's top edge (comfortable, compact, and again after a resize to 1280 and back); every nav link stays pressable; at 1280 the inset is gone and the stack keeps its old offset |
| `preferences-fonts.js` | component | preferences | a theme that names web faces gets them (picked by its faces: each one LOADED in `document.fonts`, body and heading resolve to them); the default theme downloads neither |
| `steps-wizard.js` | component | steps | Stepper marker = `--ICON + 2 × --R-SIZE-5`, Next = `--CONTROL-H`; horizontal steps equal, each label centred under its marker and inside its step (an unbroken word breaks), each line level with the markers and `--r-steps-pad` from both (in RTL too), ends inset; Next by mouse and by Enter focuses the new step's heading with no ring; a narrow container collapses it (the compact Wizard at 375 too); compact markers are smaller; five forced-colour states differ (the flow, focus and server check are Wizard.test.tsx's) |
| `toolbar.js` | component | toolbar | Toolbar overflow: in a narrow box the trailing movable units leave for More (the pinned Select stays), More lists them in bar order and acts; they come back when it widens; at coarse the gap is the whole hit-area overhang and no two hit areas overlap, a press 1px inside each edge reaches its control; at fine the gap falls back; at 375 + coarse no toolbar spills (hidden units included); squeezed beside a growing sibling it keeps its pinned unit and More whole inside it; real Tab enters on the one stop and the next leaves; in RTL every control is drawn left of the one before it and ArrowLeft reaches the second (the keyboard model is Toolbar.test.tsx's) |

A new script is an `async (page) => { … }` expression, opening with its tags, that starts
from `page.url()`. It never waits a fixed time for something it can see: a timer is run
forward on `withClock`, an animation is waited out with `settle`, a state change with
`waitForFunction` (bounded by the time the claim allows). A fixed wait stays only for an
absence that needs the time (nothing opens before a delay) and says so. It does not re-assert
what the sweeps hold for every section in every View: no sideways spill at rest, the coarse
floor, `--CONTROL-H` heights (sweep-overview), a floating panel's escape from a clipping
compact card (sweep-floating). A check of a section opens it with `openSection` (never `#/all`: it
lays out every section, and each load costs seconds), loading the View its
claim depends on, and switches further Views live with `setView` rather than reloading. A
whole page (Dashboard, Marketing, Stress) is loaded with `openPage`. It validates its
harness against one value it can predict from source. It counts a list before taking its
minimum or calling `every` on it (`Math.min()` of nothing is `Infinity`), and a check for an
absence first proves the selector matches something. The runner resets the View after it.

## Testing

Integration over mocks: render the real component, drive it with
`@testing-library/user-event`, assert what a user perceives (roles, names, focus). Never
`|| true` in an assertion and never an assertion behind an `if`. jsdom computes no
layout and loads no CSS; anything about size, colour or paint is a Playwright check
against the showcase, not a vitest test.
