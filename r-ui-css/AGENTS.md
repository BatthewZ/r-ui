# @batthewz/r-ui-css: how to use it

A pure-CSS token contract. Tailwind v4, CSS-first (no `tailwind.config.js`). Tokens are custom properties on `:root`; `@theme inline` exposes them as utilities. The default theme IS `:root`; other themes override tokens under `:root[data-theme="…"]`.

> If you are about to write a raw colour, a raw `rem`/`px`, or a Tailwind default (`p-4`, `text-sm`, `bg-blue-500`, `rounded`, `leading-tight`), stop: there is a token for it. Most of those defaults are removed from the build and generate nothing. If no token fits, that is a contract question, not a licence.

## Install

```css
@import "@batthewz/r-ui-css"; /* Tailwind + tokens + animations + base + prose */
@source "./src/**/*.{html,tsx}"; /* your sources, self-relative */
```

| Subpath | When |
| --- | --- |
| `@batthewz/r-ui-css` | Always. Imports no theme override layer. |
| `@batthewz/r-ui-css/examples/themes/<name>` | A worked example theme, for demos. Sample code, outside semver. |
| `@batthewz/r-ui-css/theme-template` | The annotated template, for tooling. Copy it to write a theme. |
| `@batthewz/r-ui-css/tokens` | Tokens and mappings only, no base or prose rules (rare). |

## Naming rules

- `--C-TEXT-X` -> `text-fg-x` (the `fg-` prefix keeps colour apart from `text-h1`). Every other `--C-X` -> `x` (`bg-x`, `border-x`, `ring-x`, `fill-x`…).
- Numbered scales descend: **1 is always the largest** (`r1`, `h1`, `body-1`, `display-1`, `section-1`).
- In raw CSS, read the custom properties: `padding: var(--R-SIZE-3)`. They follow theme, density and input automatically.

## Utilities

### Colour

```
bg-canvas  bg-surface-0  bg-surface-1  bg-surface-2  bg-surface-3
text-fg-primary  text-fg-secondary  text-fg-muted  text-fg-inverse  text-fg-accent
bg-primary  bg-primary-hover  bg-primary-active      text-fg-on-primary
bg-accent   bg-accent-hover                          text-fg-on-accent
bg-selection                                         text-fg-on-selection
border-border  border-border-strong  bg-scrim  outline-focus  ring-focus
bg-status-{error|success|warning|info}      mark: icons, dots, borders, solid badges
text-fg-{error|success|warning|info}        status text, >= 4.5:1 on surfaces
bg-status-{error|success|warning|info}-bg   subtle status background
text-fg-on-{error|success|warning|info}     text on the mark used as a fill
```

Every colour works with every colour utility (`bg-`, `text-`, `border-`, `outline-`, `ring-`, `fill-`, `stroke-`, `divide-`, `decoration-`, opacity modifiers like `bg-accent/10`). The Tailwind palette is removed. A bare `border` draws `--C-BORDER` at `--BORDER-WIDTH`.

What is guaranteed (and measured by `bun run check`):

- Every `text-fg-*` text role reads on the canvas and on every surface (>= 4.5:1).
- Marks (`status-*`, `accent`, `focus`, `border-strong`) read on every surface (>= 3:1).
- Each `on-*` reads on its own fill. **A fill is not guaranteed against a surface**: draw ink on a surface with a `text-fg-*` token, never a fill token.
- `text-fg-inverse` reads on `bg-fg-primary` (tooltips).
- A surface step alone is a weak cue (about 1.02 to 1.15:1). Never use it as the only edge of a region, a hover, or a selected state: add a border, ring or ink change.

### UI type (density-driven, flat across viewports)

```
text-h1 … text-h6          size + tight leading + heading face, weight, tracking, case
text-body-1  text-body-2  text-body-3
font-normal  font-medium  font-semibold
font-ui  font-heading  font-display  font-mono
```

`h1`–`h6` elements get the UI scale and the heading face by default. In an app, headings separate by weight and space more than size.

