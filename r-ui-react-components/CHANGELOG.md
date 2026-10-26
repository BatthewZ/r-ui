# Changelog

All notable changes to `@batthewz/r-ui-react-components`. Breaking changes to the domain
tokens or the public surface are versioned events and are recorded here.

## Unreleased

### Added

- `EventCalendar` (dates): caller events on a calendar, in a month view, a week or day time grid, and an agenda, with a toolbar for Today, previous and next, the period's title and a view switch. `view` and `date` are controllable, so a URL can hold them. It is read-only: an event with an `href` is a link (through the `RouterProvider`); with `onEventClick` the rest are buttons, else text. An event's time is an instant, or a `YYYY-MM-DD` calendar date for an all-day event (whose `end` is its last day, inclusive). Every event is named in full: title, time, category, status and location. Its entity's colour (`slot`, a series slot) is a mark beside it, never a fill under text. The month view packs multi-day events into lanes and gives a crowded day's last lane to "+n more". A press or Enter on a day opens a panel listing all its events. When the calendar is narrower than `--MEASURE`, days show dots instead of event chips. The time grid draws an hour as two `--ROW-H`, sets overlapping events side by side, holds all-day and day-long events in their own row, and draws a now line. `CalendarEvent`, `EventCalendarView`, `EventTime`, `EventCalendarLabels` (+ `DEFAULT_EVENT_CALENDAR_LABELS`) and `EventCalendarSlot` are exported with it.

### Fixed

- `Calendar`, `RangeCalendar` and the date pickers: the weekday headers stay on the right days when the runtime's time zone changes after the library loads. Their reference date was built when the module loaded, and a zone west of that one read it as the day before.

## 0.1.2

### Fixed

- `Toast`: a toast with a title and nothing else has even padding. Its Dismiss button reached into the top padding only, so on one line it stood taller than the text and added space under the title.
- `Toast`: under touch input, two stacked one-line toasts keep their Dismiss buttons `--HIT-MIN` apart, so neither's hit area reaches over the other's. The gap between toasts (and between the urgent and polite lists) grows past `--R-SIZE-4` only when the toasts are too short for that.

## 0.1.1

### Added

- `Button` takes an `href`: it renders a link with the button's look (the `RouterProvider`'s link for an internal `href`, else `<a>`, or `linkAs`), passed through `safeUrl`. `aria-disabled` and `loading` stop it navigating. `ButtonLinkProps` types it; `ButtonProps` stays the button's.

### Changed

- Peer dependency `@batthewz/r-ui-css` is `^0.1.1`, whose theme checks also run when installed as a symlink.
- `themeScript` (and `<ThemeScript>`): the script text is fixed when the library is built, so for a given config it is the same in every app, whatever bundler or minifier compiles it, and a Content-Security-Policy hash of it holds. It used to serialise the reader and applier at run time, so its text (and hash) followed the app's toolchain.
- `Spotlight`: the wash is the theme's accent at 7% (was the primary ink at 4%), so a light card is tinted rather than greyed; text on surfaces 0–2 keeps 4.5:1 in every shipped theme.
- `Toast`: a toast slides in from the screen edge its stack is pinned to (the inline end for `*-end`, so the right, or the left under `dir="rtl"`; the inline start for `*-start`) and slides back out when it leaves, instead of fading up. Under reduced motion it still appears at once.
- `Toast`: once a leaving toast has slid out, its space closes over `--DURATION-SLOW`, so the toasts beside it glide into place instead of jumping; it unmounts after. Each toast's `<li>` is now that collapsing slot, and `classNames.toast` styles the card inside it. Toasts are spaced by a margin on the card rather than the list's gap. Under reduced motion it still leaves at once.

### Fixed

- `Tooltip` clears its trigger's native `title` while enabled, so a wrapped `IconButton` no longer shows the browser's tip of its label beside the tooltip.
- `AppShell` inside another `AppShell`'s main follows its own `collapsed` state. The wide sidebar's rules matched any uncollapsed ancestor shell, so an outer shell held an inner one's sidebar open and its toggle did nothing.
- `LineChart`, `BarChart` and `Heatmap` draw at their size again after "Show chart". The plot is a new element when it comes back from the table, and the chart went on watching the removed one (0 × 0), so it drew nothing.
- `Table` (and `DataTable`) isolates its scroll area as a stacking context, so a pinned head on the sticky layer no longer paints over a page's sticky header as the page scrolls it under.

## 0.1.0

First release. "Added" lists the surface; the other sections record pre-release
development, so "Breaking" and "Fixed" are relative to earlier, unpublished states.

### Verification

