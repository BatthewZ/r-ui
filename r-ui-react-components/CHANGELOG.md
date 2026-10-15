# Changelog

All notable changes to `@batthewz/r-ui-react-components`. Breaking changes to the domain
tokens or the public surface are versioned events and are recorded here.

## Unreleased

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