**Faces are a chain of roles**: `--FONT-UI` (body, controls, data) ← `--FONT-HEADING` (in-app headings: `h1`–`h6`, `text-h*`) ← `--FONT-DISPLAY` (`text-display-*`, prose headings). Each optional role falls back to the one before it, so a theme that sets only the UI face moves all three. The `text-h*` and `text-display-*` utilities carry their role's face; a `font-*` utility on the same element still wins (`text-h2 font-mono` is a mono heading), as do `normal-case` / `uppercase` and the numeric utilities. Known limit: the line-height modifier form (`text-h1/(--X)`) sets only size and line height, not the face, weight, tracking or case; write `text-h1 leading-(--X)` instead.

**Figures**: data figures (`--NUMERALS-DATA`, tabular by default) on body text and every UI region; prose figures (`--NUMERALS-PROSE`, proportional) in prose regions and on `text-display-*`. A theme can change either, e.g. `tabular-nums slashed-zero`.

### Prose / display type (fluid, density-independent)

```
text-display-1 … text-display-4    hero, page title, section, subsection (display face, prose figures)
text-prose-1  text-prose-2  text-prose-3    lead, running prose, caption
max-w-measure                      reading line length
```

Mark a long-form region with `class="prose"` or `data-prose`. Its `p`, lists, headings, `blockquote`, `code`, `pre`, `hr`, links and figures take the prose scale. The region takes the body prose size, so `max-w-measure` on it counts body characters. **Controls inside it keep the UI scale**: each sets its own size, a bare form control is reset, role-bearing lists and links with a class are skipped, and `.not-prose` / `data-not-prose` excludes a subtree. Utilities override region styles (`<p class="text-prose-1">` is a lead). Do not combine with a third-party `.prose` plugin.

### Spacing and sizing

```
p-r1 … p-r6   (every spacing utility: m-, gap-, space-, inset-, top-, w-, h-, size-…)
h-control  size-control    buttons, inputs, selects: max(density, hit floor)
px-control-pad             a text control's inline padding (step 3, widened with the hit floor); not px-control
h-row                      table rows, list and menu items: max(density, hit floor)
size-icon                  inline icons
min-h-hit  size-hit        the input axis hit floor (24px fine, 44px coarse)
hit-area                   invisible hit box of at least the floor around a small-looking control
py-section-1 … py-section-3   fluid section rhythm (marketing layout)
px-gutter                  fluid page side padding
max-w-page                 widest a page's content column grows (gutters outside it)
w-column-sm/md/lg  min-w-column-*  basis-column-*   auto-fit column floors
```

`r`, `control`, `row` and `icon` follow density; `section-*` and `gutter` are fluid and density-independent; `page` and `column-*` are fixed lengths, independent of density and viewport.

The same names are container variants: `@column-md:flex`, `@max-column-sm:hidden`, `@max-page:…` (on an element inside a `@container`), alongside Tailwind's own container steps (`@sm:`, `@max-3xs:`). A container query cannot read a custom property, so each variant compiles to the token's DEFAULT length: a theme that retunes `--COLUMN-MD` moves the `column-md` boxes, not the `@column-md:` breakpoint.

`hit-area` is how a visually small control (checkbox, switch, icon button, a breadcrumb link) meets `--HIT-MIN` without growing: an invisible `::before`, centred, at least the floor on each axis and flush on an axis already past it. It makes the element `position: relative` and a stacking context, and keeps the box behind the element's own content, so a native input drawn inside still takes the press. Overlapping hit areas resolve by paint order, so a hit area that directly follows another does not grow toward it on the inline axis: in a row of small targets every visible box keeps its own presses and the earlier one's growth fills the gap. Small targets that are not DOM siblings, or that stack vertically, need `--HIT-MIN` between their centres. Controls sized `h-control` / `h-row` already meet the floor and need no `hit-area`.

An auto-fit grid reads a column floor: `grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--COLUMN-MD)), 1fr))`.

### Shape, depth, state

```
rounded-sm  rounded-md  rounded-lg  rounded-xl  rounded-full
border  border-b  divide-y …         structural lines, all at --BORDER-WIDTH (1px, or 2px for a bold brand)
shadow-sm  shadow-md  shadow-lg      floating layers only: tooltip, menu/popover/toast, dialog/sheet
opacity-disabled
focus-ring  focus-ring-inset         the package focus indicator, e.g. focus-visible:focus-ring
```

