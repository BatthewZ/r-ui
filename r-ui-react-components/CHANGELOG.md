# Changelog

All notable changes to `@batthewz/r-ui-react-components`. Breaking changes to the domain
tokens or the public surface are versioned events and are recorded here.

## Unreleased

### Verification

- Data, charts, navigation: `Meter`'s default text reads an over-range value's real share ("140%", only the fill clamps); `Timeline` with `pageSize` shows the events a "Show more" press loaded remotely, and renders an epoch number outside the `Date` range as a missing time instead of throwing; `Pagination` reads a `NaN` or fractional `page` / `pageCount` as a whole page in range; a pinned chart `max` drops the gridline multiple that crowded it (1000 beside 1024); `Sparkline` draws a span wider than a double without a NaN path.
- Util, hooks: `formatPercent`, `formatCompact` and `formatBytes` accept a `minimumFractionDigits` above their one-digit default instead of throwing, and `formatBytes` steps up a unit when rounding reaches 1024 ("1 MB", not "1,024 kB"); `mergeRefs` (and so `mergeProps` and every component that merges a forwarded ref) runs a React 19 callback ref's returned cleanup on detach instead of dropping it; `useVirtualRows` (and `VirtualizedTable` with `overscan={0}`) mounts the partly visible last row when scrolled mid-row.
- Overlays, commands: `Dialog.Content` keeps a caller's `aria-labelledby` / `aria-describedby`, and an `id` on `Dialog.Title`, `Dialog.Description` or `DropdownMenu.Trigger` no longer unhooks the name or description (the generated id wins); a toast dismissed with focus on it no longer leaves every later toast paused; a `ContextMenu` opened by the platform's own long press is no longer reopened by ours (which sent focus back into the closed menu); a `CommandPalette` page never lists the previous page's search results or searches with its query.
- Form: a submit that waited on a field check re-checks a value typed meanwhile instead of submitting it unchecked (also `validatePaths`); a field-array row keeps its `Field validate` error through a move or a removal; `NumberInput` shows the committed (rounded, clamped) value after Enter, and focusing and leaving it without an edit no longer re-reads a display rounded by `formatOptions` into the value; `SearchInput` binds to a `Form` through `Field name` like every control; a `FileUpload` row keeps focus when the upload it was on finishes (its Remove button).
- Content, dates, steps: `Markdown` keeps the text between two HTML comments when the second ends a later line, parses long paragraphs, runs of unclosed `[a](` and of unclosed `<!--` in linear time instead of hanging, and no longer loads an allowlisted image from another host through `/\host/…` (nor throws on a root-relative `src` that does not parse); the date components format and read the Gregorian calendar in every locale (`th-TH` no longer types a Buddhist year that reads back 543 years late, `fa-IR` no longer labels a Gregorian month with a Persian name); a `Stepper.Step` whose `href` `safeUrl` refuses is a button instead of an `<a>` no keyboard can reach.
- Router: `isExternalHref` resolves an href as a browser does, so `/\host`, `\\host`, `///host` or ` //host` (another host to a URL parser) is external: `Link` and every routed navigation part render it as a plain `<a>` instead of the router's link, and `Markdown` opens it in a new tab with the glyph and description.

### Breaking

Since the round-one surface (recorded below under "Added"):

- `useDocumentTitle(title, { base, separator })` (or a `DocumentTitleProvider`) replaces the
  hard-coded "AI Site Starter" base; with no base the title is exactly `title`.
- `useTheme` stores one JSON object (theme, density, input) under
  `localStorage["r-ui:preferences"]` or your `storageKey`, and saves the default theme too.
  The `STORAGE_KEY` export is gone (use `PREFERENCES_STORAGE_KEY` or pass `storageKey`), and
  so is the `/hooks/use-theme` subpath (now `/hooks/use-preferences`).
- `StatCard`: `labels` (`good`, `bad`, `neutral`, `stale`) replaces `sentimentLabels`, and
  the sentiment word ("better" / "worse") is now visible beside the delta, not only spoken
  (`labels={{ good: "", bad: "" }}` drops it).
- `lowlight` and `highlight.js` are regular dependencies (the optional `lowlight` peer is
  gone): an app without them failed its build at the dynamic import. Nothing to install.
- Requires `@batthewz/r-ui-css` with literal container sizes (`@max-column-md:` and friends
  compile), the status-text and descendant-focus remaps in its forced-colors fill
  companions, and `--SCHEME-DARK` following the forced palette.

Round 3:

- Requires `@batthewz/r-ui-css` with the print contract (`data-print`, the paper palette);
  a theme of your own may no longer use `!important` (its check fails, and an important
  theme value would outrank print, reduced motion and forced colours).
- `CommandPalette` and `useCommandPaletteShortcut` live in a new `commands` group
  (`@batthewz/r-ui-react-components/components/commands`), not `overlays`: the palette
  builds on overlays (Dialog) and form (Input), and form already builds on overlays. The
  root import is unchanged.
- `FormActions` keeps a pointer press on its buttons from taking focus out of the field
  being edited (a blur-time error moved the row under the pointer and the click was lost).
  Focus moves where the action sends it (a submit focuses the first invalid field); a
  caller's `onMouseDown` that prevents the default opts out.
- `FormActions` and `CopyButton` do not print; `Card` avoids a page break inside
  (`data-print`, overridable by passing your own).

