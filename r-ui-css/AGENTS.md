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

Every colour works with every colour utility (`bg-`, `text-`, `border-`, `outline-`, `ring-`, `fill-`, `stroke-`, `divide-`, `decoration-`, opacity modifiers like `bg-accent/10`). The Tailwind palette is removed. A bare `border` draws `--C-BORDER`.

What is guaranteed (and measured by `bun run check`):

- Every `text-fg-*` text role reads on the canvas and on every surface (>= 4.5:1).
- Marks (`status-*`, `accent`, `focus`, `border-strong`) read on every surface (>= 3:1).
- Each `on-*` reads on its own fill. **A fill is not guaranteed against a surface**: draw ink on a surface with a `text-fg-*` token, never a fill token.
- `text-fg-inverse` reads on `bg-fg-primary` (tooltips).
- A surface step alone is a weak cue (about 1.02 to 1.15:1). Never use it as the only edge of a region, a hover, or a selected state: add a border, ring or ink change.

### UI type (density-driven, flat across viewports)

```
text-h1 … text-h6          size + tight leading + heading weight/tracking
text-body-1  text-body-2  text-body-3
font-normal  font-medium  font-semibold
font-ui  font-mono  font-display
```

`h1`–`h6` elements get the UI scale by default. In an app, headings separate by weight and space more than size.

### Prose / display type (fluid, density-independent)

```
text-display-1 … text-display-4    hero, page title, section, subsection
text-prose-1  text-prose-2  text-prose-3    lead, running prose, caption
max-w-measure                      reading line length
```

Mark a long-form region with `class="prose"` or `data-prose`. Its `p`, lists, headings, `blockquote`, `code`, `pre`, `hr`, links and figures take the prose scale. **Controls inside it keep the UI scale**: the region sets no font size of its own, role-bearing lists and links with a class are skipped, and `.not-prose` / `data-not-prose` excludes a subtree. Utilities override region styles (`<p class="text-prose-1">` is a lead). Do not combine with a third-party `.prose` plugin.

### Spacing and sizing

```
p-r1 … p-r6   (every spacing utility: m-, gap-, space-, inset-, top-, w-, h-, size-…)
h-control  size-control    buttons, inputs, selects: max(density, hit floor)
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

`hit-area` is how a visually small control (checkbox, switch, icon button, a breadcrumb link) meets `--HIT-MIN` without growing: an invisible `::before`, centred, at least the floor on each axis and flush on an axis already past it. It makes the element `position: relative` and a stacking context, and keeps the box behind the element's own content, so a native input drawn inside still takes the press. Overlapping hit areas resolve by paint order, so a hit area that directly follows another does not grow toward it on the inline axis: in a row of small targets every visible box keeps its own presses and the earlier one's growth fills the gap. Small targets that are not DOM siblings, or that stack vertically, need `--HIT-MIN` between their centres. Controls sized `h-control` / `h-row` already meet the floor and need no `hit-area`.

An auto-fit grid reads a column floor: `grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--COLUMN-MD)), 1fr))`.

### Shape, depth, state

```
rounded-sm  rounded-md  rounded-lg  rounded-xl  rounded-full
shadow-sm  shadow-md  shadow-lg      floating layers only: tooltip, menu/popover/toast, dialog/sheet
opacity-disabled
focus-ring  focus-ring-inset         the package focus indicator, e.g. focus-visible:focus-ring
```

Every `:focus-visible` element already gets the ring from the base layer. If a component resets outlines (`outline-none`), it must restore them with `focus-visible:focus-ring`.

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
| Accent | `--C-ACCENT`, `--C-ACCENT-HOVER`, `--C-TEXT-ON-ACCENT`, `--C-TEXT-ACCENT`, `--C-SELECTION`, `--C-TEXT-ON-SELECTION`, `--LINK-DECORATION` |
| Focus | `--C-FOCUS`, `--FOCUS-WIDTH`, `--FOCUS-OFFSET` |
| Status | `--C-STATUS-{S}`, `--C-TEXT-{S}`, `--C-STATUS-{S}-BG`, `--C-TEXT-ON-{S}` for S = ERROR, SUCCESS, WARNING, INFO |
| Faces, weights | `--FONT-UI`, `--FONT-MONO`, `--FONT-DISPLAY` (optional, undeclared), `--WEIGHT-NORMAL/MEDIUM/SEMIBOLD`, `--HEADING-WEIGHT`, `--HEADING-TRACKING`, `--HEADING-CASE`, `--DISPLAY-WEIGHT` |
| UI scale (density) | `--R-SIZE-1..6`, `--H1..H6` + `--Hn-line-height`, `--BodyText-1..3` + `-line-height`, `--ICON` |
| Axis-derived | `--HIT-MIN`, `--CONTROL-H`, `--ROW-H` (both registered `<length>`: getComputedStyle returns px) |
| Per-density named values | `<selected name>-COMFORTABLE` / `-COMPACT` for every density token, e.g. `--R-SIZE-3-COMPACT`, `--H1-line-height-COMFORTABLE`, `--CONTROL-H-COMPACT` |
| Prose / display | `--DISPLAY-1..4` + `-line-height` + `-tracking`, `--ProseText-1..3` + `-line-height`, `--PROSE-FLOW`, `--MEASURE`, `--SECTION-1..3`, `--GUTTER` |
| Layout widths | `--PAGE-MAX`, `--COLUMN-SM/MD/LG` (fixed, density-independent) |
| Shape, depth | `--RADIUS-SM/MD/LG/XL/FULL`, `--SHADOW-SM/MD/LG`, `--OPACITY-DISABLED` |
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
| `src/tokens/` | The contract: `reset` (clears replaced Tailwind scales), `color`, `type`, `density`, `input`, `shape`, `motion` |
| `src/base.css` | Body text, canvas, hairline default, selection, focus ring, heading defaults |
| `src/prose.css` | Prose regions |
| `src/animations/` | Keyframes, classes and `animate-*` utilities |
| `src/_theme-template.css` | Every themeable token, grouped by brand lever, one-line role each |
| `src/examples/themes/` | Worked examples. Nothing imports them; safe to delete |
| `scripts/` | `check` (contrast, theme rules, compile) and their tests |
| `specimen/` | Visual specimen (not published) |

## Don'ts

- No `tailwind.config.js`.
- No `light-dark()`: a theme is light or dark. Use `--SCHEME-DARK` to tune an extension for dark.
- No theme selector other than `:root[data-theme="…"]`; no subtree themes.
- No setting a selected density name (`--R-SIZE-3`, `--H1`, `--ICON`) or `--CONTROL-H` / `--ROW-H` / `--HIT-MIN` in a theme. Set the `-COMFORTABLE` / `-COMPACT` names.
- No `@media (width …)` that redefines a token.
- No font size on `:root` (it moves `rem`).
- No example theme name in a selector, type, default, config list, fixture or doc outside its own file. `bun run check` fails on it.
- No fill token as ink on a surface; no surface step as the only boundary.
- No domain tokens here (charts, series, tables, KPIs). They belong to the library that owns the domain, which can extend this contract with its own `@theme inline` block.