Write a structural line as a bare `border` / `border-b` / `divide-y`, never `border-2` or `border-[1.5px]`: the bare forms follow the theme's line weight. Boxes are border-box, so `h-control` and `h-row` keep their height at any weight.

Every `:focus-visible` element already gets the ring from the base layer. If a component resets outlines (`outline-none`), it must restore them with `focus-visible:focus-ring`. Native checkboxes, radios, ranges, progress bars and date/colour pickers take `--C-ACCENT` (`accent-color`), and so does the text caret.

### Stacking

```
z-raised    above its siblings in one scroller: a sticky table header or first column
z-sticky    sticky page chrome over scrolled content: app header, toolbars
z-docked    bars fixed to a viewport edge, over sticky chrome: bottom nav, action bar
z-bypass    keyboard bypass shown on focus, over everything in flow: skip links
```

In-flow stacking only, in this order. Dialogs, popovers, menus and toasts use the top layer (`<dialog>`, `popover`) and need no z-index at all. Numeric `z-*` is for one-offs inside a component, never for page chrome.

### Forced colors (Windows High Contrast)

The package handles the contract: every colour role becomes a system colour (selection and accent are `Highlight`/`HighlightText`, the primary fill an inverted button, borders and status marks `CanvasText`), `::selection` follows, and focus is always an outline. Every `bg-` utility for a fill that carries text or meaning (`bg-primary*`, `bg-accent*`, `bg-selection`, `bg-status-*`, `bg-fg-primary`) opts its element out of the browser's repainting, so the fill and its text survive, and remaps the neutral and status text roles and the border roles inside it to the fill's text colour, and `--C-FOCUS` for its descendants. `--SCHEME-DARK` follows the forced palette, not the theme. Components follow four rules:

1. **Draw state with a token utility, and the rest is automatic.** `aria-selected:bg-selection`, `bg-accent` for a checked box or the "you are here" bar, `border-accent` for an active tab: each stays visible. A translucent wash (`bg-accent/10`, a hover on `bg-surface-2`) disappears, so it must never be the only cue for a state.
2. **Every control edge is a border or an outline, never a fill or a shadow alone.** The browser drops `box-shadow` and paints backgrounds as Canvas, but it draws borders, even transparent ones, in a system colour. A control whose edge is only a fill gets `border border-transparent`.
3. **Focus is an outline.** Use the base ring or `focus-ring`; a ring drawn with `box-shadow` (`ring-*`) vanishes, and the package forces `outline-style: solid` on `:focus-visible` to catch it. That also revives `outline: none`: a part whose frame draws its ring resets with `outline: 0 none` (zero width), or it shows a second ring.
4. **`forced-colors:forced-color-adjust-none` only where the colour IS the information** (a swatch, a data series) and the element carries its own label. Everything inside it must read tokens, which are system colours here.

### Print

Printing is ink on paper, for every theme: under `@media print` the package sets a light, neutral palette (white canvas and surfaces, near-black text, mid-grey lines, a blue accent; links underline), `color-scheme: light`, `--SCHEME-DARK: 0` (so extensions take their light values), no shadows and no motion. Like reduced motion and forced colors, it is `!important` on `:root`, so it beats any `:root[data-theme]`; a theme may not use `!important` (`bun run check`). Browsers drop background colours when printing unless told otherwise, so meaning never rests on a fill there: text, borders, icons and labels carry it. The exception is a fill that carries its own text (`bg-primary*`, `bg-accent*`, `bg-selection`, `bg-status-*`, `bg-fg-primary`): it prints its colour, or its `on-*` ink would be left light on white.

Mark elements with `data-print` (a space-separated list, e.g. `data-print="avoid-break exact"`):

```
data-print="hide"          never printed: interactive-only controls (copy, toggles, pagination, view menus)
data-print="only"          printed only, hidden on screen (a print header, a "printed on" line)
data-print="break-before"  starts a new page
data-print="avoid-break"   kept on one page when it fits (a card, a figure, a row group)
data-print="exact"         colour IS the data (a heat cell, a swatch, a meter fill): its background prints
data-print="flow"          a window or scroller (fixed, sticky, overflow, a set height) prints in the flow, full height, unclipped
```