Round 4 (verification fixes; the package's first version is now `0.1.0`):

- **Packaging.** `@batthewz/r-ui-css` (`^0.1.0`) and `tailwindcss` (`^4`) are peer
  dependencies: install them in the app (they were a nested dependency and missing). The
  direct `clsx` and `tailwind-merge` dependencies are gone (`cn` comes from
  `@batthewz/r-ui-tw-merge`). Source maps no longer embed the sources (`src/` ships beside
  them). New: `LICENSE`, the `./theme-script` subpath (the React-free pre-paint helper, for
  build tools), and the `r-ui-domain-contrast` bin.
- **One `labels` prop.** Every component's own words come in `labels` (any subset, typed
  `LabelsProp<XLabels>`, merged over an exported `DEFAULT_X_LABELS`; a map such as the tone
  words merges key by key, and `undefined` keeps the default). Renamed:
  - `messages` → `labels` and `XMessages` → `XLabels` on `Combobox`, `MultiSelect`,
    `TagInput`, `FileUpload`, `OTPInput`, `Stepper`, `Wizard`, `CommandPalette`;
    `STEPPER_MESSAGES` → `DEFAULT_STEPPER_LABELS` (`StepperLabels` gains `progress`).
  - `NumberInput` `incrementLabel` / `decrementLabel` → `labels.increment` / `.decrement`;
    `SearchInput` `clearLabel` → `labels.clear` (its default name and placeholder are
    `labels.search`).
  - `Dialog.Content` / `Drawer.Content` `closeLabel` → `labels.close`.
  - `ToastProvider` `label` → `labels.region`, `dismissLabel` → `labels.dismiss`,
    `toneLabels` → `labels.tones`; `ToastTone` is removed (use `Tone`).
  - `Alert` `dismissLabel` → `labels.dismiss`, `statusLabel` → `labels.tones`; `Meter`
    `toneLabel` → `labels.tones`.
  - `Link` `newTabLabel` → `labels.newTab`; `AppShell` `skipLinkLabel` → `labels.skipLink`;
    `Breadcrumbs` `label` → `labels.nav` (or `aria-label`), `expandLabel` → `labels.expand`.
  - `DataTable` / `VirtualizedTable` `selectAllLabel`, `rowActionsLabel`, `loadingLabel` →
    `labels.selectAll`, `.rowActions`, `.loading` (new: `selectRow`, `empty`).
  - `DensitySwitcher` / `InputSwitcher` / `ThemeSwitcher` `label` → `labels.density` /
    `.input` / `.theme`; their old `labels` map → `labels.densities` / `.inputs`.
  - Chart summaries ("Line chart", "Bar chart") moved into `ChartLabels` (`kinds`,
    `cartesianSummary`, `heatmapSummary`, `timeCorner`, `value`).
  - `CarouselLabels` fields are required in the type (the prop still takes any subset).
- **Tone words** come from one shared set (`TONE_LABELS`), unpunctuated: Toast adds its own
  ": ". Changed defaults: `Alert` info "Information" → "Info" and neutral "Note" → silent;
  `Meter` "Healthy" / "Critical" → "Success" / "Error". A `serious` toast is assertive and
  stays until dismissed, like `error`.
- **Destructive actions.** Menu items take `variant="default" | "danger"` instead of
  `tone="neutral" | "error"` (`data-variant`, was `data-tone`); `IconButton` gains
  `variant="danger"`.
- **Disabled menu items and commands are focusable** (`aria-disabled`; arrows land on them,
  activation does nothing). Listbox options (`Combobox`, `MultiSelect`) still skip disabled
  options.
- **`className` is the root.** `ColorPicker`: `className` moves from the trigger to the
  root, `classNames.root` is removed, `classNames.trigger` added. `DatePicker`: `className`
  moves from the frame to the root, `classNames.root` is removed, `classNames.button` →
  `classNames.trigger`, `classNames.frame` added. `DateRangePicker`: `className` moves from
  the trigger to a new root `div`, `classNames.trigger` added.
- **Controllable popups.** `ColorPicker`, `DatePicker` and `DateRangePicker` take `open`,
  `defaultOpen` and `onOpenChange`.
- **Dates.** `Calendar` `onValueChange(date: Date | null)`; `CalendarLabels.selected`.
  `DateRangePicker` `onValueChange(value: DateRange<Date> | null)`, `null` from a new Clear
  button (labels `clear`, `placeholder`); `DateRangeValue` is removed in favour of
  `DateRange<Date>`, and `DateRange` is `DateRange<TDate extends Date | null = Date | null>`
  with an optional `preset`.
- **`Select`** gains `onValueChange(value: string)`; `value` / `defaultValue` are strings.
- **`DataTable`** `getRowKey` receives the row's source index, not its sorted position.
  **`StatCard`**: a delta that formats as 0 is flat (no arrow, no hue, no verdict).
- **Ids.** A caller's `id` on `Dialog.Title`, `Dialog.Description` or `DropdownMenu.Trigger`
  is rendered and keeps the name (reverses the Verification entry above, which ignored it).
  A `Popover` panel is named by its trigger unless labelled.
- **Hooks.** `usePanelTransition` (and its types) is removed: nothing used it.
  `useActiveSection(ids, options?)` takes its observer margin as an option (default
  `0px 0px -40% 0px`, was a hard-coded 80px header); `UseActiveSectionOptions`.
  `useRovingFocus` mirrors the arrows under `dir="rtl"` and passes over natively disabled
  items.
- **Themes.** A theme that sets a domain size's selected name (`--CHART-H`, `--SPARK-H`…)
  instead of its per-density names now fails `verify:domain-contrast` (and the bin).
- Requires `@batthewz/r-ui-css` with `--LINK-UNDERLINE-OFFSET` (`Link`'s underline offset
  reads it).

### Added

#### Package