- Data, charts, navigation: `Meter`'s default text reads an over-range value's real share ("140%", only the fill clamps); `Timeline` with `pageSize` shows the events a "Show more" press loaded remotely, and renders an epoch number outside the `Date` range as a missing time instead of throwing; `Pagination` reads a `NaN` or fractional `page` / `pageCount` as a whole page in range; a pinned chart `max` drops the gridline multiple that crowded it (1000 beside 1024); `Sparkline` draws a span wider than a double without a NaN path.
- Util, hooks: `formatPercent`, `formatCompact` and `formatBytes` accept a `minimumFractionDigits` above their one-digit default instead of throwing, and `formatBytes` steps up a unit when rounding reaches 1024 ("1 MB", not "1,024 kB"); `mergeRefs` (and so `mergeProps` and every component that merges a forwarded ref) runs a React 19 callback ref's returned cleanup on detach instead of dropping it; `useVirtualRows` (and `VirtualizedTable` with `overscan={0}`) mounts the partly visible last row when scrolled mid-row.
- Overlays, commands: `Dialog.Content` keeps a caller's `aria-labelledby` / `aria-describedby`, and an `id` on `Dialog.Title`, `Dialog.Description` or `DropdownMenu.Trigger` no longer unhooks the name or description (the generated id wins); a toast dismissed with focus on it no longer leaves every later toast paused; a `ContextMenu` opened by the platform's own long press is no longer reopened by ours (which sent focus back into the closed menu); a `CommandPalette` page never lists the previous page's search results or searches with its query.
- Form: a submit that waited on a field check re-checks a value typed meanwhile instead of submitting it unchecked (also `validatePaths`); a field-array row keeps its `Field validate` error through a move or a removal; `NumberInput` shows the committed (rounded, clamped) value after Enter, and focusing and leaving it without an edit no longer re-reads a display rounded by `formatOptions` into the value; `SearchInput` binds to a `Form` through `Field name` like every control; a `FileUpload` row keeps focus when the upload it was on finishes (its Remove button).
- Content, dates, steps: `Markdown` keeps the text between two HTML comments when the second ends a later line, parses long paragraphs, runs of unclosed `[a](` and of unclosed `<!--` in linear time instead of hanging, and no longer loads an allowlisted image from another host through `/\host/…` (nor throws on a root-relative `src` that does not parse); the date components format and read the Gregorian calendar in every locale (`th-TH` no longer types a Buddhist year that reads back 543 years late, `fa-IR` no longer labels a Gregorian month with a Persian name); a `Stepper.Step` whose `href` `safeUrl` refuses is a button instead of an `<a>` no keyboard can reach.
- Router: `isExternalHref` resolves an href as a browser does, so `/\host`, `\\host`, `///host` or ` //host` (another host to a URL parser) is external: `Link` and every routed navigation part render it as a plain `<a>` instead of the router's link, and `Markdown` opens it in a new tab with the glyph and description.

### Fixed