`exact` is inherited, so put it on the smallest element whose colour carries the data, never on a region. Without any attribute: figures, tables rows, images, `pre` and `blockquote` avoid breaking inside, headings stay with what follows, paragraphs keep at least 3 lines at a page edge, a table's head repeats on every page, and an external link (`http…`) in a prose region prints its URL after the text (links with a class, i.e. UI links, do not). Page margins come from `@page`; a later `@page` of the app's own wins.

### Motion

```
duration-fast  duration-normal  duration-slow
ease-standard  ease-enter  ease-exit
transition / transition-colors …   default to --DURATION-FAST + --EASE-STANDARD
animate-fade-in  animate-fade-out  animate-fade-up  animate-fade-down
animate-fade-start  animate-fade-end  animate-slide-in-end  animate-slide-out-end
animate-scale-in  animate-scale-out
animate-morph-expand  animate-morph-collapse  animate-morph-reorder
animate-spin  animate-pulse  animate-ping  animate-bounce     (Tailwind's, kept for loading states)
```

Each animation also exists as a plain class (`.fade-up`). Helpers: `.stagger-item` (set `--stagger-index` per child), `.scroll-reveal-hidden` (start state for an IntersectionObserver reveal). `start`/`end` follow `dir="rtl"`. **Reduced motion is handled at the token level**: durations collapse to ~0 and distances to 0, so components need no reduced-motion rules of their own.

## Raw tokens

| Group | Tokens |
| --- | --- |
| Scheme | `color-scheme`, `--SCHEME-DARK` (0 light / 1 dark) |
| Neutrals | `--C-CANVAS`, `--C-SURFACE-0..3`, `--C-TEXT-PRIMARY/SECONDARY/MUTED/INVERSE`, `--C-BORDER`, `--C-BORDER-STRONG`, `--C-SCRIM` |
| Action | `--C-PRIMARY`, `-HOVER`, `-ACTIVE`, `--C-TEXT-ON-PRIMARY` |
| Accent | `--C-ACCENT`, `--C-ACCENT-HOVER`, `--C-TEXT-ON-ACCENT`, `--C-TEXT-ACCENT`, `--C-SELECTION`, `--C-TEXT-ON-SELECTION`, `--LINK-DECORATION`, `--LINK-UNDERLINE-OFFSET` |
| Focus | `--C-FOCUS`, `--FOCUS-WIDTH`, `--FOCUS-OFFSET` |
| Status | `--C-STATUS-{S}`, `--C-TEXT-{S}`, `--C-STATUS-{S}-BG`, `--C-TEXT-ON-{S}` for S = ERROR, SUCCESS, WARNING, INFO |
| Faces, weights | `--FONT-UI`, `--FONT-MONO`, `--FONT-HEADING` and `--FONT-DISPLAY` (optional, undeclared), `--FONT-UI-SIZE-ADJUST` / `--FONT-HEADING-SIZE-ADJUST` / `--FONT-DISPLAY-SIZE-ADJUST` (optional, undeclared), `--WEIGHT-NORMAL/MEDIUM/SEMIBOLD`, `--HEADING-WEIGHT`, `--HEADING-TRACKING`, `--HEADING-CASE`, `--DISPLAY-WEIGHT` |
| Figures | `--NUMERALS-DATA` (tabular-nums), `--NUMERALS-PROSE` (proportional-nums): `font-variant-numeric` values |
| UI scale (density) | `--R-SIZE-1..6`, `--H1..H6` + `--Hn-line-height`, `--BodyText-1..3` + `-line-height`, `--ICON` |
| Axis-derived | `--HIT-MIN`, `--CONTROL-H`, `--CONTROL-PAD`, `--ROW-H` (the last three registered `<length>`: getComputedStyle returns px) |
| Per-density named values | `<selected name>-COMFORTABLE` / `-COMPACT` for every density token, e.g. `--R-SIZE-3-COMPACT`, `--H1-line-height-COMFORTABLE`, `--CONTROL-H-COMPACT` |
| Prose / display | `--DISPLAY-1..4` + `-line-height` + `-tracking`, `--ProseText-1..3` + `-line-height`, `--PROSE-FLOW`, `--MEASURE`, `--SECTION-1..3`, `--GUTTER` |
| Layout widths | `--PAGE-MAX`, `--COLUMN-SM/MD/LG` (fixed, density-independent) |
| Shape, depth | `--RADIUS-SM/MD/LG/XL/FULL`, `--BORDER-WIDTH`, `--SHADOW-SM/MD/LG`, `--OPACITY-DISABLED` |
| Stacking (structure, not themeable) | `--LAYER-RAISED` 1, `--LAYER-STICKY` 10, `--LAYER-DOCKED` 20, `--LAYER-BYPASS` 30 |
| Motion | `--DURATION-FAST/NORMAL/SLOW`, `--EASE-STANDARD/ENTER/EXIT`, `--MOTION-DISTANCE-SM/MD/LG`, `--MOTION-SCALE-FROM`, `--MOTION-STAGGER`, `--MOTION-PAGE-IN/OUT`, `--MOTION-INLINE-SIGN` (set from `dir`) |