- Scaffold: Vite library build (ESM, preserveModules, .d.ts), vitest + jsdom, narrow ESLint
  (no inline suppressions), strict TypeScript. Requires `@batthewz/r-ui-css` with `hit-area`,
  `--PAGE-MAX` and `--COLUMN-SM/MD/LG`.
- Component groups `primitives`, `form`, `overlays`, `data`, `navigation`, `layout`, each
  with its own barrel and stylesheet; `src/index.ts` and `src/styles.css` aggregate them.
- Hooks carried over from the previous generation: `useFloating` (now renders in place and
  promotes to the top layer, never portals; hides the panel while its anchor is scrolled
  out of view), `useControllableState`, `useRovingFocus`, `useFocusTrap`, `useLightDismiss`,
  `useClickOutside`, `usePanelTransition`, `useVirtualRows` (clamps its window when the row
  height shrinks under a scrolled list), `useMediaQuery`, `usePrefersReducedMotion`,
  `useDebounce`, `useDocumentTitle`, `useActiveSection`, `useTheme`.
- Utilities: `cn` (domain-aware), `SlotClassNames`, `mergeProps`, `mergeRefs`,
  `composeEventHandlers`, `safeUrl`, `domainColor` / `seriesColor`, and locale-aware
  number formatting (`formatNumber`, `formatCompact`, `formatPercent`, `formatUnit`,
  `formatDelta`, `formatBytes`; missing values render "—").

#### Gates and checks

- `bun run check`: `verify:no-css-imports`, `verify:no-raw-tailwind`, `verify:utilities-exist`
  (a class-named array or object counts as a class list only where some file uses it as
  classes), `verify:domain-pairs`, `verify:series-palette`, `verify:domain-contrast`,
  `verify:token-mirror`, `verify:class-prefix` (every class and keyframes name a stylesheet
  defines is `r-<group>-…`), then typecheck, lint and tests.
- `bun run browser:check`: starts the showcase and runs every `scripts/browser/*.js` check in
  a real browser: virtualized rows (including a stylesheet that retunes `--ROW-H`), hit
  areas, anchored-panel hiding, the whole Overview on every axis, the Dashboard and Marketing
  pages, and the Stress page's matrix, density boundaries, mid-scroll virtualization and
  painted contrast. Not part of `check`.

#### Showcase

- `showcase/`: View panel (theme, density, input; persisted; live token readout),
  hash-routed pages, an app-root `ToastProvider`. **Overview**: auto-discovered component
  sections, each behind its own error boundary. **Dashboard**: an operations dashboard in an
  `AppShell` given the window. **Marketing**: a landing page on the fluid display and
  section scales. **Stress**: hostile cases (nested density, clipped floating panels,
  10,000 rows, extremes of content, translation, RTL), each measured by a browser check.

#### Domain tokens

- Domain tokens (`src/tokens.css`): series 1–8, sequential 1–7, trend good/bad/flat,
  status serious and stale (mark, text, bg), chart grid/axis, as LIGHT/DARK pairs blended
  by `--SCHEME-DARK` at the read; density-dependent chart height, bar thickness, heat
  cell, KPI min/max, and the container-sized `--KPI-VALUE`.
- Domain tokens `--C-TEXT-ON-SERIOUS` / `--C-TEXT-ON-STALE` (`text-fg-on-serious`, `text-fg-on-stale`): text on the serious/stale mark used as a fill, gated >= 4.5:1 by `verify:domain-contrast`; the light stale mark darkens to L 0.54 so white clears it.

#### Primitives

- `Button`: primary / secondary / ghost / danger at `h-control`; `loading` (aria-busy, centred spinner, width kept, focus kept); `iconStart` / `iconEnd`.
- `IconButton`: required `label` (aria-label + title); `ghost` is a compact density-tracking square with a `hit-area` box, `secondary` / `primary` take the `--CONTROL-H` square so they line up with Buttons and fields; `aria-pressed` toggle.
- `Badge`: `tone` (8, incl. serious/stale) × `variant` subtle / solid / outline, contract or domain pairs only (solid serious/stale use `--C-TEXT-ON-SERIOUS` / `-STALE`).
- `StatusLabel`: mark-coloured glyph + visible words for every tone; never colour alone.
- `Card` (+ `Header`, `Title`, `Description`, `Actions`, `Body`, `Footer`): surface 0, hairline, no shadow, size container. The header keeps every non-action child in one text column and puts `Card.Actions` beside it, wrapping them under it only when they do not fit while the text keeps `--COLUMN-SM`; actions never widen the card (an unbreakable `Badge` truncates). Title and description break unbroken words.
- `Alert`: status tones with glyph, spoken severity, title, body, `actions`, `onDismiss`; error/serious are `role="alert"`.
- `Spinner`: decorative unless `label`led (then `role="status"`); keeps turning under reduced motion.
- `Skeleton`: text lines (one line box each) / block / circle; decorative unless labelled; pulse stops under reduced motion.
- `Kbd`: key cap on the text baseline.
- `Divider`: horizontal / vertical hairline; a labelled divider keeps its words readable.
- `Avatar`: image with initials fallback (missing, broken or `safeUrl`-refused src); `size` `control` | `icon`.
- `Link`: accent or inherited ink on the theme's `--LINK-DECORATION`; external glyph; new-tab hint as description; `safeUrl`-refused href renders text.

#### Form