- Layout: a `Container` fills its parent up to its cap plus the gutters in a flex or grid parent too (a `Stack`, an `Inline`, a grid cell), centred, and is never wider than its parent whatever pads it. Its auto inline margins made it shrink to fit there, and a size container inside (a `Grid`, a `Card`) gave it no width to fit, so it collapsed to its gutters with one word to a line. It is now the parent's full width, border-box, capped at cap + 2 × `--GUTTER` with the gutter on (so the cap is still the content width and a `measure` container still holds one reading line) and at the cap alone without it; a padding of your own narrows the content inside that box instead of pushing it past the parent. The cap is the component's own rule now, not the `max-w-page` / `max-w-measure` utilities: a caller's `max-w-*` in `className` caps the whole box. Browser check `layout-container`.
- Overlays: a `Drawer` (so `SiteHeader`'s and `FilterBar`'s) no longer pulls away from its edge when a theme's `--EASE-ENTER` overshoots (a spring): its fill continues a quarter of `--MEASURE` past the anchored edge as a second shadow layer (`--r-overlays-drawer-bleed`, in place of the modal's `shadow-lg`), so the arrival's overshoot shows more drawer, not a gap. The bottom sheet's starts a `--RADIUS-LG` down, keeping its rounded corners.
- Overlays, navigation: on a phone, a bottom toast stack sits above an `AppShell` bottom nav instead of covering it. The region adds `--r-navigation-shell-bottom-inset` (published by the shown bottom nav, see Added) to its `--R-SIZE-2` offset; with no bottom nav, or at wider layouts, it is where it was. Browser check `overlays-toast-bottomnav`.
- Content: `Markdown` nests at most 8 containers and keeps a ninth level as text, as its comment said; the cap allowed 9.
- Layout: a `Prose` region's measure counts body characters: r-ui-css's prose region now carries the body prose size, so `max-w-measure` is a count of the text being read, and r-ui-css widens it to 75ch: 75 body characters (about 823px in the default theme at 1280, up from 606px), the same at both densities and in any UI face. Controls inside keep the UI scale. Browser check `layout-prose`.
- Steps, marketing: a `Stepper` (and `Wizard`) marker's number and a `HowItWorks` step number sit in the middle of their circle; they sat about 2px high, centred by a line box that keeps room for descenders. The number is trimmed to its cap height (`text-box: trim-both cap alphabetic`; unchanged where unsupported).
- Navigation: an `AppShell` rail (medium widths, or the sidebar collapsed) with more links than the screen is tall scrolls, like the full sidebar, so its last links and its expand toggle stay reachable; collapsed past the fold, the sidebar could not be reopened. The rail's label bubbles are `position: fixed`, placed beside their link on hover, focus and scroll, so the scroll does not clip them.
- Primitives, navigation, form: at coarse input a text `Button` (so `ToggleGroup` and `Toolbar` text items) and a `Tabs` tab take r-ui-css's `--CONTROL-PAD` sides (`px-control-pad`, 16px at coarse in both densities) and at least `--HIT-MIN` width, so a short label ("OK", "S") is no longer a near-square box nor narrower than the hit floor. `SegmentedControl` segments keep their step-3 sides (the track cannot wrap) and take the `--HIT-MIN` minimum width. Needs r-ui-css's `--CONTROL-PAD` token.
- Overlays: a `Dialog` or `Drawer` at compact density and coarse input no longer scrolls sideways by 1px. Its close button's hit area (grown to `--HIT-MIN` around a smaller visual box) overhung the modal's padding box; the close now sits at least that overhang from the corner (`.r-overlays-close`).
- Steps: the `Wizard`'s step heading, focused on every step change, draws no focus ring (forced colours still show one). A press on Next keeps focus in the text field it left, so the browser carried `:focus-visible` to the heading and drew the ring for mouse users too; the heading is not a control.
- Steps: a horizontal `Stepper` (and so a horizontal `Wizard`) puts each label, with its status and description, under its marker, centred, in steps that share the row equally; the line runs from marker to marker, a `--R-SIZE-5` gap from each, instead of from the end of the label. The ends are inset by half a step. An unbroken word in a label or description breaks inside its step (in either orientation) instead of spilling out.
- Marketing: a `NavigationMenu` panel link's icon (and so a `SiteHeader` dropdown's and its mobile menu's) sits level with the label's first line instead of centred on the label and description together; a label-only row still centres in its row height.
- Feedback: `ProgressBar`'s indeterminate sweep animates `translate` instead of `inset-inline-start`, so it runs off the main thread with no layout or paint per frame; it mirrors under `dir="rtl"` through `--MOTION-INLINE-SIGN`.
- Overlays: under reduced motion every closed surface with an exit (dialogs and the Lightbox, popovers, menus, tooltips, hover cards, toasts, selection lists, navigation panels, chart tooltips) unmounts its content at once. The collapsed 0.01ms exits were still waited on, which kept the content mounted a frame or two after the close.
- Form: `OTPInput` keeps what is typed in the frame after it takes focus. Its focus-time caret placement used the code as it was at focus, so it threw the caret back to the first box and the next keys landed there ("4821" typed fast became "821").
- Form: `OTPInput` keeps a selection made between its focus and the next frame (a caller's `focus()` then `select()`, or a test's `fill("")`, which selects all before it deletes). The focus-time caret placement collapsed it, so the delete removed nothing and the next keys were appended to the old code.
- Charts: a bare `YYYY-MM-DD` x value on a `LineChart` time axis is read as that local calendar day, no longer UTC midnight (the previous day west of Greenwich); `timeZone="UTC"` still reads it as UTC.
- Navigation, marketing: `NavList.Item`, `AppShell.NavItem`, `Breadcrumbs.Item` and `TreeView` node `href`s and `Testimonial`'s `sourceUrl` pass through `safeUrl`, as `Link`, `MediaCard` and `FeatureGrid` already do. Behaviour change: a refused scheme (`javascript:` …) is dropped and the item still renders, with no link (a nav item as text that goes nowhere; a crumb as text; a tree node as a plain node that Enter activates).
- Form: outside a `<form>`, a `RadioGroup` or `SegmentedControl` named by its Field takes its own generated DOM name, so two same-named groups no longer merge into one browser radio group (checking one cleared the other, and the arrows crossed between them). Inside a form, the Field's name is kept.
- Media: `Image` with an empty, blank or missing `src` shows the error fallback and requests nothing, instead of staying in "loading" (and, for a blank `src`, requesting the page's own URL).
- Content: the published declarations of `CodeBlock`'s highlighter no longer import `highlight.js/lib/languages/*`, a wildcard module that an app type-checking its libraries (`skipLibCheck: false`) could not resolve (14 TS2307 errors). Each grammar loader states its type.
- Marketing: `MediaCard`'s `href` is optional. Without one the card renders with its title as text and no link, as it already did for an `href` that `safeUrl` refuses; it threw.
- Data: `DataTable` (and `VirtualizedTable`) skip the holes of a sparse `rows` array, as filtering already did; every present row keeps its source index for `getRowKey`, and the page count and select-all count present rows only. Unfiltered, a hole reached the column accessors and threw.

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

Round 5:

- `CarouselLabels` gains `carousel` and `slideRole` (the `aria-roledescription`s, which were
  hard-coded English): a complete `CarouselLabels` object you build yourself needs them
  (the `labels` prop still takes any subset).
- `DataTableLabels` gains `detailsColumn`, `details`, `columns`, `resizeColumn`,
  `filterColumn`, `filterAll`, `clearFilters`, `noMatches`, `selectedCount`, `bulkActions`,
  `clearSelection`, `rowsPerPage` and `pageRange`, and `DateRangePickerLabels` gains
  `startTime` and `endTime`: the same applies (a complete object you build needs them).
- The chip look is the new `Chip` (primitives): the selection inputs' and FilterBar's chips
  render `.r-primitives-chip` / `.r-primitives-chip-remove`, and `.r-form-chip` /
  `.r-form-chip-remove` (and FilterBar's `.r-filters-chip`) are gone. A stylesheet of yours
  that targeted them renames; the `classNames.chip` slots are unchanged.
- `MediaCard` draws its picture with the new `Image`: a failed image now shows `Image`'s
  fallback (the glyph and the `alt` text) instead of the "no image" placeholder, which is
  kept for a card with no `image`. `MediaCardImage.src` also takes `null` (pending) and
  gains `placeholder` / `placeholderColor`; `MediaRatio` is `Image`'s four fixed ratios.
  The stretched-link class `r-marketing-media-card-link` is now `r-marketing-stretched-link`
  (shared with `FeatureGrid`): a stylesheet of yours that targeted it renames.
- `Table stickyHeader` paints its opaque band on the head's cells only; a body row header
  (`scope="row"`) keeps the row's own paint. A pinned row header of yours that relied on
  the band gives itself a fill.
- `PricingTable`'s pinned feature column paints the canvas by default (a marketing section's
  surface), not `--C-SURFACE-0`. A comparison on a card or a band names its surface with
  `--r-marketing-pricing-surface` (`[--r-marketing-pricing-surface:var(--C-SURFACE-0)]`).
- `useFloating`'s `offsetPx?: number` is replaced by `` offset?: `--${string}` ``: the custom
  property naming the gap between reference and panel (default `--R-SIZE-4`), read at the
  reference each time the position computes, so the gap follows the density written there.
  A caller that passed a number names a token instead. The library's panels keep token gaps
  (comfortable / compact): menus, context menus and selection popups `--R-SIZE-6` (4 / 2px;
  ContextMenu was 2px), tooltips `--R-SIZE-5` (6 / 4px) and `--R-SIZE-3` with an arrow
  (12 / 8px, was 10), chart readouts `--R-SIZE-3` (was 12px), popovers and hover cards the
  default (8 / 6px, was 8).

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

#### Round 5: locale provider, ScrollPanel

Additive, except one type-level change (below, under Breaking).

- `LocaleProvider` (`locale`, `labels`, `dir`) sets the locale and translations once for
  everything beneath it. `labels` is keyed by component (`{ Dialog: { close: "Schließen" } }`,
  type `LocaleLabels`; the key is the `X` of `XLabels`, so the charts share `Chart` and the
  preference controls `PreferencesMenu`), and a wrong key or label name is a type error.
  Precedence: defaults < providers (outer to inner, merged key by key) < a component's own
  `labels`. Nested providers inherit what they do not set; `dir` renders a
  `display: contents` wrapper with `dir` and `lang`. Every labelled component reads it
  (`useLabels`, exported for your own components, with `LabelsProp` and `LabelsRegistry`).
- `useLocale(locale?)`: the component's own `locale`, else the provider's, else the
  runtime's. Every component that formats reads it: `Calendar`, `RangeCalendar`,
  `DatePicker`, `DateRangePicker`, `Timeline`, `NumberInput`, the charts (each keeps its
  `locale` prop, which wins), and `Pagination`, `StatCard`, `Sparkline`, `Meter`,
  `FileUpload` (sizes, progress), `ColorPicker`'s contrast ratio and `DataTable` (numeric
  cells and its text sort's collation), which formatted in the runtime's locale before.
- New labels for strings that had none: `Sparkline` (`labels.noData`, `labels.summary`),
  `ErrorSummary` (`labels.title`; a `title` still wins), `Carousel`
  (`labels.carousel`, `labels.slideRole`: the `aria-roledescription`s).
- `ScrollPanel` (layout): a bounded column whose `Body` alone scrolls and whose `Footer`
  (an action row) sits below the scroller, so a boxed panel's scrollbar stops at its
  actions. `FormActions sticky` stays for a long form in the page's own scroll; tables keep
  their sticky head in their own scroller. The FormActions demo uses the panel.
- `OTPInput` with `mask`: while focused, the first box no longer shows a second dot. A
  filled box is a one-character selection of the real input, and the contract's
  `::selection` inked that character over the boxes; the input's selection is now
  transparent, its autofill paint hidden, and Edge's password reveal button removed.

#### Round 5: sliders, feedback, times of day, DataTable features, toolbar

Additive (the label sets that grew are under Breaking).

- **Form.** `Slider` (one thumb; marks with labels, a value bubble while dragging or keyed,
  vertical, `onValueCommit` once per gesture); `RangeSlider` (+ `RangeSliderValue`; two
  thumbs that push, never cross, a press on a stacked pair picks the thumb by drag
  direction); `Rating` (one slider tab stop in half or whole steps, "No rating" to clear,
  hover preview; `readOnly` is an image named "4.5 out of 5", drawn at any fraction). All
  three are Field-bound and RTL-aware. `ColorPicker`'s own sliders share their pointer and
  key handling.
- **Feedback (new group).** `ProgressBar` (continuous or segmented; indeterminate sweeps,
  and under reduced motion stands still as stripes; the value is floored so unfinished work
  never reads 100%); `ProgressRing` (icon, control and large sizes, a centre slot);
  `Banner` (a named region, `role="alert"` when `urgent`; `top`, inline or `sticky`;
  dismissal remembered under a `dismissKey` in guarded storage, other tabs following);
  `ErrorBoundary` + `ErrorFallback` (`resetKeys`, `onError`, `onReset`, opt-in `details`;
  a retry that fails again keeps focus on the new fallback's button). `ProgressBar` is work
  toward done; `Meter` stays a measured value that moves both ways.
- **Dates.** `TimeField` (spinbutton segments in the locale's order, digits and clock, typed,
  arrowed and pasted; `name` submits wall-clock `HH:mm`; `min`/`max` (a window across
  midnight too), `step`, `withSeconds`, `hourCycle`); `TimePicker` (a TimeField with a list
  of times, centred on the value); `toISODateTime`. `DateRangePicker` gains `withTime`,
  `timeStep` and `hourCycle` (the ends are local instants and the wire carries the UTC
  offset) and a preset's `range(now, context)`. A skipped DST time moves forward by the
  gap; a repeated one is the earlier instant. `DatePicker`'s calendar button does not print.
- **DataTable.** Detail rows (`renderDetail`, `expandedKeys`); a columns menu
  (`columnsMenu`, `visibleColumns`; required columns and the last one cannot hide);
  resizable columns (`resizableColumns`, `columnWidths`; a separator by drag, arrows,
  Home/End, a double click resets; `DEFAULT_COLUMN_MIN`/`MAX`); a sticky bulk-actions bar
  (`bulkActions(keys)`); column filters (`column.filter` text, select or custom, `filters`,
  `manualFiltering`, clear all, a no-matches state); pages (`pageSize`, `page`,
  `pageSizeOptions`, `manualPagination`, `rowCount`); pinned columns (`stickyColumns`).
  Types `DataTableColumnFilter`, `DataTableFilterOption`, `DataTableFilterControl`,
  `DataTableFilters`. `Table` gains `footer`, `Table.HeaderCell` `after`, and rows
  `data-band`. `VirtualizedTable` takes everything but detail rows and pages (by type).
- **Toolbar (new group).** `Toolbar` (+ `Item`, `Group`, `Separator`; `role="toolbar"`,
  a name required by type; one tab stop with arrows, Home and End, while a text input
  keeps its caret and a select its keys; trailing units move into "More" by measured
  width; on coarse input the gap grows so no two hit areas overlap); `ToggleGroup`
  (`type="single"` is a radio group that cannot clear, `type="multiple"` pressed buttons;
  Field-bound, one hidden input per value; its own arrows when standalone, and it wraps
  when its row is too long). There is no standalone `Toggle`: a pressed `Button` is one.
- `Pagination` gains a `row` slot (the row that holds the arrows and pages).
- `Timeline`'s connector is continuous: mark · gap · line · gap · next mark, with the same
  gap at every mark (icon or dot), in the stronger border colour, kept under forced
  colours.
- `Banner`'s text breaks a long word anywhere, so a content-sized track (an `auto` grid
  column) cannot be widened by it.
- Checks: `verify:group-deps` also counts a class borrowed by name (`"r-form-frame"` in
  dates) as an edge; `verify:utilities-exist` matches a class-named table used in another
  file by its import, not by spelling (a local `classes` no longer turned the BarChart
  demo's error categories into classes). New browser checks: `sliders-interaction`,
  `feedback-progress`, `feedback-banner-boundary`, `time-field`, `time-picker-range`,
  `datatable-rows`, `datatable-columns`, `toolbar-keyboard`, `toolbar-layout`;
  `timeline-layout` measures every thread; `forced-colors-states` audits the progress
  track and ring. The showcase's section boundary is the library's `ErrorBoundary`.

#### Round 5: filters, trees, guards, hover cards, panes, inputs, boards

Additive (the chip classes that moved are under Breaking).

- **Filters (new group).** `FilterBar`: typed filter definitions (`select`, `multi`,
  `range`, `dateRange`, `toggle`, `search`, `custom`) over the existing controls; a value
  keyed by id, the shape of `DataTable`'s `filters`; applied filters as removable chips,
  Clear all, and a result count shown at once and spoken once it settles
  (`RESULT_ANNOUNCE_DELAY_MS`); folds into "Filters (n)" and a drawer by its own width
  (`collapse` `auto` / `always` / `never`, the drawer controllable). `filtersToSearchParams`
  / `searchParamsToFilters` (pure). Labels `FilterBar`.
- **Navigation.** `TreeView`: items as data (`TreeNode`) or `TreeView.Item`; selection none,
  single or multiple (tri-state, a disabled child left alone); `expandedIds`; lazy
  `loadChildren` with loading and retryable error rows; `onAction` and `renderActions` (only
  the focused row's actions are in the Tab order, and never in the row's name); router
  links; windowed past `virtualizeAbove` (200), printing the rows it has with a note.
- **Guards (new group).** `RequireAuth`: renders `children` only for `status ===
  "authenticated"` (any other value waits), `authorize`, default or custom loading,
  signed-out and forbidden fallbacks, `onUnauthenticated` once per arrival, `signInHref`
  through the `RouterProvider`.
- **Overlays.** `HoverCard` (+ `Trigger`, `Toggle`, `Content`): opens on hover or keyboard
  focus after `openDelay` (500ms), closes after `closeDelay` (300ms) with a bridge for the
  pointer, rendered in place after its trigger so Tab walks into it, Escape from anywhere,
  and a toggle button for touch.
- **Layout.** `Splitter` (+ `Pane`): the APG window splitter, side by side or stacked;
  `sizes` / `defaultSizes` / `onSizesChange` / `onSizesCommit`; pane `min` / `max` as shares
  or token lengths; collapsible panes (Enter or a double click collapses and restores);
  arrows, Home and End; nests. The separator is a `--R-SIZE-5` gutter whose hit area hangs
  over the pane after it, never over the scrollbar of the pane before.
- **Form.** `PasswordInput` (show/hide that keeps value, focus and selection, a "Show
  password" toggle whose state is `aria-pressed`, an optional strength meter
  (`estimatePasswordStrength` or your own), a Caps Lock warning); `MaskedInput` (`mask`,
  `tokens`, `onValueChange(raw, formatted)`, `onComplete`; the caret stays put through
  inserts, deletes and pastes); `CurrencyInput` (a textbox in the locale's money format,
  `currency`, `minorUnits`, `min` / `max`, `allowNegative`, `currencyDisplay`);
  `AvatarUpload` (pick, crop and zoom, upload with a progress ring, cancel and retry, the
  `FileUpload` upload contract). `NumberInput` and `CurrencyInput` share one draft model (no
  change to `NumberInput`'s behaviour).
- **Primitives.** `AvatarGroup` (overlapping faces, a "+n" that names the rest,
  `renderOverflow` for a control of your own); `Chip` (a value as a token: one line,
  truncated with its title, an optional remove button that Backspace and Delete also press;
  `labels.remove`), now the chip of `MultiSelect`, `TagInput` and `FilterBar`.
- **Boards (new group).** `Kanban<T>`: columns with WIP limits, `value` +
  `onValueChange(next, move)`, `renderCard`, collapsible columns, pointer, touch and keyboard
  moves (the card stays put and a measured line shows where it lands; moves, limits and
  drops are announced), edge scrolling, and a snapping one-column layout when narrow.
- **Changed.** `DataTable`: a column's `width` (or a resized width) is exact, a minimum as
  well, so widening a column in a table already at its own width grows the table instead
  of squeezing a neighbour; a resizable column's automatic width keeps its `minWidth`; a
  double click restores the column's own `width`. `Slider` / `RangeSlider`: the rail is
  inset by half the hit floor or half a thumb, the larger, so an end thumb's coarse hit
  area stays inside the slider (it scrolled a drawer sideways). `PasswordInput` restores
  the selection after Chromium resets it on the type swap.
- Checks: `verify:no-raw-tailwind` judges a bare word that is also a utility (`shadow`) as a
  class only in a class context, so a word list keeps its words. New browser checks:
  `filters-bar`, `filters-layout`, `tree-keyboard`, `tree-layout`, `tree-require-auth`,
  `hovercard-splitter-card`, `hovercard-splitter-panes`, `form-inputs-text`,
  `form-inputs-avatars`, `kanban-keyboard`, `kanban-pointer`, `kanban-layout`;
  `datatable-columns` resizes a squeezed table, `print-pages` prints a windowed tree.

#### Round 5: marketing and media

Additive (the MediaCard and Table changes are under Breaking).

- **Marketing.** `NavigationMenu` (links, dropdowns and mega panels as APG disclosure
  navigation, never a menu; `open` controllable; hover intent with a bridge, a press pins a
  hover-opened panel; mega panels span `anchorRef`; `navigationMenuLinks`) and `SiteHeader`
  (brand, navigation, actions; `solid` / `transparent`, `sticky`, `hideOnScroll`;
  `collapseBelow` folds it by its own width into a menu drawer with the same links as an
  accordion; a skip link; the bar's height published as `--r-marketing-site-header-h`).
  `Footer` (+ `Column`, `Link`, `SocialLink`: brand, newsletter slot, link columns that fold
  into an accordion by the footer's width, legal row, social links, locale switcher, `plain`
  / `band`; prints its legal row only) and `LogoCloud` (monochrome logos, inverted on a dark
  scheme; `colorOnHover`; an optional marquee with a pause toggle, held on hover and focus,
  still under reduced motion). `Pricing` (plan cards sharing their rows, a monthly / annual
  toggle announced once per change, locale currency, "Free" / "Custom", a highlighted plan
  in words) and `PricingTable` (plans compared in the library `Table`, head and feature
  column pinned in its own scroller, explanations by hover, focus or press). `Testimonial`
  (`card` / `pull` / `compact`; avatar, rating, logo, the source work as `<cite>`; the
  language's quotation marks). `FeatureGrid` (+ `Item`), `FeatureRows` (+ `Row`),
  `HowItWorks` (+ `Step`, in the Stepper's look), `CallToAction` (`stacked` / `split`) and
  `EmailCapture` (validation, pending, failure with retry, a focused success status,
  consent, honeypot). Labels `NavigationMenu`, `SiteHeader`, `Footer`, `LogoCloud`,
  `Pricing`, `Testimonial`, `EmailCapture`.
- **Media (new group).** `Image` (a box sized before it loads from `width` / `height` and a
  ratio, `fit`, `radius`, a blurred preview and a colour while it loads, a cross-fade, a
  fallback that keeps the alt; `src: null` is pending; lazy unless `priority`), `Lightbox`
  (+ `Trigger`: a modal viewer with keys, swipes and neighbour preloading, controllable;
  labels `Lightbox`) and `MasonryGrid` (columns by its own width, items packed in source
  and tab order, a plain grid on paper).
- **Changed.** The `Carousel` track hides its scrollbar and stays a native scroller.
  `SegmentedControl`'s segments take the `hit-area`, so a press anywhere in the frame's
  padding picks the segment above or below it. A stretched `DateRangePicker` trigger
  reads as a field: the value at the start, the chevron at the end.
- Checks: `verify:class-prefix` also fails a rule with no class of its own (`:root`) that
  declares anything but the owner's `--r-<group>-…` custom properties. New browser checks:
  `site-header-menu`, `site-header-layout`, `footer-logos-footer`, `footer-logos-marquee`,
  `pricing-plans`, `pricing-compare`, `pricing-testimonials`, `features-cta-layout`,
  `features-cta-email`, `media-image`, `media-lightbox`, `media-masonry`;
  `marketing-components` proves the carousel's hidden scrollbar.

#### Round 5: motion extras, the Marketing and Dashboard pages

Additive (the PricingTable surface is under Breaking).

- **Motion.** `Parallax` (`strength` subtle / medium / strong; a decorative layer on a CSS
  view timeline, no script; the box is `aria-hidden`, `inert` and takes no pointer; still
  under reduced motion, in print and without scroll-driven animations), `CountUp` (counts to
  `value` once in view, every frame in the locale with `formatOptions` or `format`; the
  final value is in the markup and the only one read; timing from the motion tokens),
  `ReadingProgress` (polymorphic; a bar that sticks to the scrollport's top and fills through
  the region it wraps, on a view timeline with a passive-listener fallback; `aria-hidden`,
  not printed, takes no space: what follows it keeps the region's first margin) and
  `Spotlight` (polymorphic; a soft wash under a card's content that follows a fine pointer,
  off on touch, coarse input, reduced motion, forced colours and paper).
- **Domain token** `--PARALLAX-SHIFT`: how far `Parallax` drifts at its medium strength
  (subtle half, strong one and a half), by default `--MOTION-DISTANCE-LG` × 4. A theme tones
  parallax down or off without moving reveals; reduced motion and print zero it whatever a
  theme set.
- **Marketing.** `SectionHeading` (eyebrow, display heading, lead; `headingLevel`, `align`,
  `titleId` for the section's name): the heading group every section after the hero opens
  with. `SiteHeader` sticks `--r-marketing-site-header-top` below its scroller's top (a bar
  the host already sticks there) and, hidden, slides past that offset too.
- **Dates and filters.** `DateRangePicker now` and `FilterBar now`: the instant presets
  resolve against (a frozen specimen, a replay), so presets stay usable when `max` is the
  data's "now". A `dateRange` filter takes a `placeholder`. `filtersToSearchParams` and
  `searchParamsToFilters` take `defaults`: the default view is the bare URL, a removed
  default is written empty (`time=`), and a missing parameter reads as its default.
- **Changed.** An overflowing `Toolbar` never shrinks below what cannot leave it (its pinned
  units and "More"), so a growing sibling cannot squeeze it to nothing. An `Image` inside a
  prose region keeps its picture flush with its box (prose's `* + img` margin and image
  radius no longer reach it).
- **Showcase.** The Marketing page is rebuilt from the library (SiteHeader, Hero, LogoCloud,
  FeatureRows with parallax illustrations, HowItWorks, FeatureGrid with spotlight cards,
  counting figures, a Testimonial carousel, the journal essay with a reading bar, MediaCard
  posts, Pricing and PricingTable, an FAQ Accordion, CallToAction with EmailCapture, Footer
  with a region switcher through `LocaleProvider`). The Dashboard adopts FilterBar (time,
  region, status, latency, search; in the URL), a header Toolbar, the DataTable features
  (columns menu, resizing, a pinned column, detail rows, bulk actions, pages), rollout and
  export progress, a maintenance Banner, a HoverCard on teams and an ErrorBoundary per card.
- Checks: new browser checks `motion-extras-parallax`, `motion-extras-count-up`,
  `motion-extras-reading`, `motion-extras-spotlight`; `marketing-page` proves the site header
  under the showcase's bar, anchors clearing both bars, a picture flush inside prose and the
  essay's reading bar; `dashboard-layout` proves the FilterBar, Toolbar, table features,
  progress, Banner and per-card boundaries; `toolbar-layout` proves the toolbar's floor.

#### Bottom-nav inset, hero backdrop, view-transition runs, rating colour

Additive (the `useFloating` gap is under Breaking).

- **Navigation.** `AppShell.BottomNav` publishes its block size on `:root` as
  `--r-navigation-shell-bottom-inset` while it is shown (measured, so it follows content,
  density and a `className`; nested shells' shown navs add up; removed when none is shown
  and on unmount), so fixed content pinned to the viewport's bottom adds it to clear the
  nav. A forwarded `ref` still reaches the nav.
- **Marketing.** `Hero` takes `backdrop`: a decorative layer behind its content that covers
  the hero (its band fill too) and is clipped to it, painted under the text, `aria-hidden`,
  `inert`, taking no pointer, not printed and hidden under forced colours. It clips without
  being a scroll container, so a view timeline inside (a `Parallax`) follows the page.
  `classNames.backdrop` reaches the layer.
- **Motion.** `startViewTransition` and the function `useViewTransition()` returns return a
  `ViewTransitionRun` (exported): still a promise that settles once the update has applied,
  plus `finished`, which settles when the animation ends, or right after the update when the
  transition is skipped (no API, reduced motion, a newer transition). A skip rejects
  neither; an update that throws rejects the run, never `finished`.
- **Domain token** pair `--C-RATING-LIGHT` / `--C-RATING-DARK` (a warm amber, held to 3:1 as
  a mark on every surface by `verify:domain-contrast`; both halves CanvasText under forced
  colours) and the utility `*-rating`.
- **Dates.** `DateRangePicker variant="field"`: the trigger is a form field's box filling its
  row, the value at the start and the calendar icon at the end, for a range beside other
  fields; `button` (the default) is unchanged.
- **Changed.** `Rating` fills with `text-rating`, not the accent (a rating is data; the
  accent means interactive); a `text-*` colour class on the root still retints it.
  `FilterBar`'s time range is a field (`variant="field"`) like its other controls.
  `Spotlight` registers `--r-motion-spotlight-x` / `-y` (`<number>`, not inherited, `0.5`),
  so a pointer move restyles the card alone, not its subtree.
- **Showcase.** A Hero with a `Parallax` backdrop; a DateRangePicker field-look row; a
  Rating row under Domain tokens. The motion demos' transition helper is the library's
  `startViewTransition` and its `finished`.
- Checks: new browser checks `overlays-toast-bottomnav` and `marketing-hero-backdrop`;
  `motion-extras-spotlight` proves the shares do not inherit, `form-sliders` the rating
  colour (light, dark, forced), `filters-layout` the time range's field frame.

### Known gaps

Not built yet, and known to be missing:

- No display-text measure token: long display headings are capped by the caller.
- No fluid spacing step below `section-3` for tight marketing rhythm.
- `Section variant="band"` assumes edge-to-edge layout; inside a shell that pads its content,
  the page has to cancel that padding itself.
- Toasts are not interactive while a modal dialog is open (the dialog makes everything
  outside it inert).