## Axes, in one paragraph each

See [docs/axes.md](docs/axes.md) for the detail.

- **Theme**: `<html data-theme="name">`, root only. One scheme per theme.
- **Density**: `data-density="comfortable" | "compact"` on any element. Closed set. A subtree may differ from its page.
- **Input**: `@media (pointer: coarse)` raises `--HIT-MIN` to 44px; `html[data-input="fine"|"coarse"]` forces it. Small-looking controls meet the floor with `hit-area` (a pseudo-element), not by growing.
- **Container**: components adapt to their own width with `@container` and `cqi`. The viewport only moves layout; an `@media (width …)` never redefines a token.

## Where things live

| Path | What |
| --- | --- |
| `src/index.css` | Public entry |
| `src/tokens/` | The contract: `reset` (clears replaced Tailwind scales), `color`, `print` (the paper palette), `forced-colors`, `type`, `density`, `input`, `shape`, `layer`, `motion` |
| `src/base.css` | Body text and figures, canvas, faces, hairline default, accent and caret, selection, focus ring (an outline in forced colors), heading defaults |
| `src/prose.css` | Prose regions |
| `src/print.css` | Page margins, breaks, the `data-print` conventions, prose link URLs on paper |
| `src/animations/` | Keyframes, classes and `animate-*` utilities |
| `src/_theme-template.css` | Every themeable token, grouped by brand lever, one-line role each |
| `src/examples/themes/` | Worked examples. Nothing imports them; safe to delete |
| `scripts/` | `check` (contrast, theme rules, compile) and their tests |
| `specimen/` | Visual specimen (not published) |

## Don'ts

- No `tailwind.config.js`.
- No `light-dark()`: a theme is light or dark. Use `--SCHEME-DARK` to tune an extension for dark.
- No theme selector other than `:root[data-theme="…"]`; no subtree themes.
- No setting a selected density name (`--R-SIZE-3`, `--H1`, `--ICON`) or `--CONTROL-H` / `--CONTROL-PAD` / `--ROW-H` / `--HIT-MIN` in a theme. Set the `-COMFORTABLE` / `-COMPACT` names.
- No `@media (width …)` that redefines a token.
- No `!important` in a theme: the package's preference and print overrides beat a theme only because theirs are important.
- No font loading in a theme (`@import`, `@font-face`): a theme names families; the app loads them.
- No `--LAYER-*` in a theme, and no numeric `z-*` for page chrome: use `z-sticky`, `z-docked`, `z-bypass`.
- No font size on `:root` (it moves `rem`).
- No example theme name in a selector, type, default, config list, fixture or doc outside its own file. `bun run check` fails on it.
- No fill token as ink on a surface; no surface step as the only boundary.
- No domain tokens here (charts, series, tables, KPIs). They belong to the library that owns the domain, which can extend this contract with its own `@theme inline` block.