- `Field` (+ `Label`, `Description`, `Error`): wires the control's id, `aria-describedby`, `aria-invalid`, `required`, `disabled`, `readOnly` from the parts that rendered; an `Error` with content marks it invalid; `orientation="horizontal"` puts the label beside the control by container width.
- `Input`: text-like types at `h-control` with `start` / `end` adornments; the frame carries the focus ring and focuses the input on press.
- `Textarea`: `autosize` (rows = floor, `maxRows` = cap, then scrolls).
- `Select`: styled native `<select>` with `placeholder` (muted until chosen) and a `readOnly` that refuses to open.
- `SearchInput`: magnifier, clear button, Escape clears (an Escape that clears nothing passes through), `loading`.
- `Checkbox`: agreed API (`checked` / `defaultChecked` / `indeterminate` / `onCheckedChange`); native input, clickable label padded to the hit floor (a label-less box takes `hit-area`), read-only.
- `RadioGroup` + `Radio`: native radios sharing a name; invalid and read-only on the group.
- `Switch`: native checkbox with `role="switch"`; same API as `Checkbox` minus `indeterminate`.
- `SegmentedControl` (+ `Item`): single-select radio-group semantics, one tab stop, arrow keys; icon and icon-only segments.
- `NumberInput`: spinbutton with steppers, `min` / `max` / `step` / `precision`, PageUp/PageDown, Home/End, locale-aware display and parsing, tabular figures.

#### Overlays

- `Tooltip`: hover (delayed) and focus-visible open, never a touch tap; Escape closes it alone; appends to `aria-describedby`; optional arrow; in place, top layer.
- `Popover` (+ `Trigger`, `Content`, `Close`): non-modal `role="dialog"`, focus in and back, light dismiss, Escape, optional arrow, `asChild` triggers; in place, top layer.
- `DropdownMenu` (+ `Trigger`, `Content`, `Item`, `CheckboxItem`, `RadioGroup`, `RadioItem`, `Separator`, `Label`): arrows, Home/End, typeahead, Enter/Space, Escape returns focus, Tab closes; `--ROW-H` items, `tone="error"`, `shortcut`; in place, top layer.
- `Dialog` (+ `Trigger`, `Content`, `Header`, `Title`, `Description`, `Body`, `Footer`, `Close`): native `<dialog>` via `showModal`, scrim, CSS scroll lock, light dismiss, corner close; `role="alertdialog"` drops both.
- `Drawer`: the Dialog's parts on the inline end or the bottom (`side`), sliding in.
- `ToastProvider` + `useToast()`: neutral/success/error/warning/info, one action, auto-dismiss paused on hover/focus (errors and actions persist), assertive/polite live regions, corner stack in the top layer.

#### Data

- `Table` (+ `Caption`, `Head`, `Body`, `Row`, `HeaderCell`, `Cell`): `--ROW-H` rows, one truncated line with the full value in `title` (or `truncate={false}`: one line at content width; or `wrap`: several lines, the row grows), numeric cells end-aligned/tabular, sort button + `aria-sort`, selected row with an accent marker, `variant` boxed/rules/plain, `layout` auto/fixed, `striped`, `stickyHeader`, column `priority` that drops by the table's own container.
- `DataTable`: column definitions, controlled/uncontrolled sort (missing values last) and selection (indeterminate select-all via `Checkbox`), row actions, loading skeleton rows, empty and error states, `manualSorting`.
- `VirtualizedTable`: windowed `DataTable` for 10k+ rows; row height is the measured `--ROW-H`, re-read whenever a hidden `height: var(--ROW-H)` probe resizes (density, input, theme, or a stylesheet change with no attribute moving); browser checks `data-virtualized-rows.js`, `stress-virtualized.js`.
- `StatCard`: KPI tile, `text-kpi` value sized by the tile (a value too long for it wraps inside it), delta coloured by `sentiment` (not direction), sparkline and status slots, `stale`, `loading`.
- `Sparkline`: series-coloured SVG trend line (`series="total"`: a sum of series in the primary ink), `role="img"` named by label + low/high/latest summary, gaps for missing values.
- `Meter`: `role="meter"` with thresholds mapped to status tones (fill + icon + `aria-valuetext`), `worse` high/low, stacked/inline variants.
- `DescriptionList` (+ `Item`): term/value pairs that move terms into a column by their own container width; both break unbroken words; plain/divided.
- `EmptyState`: icon, title, description, actions; `tone="error"`; optional heading level.

#### Navigation

- `AppShell` (+ `Sidebar`, `Brand`, `SidebarSection`, `NavItem`, `SidebarToggle`, `Header`, `Main`, `BottomNav`): the viewport picks the form (full sidebar ≥ `--breakpoint-lg`, icon rail ≥ `--breakpoint-md`, bottom nav below; no `BottomNav` keeps the rail); controlled/uncontrolled `collapsed`; skip link; accent current marker; rail labels stay accessible names and show on hover/focus; `as` for router links; `--r-navigation-shell-viewport` for embedding; `Main as="div"` inside a page that owns `<main>`.
- `Tabs` (+ `List`, `Tab`, `Panel`): `underline` / `enclosed` variants, roving tab stop, arrows (mirrored in RTL), Home/End, disabled skipped, `activation` automatic / manual.
- `Breadcrumbs` (+ `Item`): ordered trail, `aria-current` last crumb, `maxItems` collapses the middle into a button that expands in place and focuses the first revealed crumb; `as` for router links.
- `Pagination`: prev/next + numbered pages (constant slot count), controlled/uncontrolled, compacts to "Page 3 of 12" under its own `@md` container width, locale-formatted, translatable labels.
- `NavList` (+ `Section`, `Item`): vertical settings/docs nav, titled sections, icons, badges, accent current marker; `as` for router links.

#### Layout

