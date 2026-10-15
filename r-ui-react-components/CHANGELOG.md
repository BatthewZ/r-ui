# Changelog

All notable changes to `@batthewz/r-ui-react-components`. Breaking changes to the domain
tokens or the public surface are versioned events and are recorded here.

## Unreleased

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

### Known gaps

Not built yet, and known to be missing:

- No disclosure / accordion component.
- No line, bar or heatmap chart (only `Sparkline` and `Meter`; the heat-cell size token waits
  for a heatmap).
- No display-text measure token: long display headings are capped by the caller.
- No fluid spacing step below `section-3` for tight marketing rhythm.
- `Section variant="band"` assumes edge-to-edge layout; inside a shell that pads its content,
  the page has to cancel that padding itself.
- Toasts are not interactive while a modal dialog is open (the dialog makes everything
  outside it inert).