- `Stack` / `Inline`: column / wrapping row; `gap` (and `rowGap`) take scale names `r1`–`r6` only; `align`, `justify`, `as`.
- `Grid`: auto-fit by its OWN width with a `minColumn` floor (the contract's `--COLUMN-SM/MD/LG`), or `columns` per container size (`@sm`–`@5xl`); `as` lands on the grid element.
- `Container`: `width` page (`--PAGE-MAX`) / measure / full, content-box cap with the fluid `--GUTTER` outside it.
- `Section`: fluid `padding` `section-1..3`, `variant` plain / band.
- `Prose`: r-ui-css prose region capped at `--MEASURE`; controls inside keep the UI scale.

#### Round 2: preferences, router and title

- `useTheme` saves one JSON object (theme, density, input) and reads it back on mount;
  `useDensity`, `useInputMode` (with `resolved` fine/coarse), and the pure `themeScript()` /
  `readStoredPreferences` / `applyPreferences` / `storePreferences`.
- New group `preferences`: `ThemeSwitcher` (the consumer's themes; segmented or select),
  `DensitySwitcher`, `InputSwitcher`, `PreferencesMenu` (one "View" menu of radio groups),
  `ThemeScript` (pre-paint `<script>` for the head; try/catch around storage; `nonce`).
- `DocumentTitleProvider` for `useDocumentTitle`'s base and separator.
- `RouterProvider` (`link`, `isCurrent`): read by `Link`, `NavList.Item`, `AppShell.NavItem`,
  `AppShell.Brand`, `Breadcrumbs.Item` and `Pagination`; explicit `as` / `current` win;
  external and new-tab links stay plain `<a>`. `Link` takes `as`. `Pagination` takes
  `getHref(page)`: real links (unavailable arrows keep `role="link"` + `aria-disabled`).
- `StatCard`: a stale tile says "Stale:" before its age to assistive tech.
- `useActiveSection` re-observes only when the ids change, not for an equal array literal.
- `Field`: the layout grid's single column may shrink, so a segmented control in a narrow
  field no longer spills.

#### Round 2: motion, disclosure and overlay exits

- Overlays animate out as well as in: `Dialog`, `Drawer` (and their scrim), `Popover`,
  `DropdownMenu` and `Tooltip` transition out in CSS (`transition-behavior: allow-discrete`,
  motion tokens, so reduced motion closes at once); the panel stays mounted, inert, until its
  exit finishes, and focus returns at once. Floating panels fade. Engines without
  `allow-discrete` close instantly. `Popover.Trigger` toggles from the popover's own state,
  so a press during the exit reopens it. A leaving toast unmounts when its exit ends.
- Group `motion`: `ScrollReveal`, `Stagger` (capped at `STAGGER_MAX_INDEX`; `trigger="scroll" |
  "mount"`), `startViewTransition` / `useViewTransition` (with a direct-update fallback).
- Group `disclosure`: `Collapsible` (APG disclosure) and `Accordion` (single or `multiple`,
  `collapsible`, `headingLevel`, arrow/Home/End keys); panels animate their height and are
  inert when closed; rows are at least `--ROW-H`.

#### Round 2: charts

- Group `charts`. `LineChart`: hand-rolled SVG (no dependency) over a category, number or
  time axis (calendar-aligned ticks chosen by measured label width), nice value ticks,
  gridlines, `area`, pinned `min`/`max`, Intl values (`unit`, `format`, `locale`); legend
  pairs colour with a shape; crosshair + one tooltip for every series on hover,
  arrows/Home/End with a polite announcement, tap on touch; table always built (hidden beside
  the drawing, shown on "Show as table" or when nothing can be drawn); never throws on
  hostile input; 8 series drawn (`slot` pins an entity's colour), 24 tabulated, 1,000 points.
- `BarChart`: the same axis, legend, table and readout as columns or horizontal bars, grouped
  or `stacked`, `--BAR-THICK` thick with a rounded data end, time band axis labelled on
  calendar boundaries.
- `Heatmap`: rows × columns on the sequential ramp (seven bins), `--HEAT-CELL` rows, dashed
  missing cells, legend scale, labels thinned to the width, 2-D arrow keys; 64 × 168 cells.
- The chart tooltip is the contract's inverse bubble with Tooltip's padding and motion.

#### Round 2: content

- Group `content`. `CopyButton`: Clipboard API with a selection-copy fallback written beside
  the button (works inside a modal dialog); icon-only or `showLabel`; polite status
  announcement (re-announced on repeat), `onCopy` / `onCopyError`, translatable `labels`.
- `CodeBlock`: header (filename, language, wrap toggle, copy), `lineNumbers` (never copied),
  `highlightLines`, `wrap` / `defaultWrap` / `onWrapChange`; scrolls inside its focusable
  `<pre>` and never widens its container; a UI island inside prose. Syntax colour from
  lowlight's core plus one `highlight.js` grammar per language, each its own chunk fetched on
  first use (with the curated grammars it embeds): a TypeScript block costs about 19 kB gzip
  (core 8.6 kB + grammars), where every grammar used to ship as one 51.5 kB chunk. 14 curated
  languages and their aliases; plain text until loaded, past a size budget, for an unknown
  language or a failed load; rendered from lowlight's tree with no HTML injection.
- `Markdown`: its own tree parser (no dependency), closed GFM subset incl. task items; prose
  scale, fences as `CodeBlock`, tables as `Table`; raw HTML as text, links through `safeUrl`,
  images only from `imageAllowlist`; `headingOffset`, `components`, `labels`; nesting past 8
  levels kept as text.
- Domain tokens `--C-CODE-KEYWORD/STRING/NUMBER/FUNCTION/TYPE` (pairs) and
  `code-comment/property/addition/deletion` (aliases of contract text roles), utilities
  `text-code-*`; 4.5:1 on canvas and surfaces 0–3 in every theme; CanvasText under forced
  colors (weight and slant carry the meaning).

#### Round 2: form (selection inputs and form state)

- `Combobox`: editable combobox with a listbox popup (APG, `aria-activedescendant`): filters
  ignoring case and diacritics (or a `filter`, or `false` for async with
  `onInputChange(text, reason)`, `loading`, `loadError`), groups, descriptions, icons,
  disabled options, bold match, `allowCustomValue`, windowed past `virtualizeThreshold`;
  Escape closes then clears; `name` via a hidden input.
- `MultiSelect`: removable chips inside a wrapping field (each line one `--CONTROL-H`),
  Backspace removes the last chip, `selectAll`, `max`, "n selected" when the field is under
  `--COLUMN-MD`; one hidden input per value.
- `TagInput`: tags from Enter, a delimiter or a paste; duplicates and `validate` refusals keep
  the text and show a message; `max`, optional `suggestions`; one hidden input per tag.
- `useForm` + `Form`: Standard Schema validation (types shipped, no validator dependency),
  nested paths, touched/dirty/submitting/validating, `validateOn` then `revalidateOn`,
  per-field async `validate` on `Field` with an `AbortSignal`, server errors by path
  (`setErrors`), `reset`; a native `<form noValidate>`; a failed submit focuses the first
  invalid field in DOM order. `useFieldArray` (stable keys; errors and touched follow their
  row), `useFormState`, `useFormValue`.
- `Field name="…"` binds the control inside to the surrounding `Form`; several descriptions
  and errors may mount at once. Controls bind through `useFieldValue` /
  `useFieldInputProps`; `useFieldMessage` registers a control's own message.
- `ErrorSummary`: after a failed submit, an error alert linking each error to its field.
- `FormActions` (+ `FormActions.Submit`, busy while its Form submits): stacked full-width in a
  narrow container; `sticky` holds the row on its scroller's bottom edge.
- `Field.Error`, a TagInput refusal and a date picker's refusal share one error line, which
  breaks an unbroken word instead of widening the field.
- `Textarea` `autosize` re-fits on a width change in the next frame, keyed to its border box,
  so its own height and scrollbar no longer feed a "ResizeObserver loop".

#### Round 2: dates

- Group `dates`. `Calendar`: APG date grid (arrows, Home/End, PageUp/PageDown, Shift for
  years, RTL), Intl names, digits and week start, min/max, `isDateUnavailable`, today marker;
  as many months side by side as its own width holds, cells `--CONTROL-H` square.
- `RangeCalendar`: two-press range with a live preview and a band that is a shape.
- `DatePicker`: a Field control typing dates in the user's locale (pattern shown, ISO and
  month names read), refusals in the Field error's look, calendar popup in place, `name`
  submits `YYYY-MM-DD`.
- `DateRangePicker`: toolbar time range at `h-control`, presets
  (`DEFAULT_DATE_RANGE_PRESETS`), typed start/end and a RangeCalendar applied on Apply,
  `name` submits an ISO interval; `DateRangeValue.preset` lets a dashboard re-resolve
  "last 24 hours".

#### Round 2: primitives

- `Button` takes `aria-pressed`: a toggle in the selection pair, exactly as a pressed
  `IconButton` (one shared class list).

#### Round 2: forced colors

- Every existing component's states survive Windows High Contrast. The selected segment and
  enclosed tab, and the menu item under the pointer, become Highlight fills (a selected
  tab's or segment's focus ring turns HighlightText inside the fill); the selected table row
  keeps a Highlight marker; an off Switch track is Canvas; invalid field frames, check boxes,
  switches and segmented controls get a doubled edge; Skeleton is a dashed GrayText outline,
  Avatar and a meter track get an edge; breadcrumb links are LinkText; nav count pills get
  an edge, and the rail, bottom-nav and skip-link fills keep their text.
- A focused field shows one ring: the inner input's reset outline is zero width, so the
  forced `outline-style: solid` no longer draws a second ring inside the frame.
- Domain colours: status serious/stale, trend and chart chrome map to system colours; series
  and sequential steps keep theirs (their fills opt out of repainting) and, with the
  contract's `--SCHEME-DARK` now following the forced palette, take the light or dark values
  that suit the forced Canvas whatever the theme.

#### Round 2: integration

- In-flow stacking reads the contract's layer scale (`z-sticky` header, `z-docked` sidebar
  and bottom nav, `z-bypass` skip link, `z-raised` sticky table head). Component stylesheets
  draw their structural lines at `--BORDER-WIDTH`.
- Gates: `verify:no-raw-tailwind` fails on a numeric z-index and a fixed `1px` line;
  `verify:domain-pairs` on a domain pair with no forced-colors mapping and a meaning-bearing
  fill without its opt-out; `verify:no-html-injection` on `dangerouslySetInnerHTML`,
  `innerHTML`/`outerHTML` assignment, `insertAdjacentHTML`, `document.write` or
  `createContextualFragment` in `src/` or `showcase/`.
- Browser checks (every script runs with a shared `waitForShowcase` that waits for the page's
  `data-showcase-ready`; `--print <name>` gives the code to run by hand): `theme-fonts`,
  `motion-overlay-exit`, `motion-scroll-reveal`, `disclosure-accordion`, `forced-colors-states`
  (one ring per focused control; the forced scheme), `charts-interaction`, `content-code`
  (grammars fetched per language), `content-markdown`, `selection-inputs`, `dates-pickers`,
  `form-state-submit`. `overview-matrix` now fails on a spill inside ANY scroll container in a
  demo, not only the demo frame (a designed scroller opts out with `data-sc-scrolls`).
- Showcase: the shell is the library `AppShell`, the View panel a `Popover` of the library
  switchers, `themeScript()` inlined into `index.html` by the Vite config (whose imports carry
  extensions, for Vite's native config loader); each page and each Overview section is its
  own chunk (the entry went from 770 kB to 268 kB); groups ordered tokens, primitives, form,
  dates, disclosure, overlays, data, charts, content, navigation, layout, motion,
  preferences; the Inter and Fraunces faces and the `atelier` example theme.

#### Round 3

- `Timeline` (data): events as an ordered list per local day under sticky day headers, a connector and a status mark per event (glyph + word + disc), relative or absolute `<time datetime>`, focusable, with the full reading in a Tooltip on hover and keyboard focus, newest or oldest first, clamped descriptions, paging (`pageSize`, `onLoadMore`), empty and loading states; `ActivityFeed` is its actor-verb-object preset. The Dashboard's Open incidents card is a Timeline. Browser check `timeline-layout`.
- `ColorPicker` (form): a Field-bound colour field (`useFieldValue`, `name` via a hidden input): trigger with chip and value text; popup in place + top layer with an OKLCH lightness × chroma area (sRGB edge hatched, keyboard thumb), hue slider, optional opacity, typed `#rgb`/`#rrggbb`/`#rrggbbaa`/`oklch()` (refusals through `useFieldMessage`, out-of-gamut chroma lowered with a note), named swatches as a radio group, feature-detected EyeDropper and a WCAG contrast readout (`contrast={{ against, label }}`, any CSS colour incl. a token). `format: "hex" | "oklch"`. Browser check `colour-picker`.
- `FileUpload` (form): a drop zone that is a real button opening the native picker; `accept` / `maxSize` / `maxFiles` / `validate` refusals as the Field's error (`useFieldMessage`); a file list with type icon or image thumbnail (object URLs revoked), name and size; with `onUpload(file, { onProgress, signal })` per-file progress, cancel (AbortSignal), retry and remove, and the value is what each upload resolved with (else the `File`s); optional paste; native `name` through the file input or one hidden input per value. Binds via `Field name`. Browser check `uploads-file-otp`.
- `OTPInput` (form): one real input under N boxes (one accessible name, "Verification code , 6 digits"; `autocomplete="one-time-code"`, numeric or alphanumeric `inputMode`); typing advances, Backspace goes back, arrows/Home/End move, a filled box is selected so typing replaces it, a paste or autofill strips spaces and dashes and fills every box; `onComplete` once per complete code; `mask`, `groups` + `separator`; boxes stay left to right in RTL. Binds via `Field name`.
- `Hero` (marketing, new group): eyebrow, display title (`text-display-1`, display face, fluid over the hero's own width), prose lead, actions, media, proof and extra text-column children; `layout="stacked" | "split"` (split beside its media from a 56rem HERO, stacked below), `variant="plain" | "band"`, `headingLevel`. The Marketing page's hero is one. Browser check `marketing-page`.
- `MediaCard` (marketing): image (lazy, intrinsic `width`/`height`, `ratio` wide / classic / square / portrait; no image or a failed one shows a placeholder), title, description, meta, badge; the whole card is one link (a stretched pseudo-element, router-aware, ringed as a whole) while `actions` stay their own tab stops; hover lift on motion tokens; `MediaCard.Skeleton`. Browser check `marketing-components`.
- `Carousel` (marketing): a native scroll-snap track with `Carousel.Slide` children; prev / next by one slide, the focused track's arrows / Home / End (mirrored in RTL), a peek of the next slide, `perView` 1–4 by the CAROUSEL's width, a "Slide 3 of 8" status or `dots` as a tablist; no autoplay unless `autoplay` (then a pause / play control, paused on hover and focus, never starting under reduced motion). Browser check `marketing-components`.
- `CommandPalette` (commands, new group): a Dialog holding a combobox over a grouped listbox of `{ id, label, group, keywords, shortcut, icon, disabled, onSelect, page }` commands; ranked matching (label prefix, word start, all words, keywords, scattered letters) highlighted through the selection inputs' diacritic folding (one shared matcher and highlight, `util/text-match`); Enter closes, focus returns, then the command runs; nested pages (Backspace in the empty field or the back button returns, query and highlight restored), page commands loaded once (cached) or searched per query (`search`, debounced, aborted when superseded); loading, error and empty states; recent commands in memory (`recent` / `defaultRecent` / `onRecentChange` to persist). `useCommandPaletteShortcut(onShortcut, { key, enabled, allowInEditable })`: Cmd+K on Apple, Ctrl+K elsewhere, ignoring fields, IME composition and repeat; returns the chord for display and `aria-keyshortcuts`. The showcase shell has a global palette (pages, Overview sections, theme / density / input pages). Browser check `commands-palette`.
- `ContextMenu` (overlays): DropdownMenu's panel, items and keyboard model (now one shared implementation, `menu-internals`) opened by right-click at the pointer, Shift+F10 / the Menu key at the focused element, or a touch held still (a moving touch never opens it); positioned at a virtual point that follows its region on scroll; `onBeforeOpen(target)` picks the row or declines (the browser's menu stays); focus returns to what had it; a handled open is default-prevented, so only the innermost of nested regions opens. The Dashboard's services rows have it, beside a per-row actions menu with the same items. Browser check `overlays-context-menu`.
- `Stepper` (steps, new group): an ordered list of `Stepper.Step` (`label`, `description`, `status: "error" | "skipped"`, `optional`); position (complete / current / upcoming) from `current`; each state has a ring weight or style, a glyph (check, number, cross, dash) and a word, the current step `aria-current="step"`; `onStepSelect` makes it a `nav` whose steps before the current one are buttons (or router links with `href`; `selectable` overrides); horizontal collapses to "Step 2 of 5 · Name" with a progress bar when its own container is narrow (threshold stepped by step count); `messages` for every word. Browser check `steps-wizard`.
- `Wizard` (steps): a multi-step flow over one `useForm` (or plain steps without one): `Wizard.Step` names its `fields`; Next (and Enter) checks only those plus the step's own async `validate` (errors by path, aborted on leaving), busy meanwhile, and focuses the first invalid field; Back keeps values; optional steps offer Skip; the last step submits the whole form and an error left on an earlier step takes the user back there; every step change focuses the step heading ("Step 2 of 4: People"); controlled `step`; vertical puts the Stepper beside the step. `useForm` gains `validatePaths(paths)` and `focusFirstError(paths?)`, the store `hasErrorWithin(paths)`. Browser check `steps-wizard`.
- Print (`src/print.css`, on top of the CSS package's print contract): AppShell prints only its content (sidebar, rail, bottom nav and skip link gone; a header keeps its headings, loses its controls); floating layers, the command palette and toasts never print; menu triggers, copy and wrap buttons, pagination, a chart's table toggle, a FileUpload drop zone and carousel controls hide; tables let go of their scroll area, wrap truncated cells and repeat their head; a VirtualizedTable prints its loaded rows without spacers and a note (`--r-print-partial-note`); CodeBlock wraps; Accordion / Collapsible panels print open; Tabs print the active panel under its tab; Timeline prints whole and unclamped; Carousel slides stack; series, sequential, heat, meter, domain status and colour-picker paint print exactly. Components mark what only a screen can use with `data-print="hide"` (FormActions, CopyButton, Timeline's "Show more", a FileUpload row's actions); Card is `avoid-break`. Browser check `print-pages`.
- Gates: `verify:group-deps` builds the import graph between component groups (and `hooks`, `util`) and fails on any cycle; `verify:domain-contrast` also measures the CSS package's print palette; the token gates' `.examples.` exemption applies to showcase example data only, never to `src/`. Browser checks for every Round 3 component, and `dashboard-layout` asserts the services rows keep `--ROW-H` with their actions column.

#### Round 4: verification fixes

- Domain token `--SPARK-H` (`h-spark`, per density) for `Sparkline`'s height; the
  Dashboard sidebar's width reads `--COLUMN-MD`.
- Floating panels share one width cap (`.r-overlays-surface`: the reading measure, and
  `100%` of the scrollbar-free viewport once promoted); the selection listbox, ColorPicker
  and the date popups no longer cap themselves at `100vw` (which slid under a scrollbar). A
  panel wider by design (a date popup's months) lifts the measure with
  `--r-overlays-measure`. A panel keeps its own `--R-SIZE-2` from the viewport's edges
  (`useFloating`'s shift padding, was a fixed 8px), the gap the cap leaves, so a panel at
  its cap no longer sits 8px from one edge and 16px from the other.
- `Markdown`: a list holding task items indents each item by the box and its gap in the
  item's own em, so the box sits inside the list's indent (it overhung the list's edge,
  whose indent is in the smaller UI em) and every item's text shares one column.
- `Link`'s underline offset reads the contract's `--LINK-UNDERLINE-OFFSET`; `Tabs`' enclosed
  selected edge and `Avatar`'s initials no longer use raw lengths (`--BORDER-WIDTH`, a
  ratio of `100cqi`).
- `Tooltip`: Escape closes a hover-opened tooltip while focus is elsewhere (WCAG 1.4.13).
  `Dialog` / `Drawer`: `autoFocus` and `initialFocus` decide where focus lands on open.
  `Toast`: dismissing one hands focus to the next toast, else back where it came from.
  `Tabs`: a disabled or unmatched `value` still leaves the first enabled tab as the tab stop.
  `Pagination`: the focus handoff works with two pages and in link mode. `Carousel` dots
  step from the target slide during a smooth scroll. `MultiSelect` in a narrow field reaches
  its chips through the "n selected" button. `Combobox` never points
  `aria-activedescendant` at an option a load error hides. Option and command ids come
  from keys.
- Gates: `verify:no-raw-tailwind` reads every length unit (`em`, `ch`, `lh`, viewport and
  container units), border / outline / box-shadow lines and `src/**` (hooks and util
  included), with one exact allowance; `verify:domain-contrast` takes `--theme` (a
  consumer's theme) and checks the domain density rule; fixture tests for
  `verify:series-palette`, `verify:token-mirror` and `verify:no-css-imports`; ESLint covers
  `scripts/`. Browser checks share a prelude (theme list by property, error collector,
  per-script reset; its `resetShowcase` no longer uses `URL`, which run-code's scope lacks, so
  every check failed before this), and a new `navigation-focus` check.

### Known gaps

Not built yet, and known to be missing:

- No display-text measure token: long display headings are capped by the caller.
- No fluid spacing step below `section-3` for tight marketing rhythm.
- `Section variant="band"` assumes edge-to-edge layout; inside a shell that pads its content,
  the page has to cancel that padding itself.
- On a phone the toast stack sits over a bottom nav (`AppShell.BottomNav`) until it is
  dismissed or times out.
- Toasts are not interactive while a modal dialog is open (the dialog makes everything
  outside it inert).
