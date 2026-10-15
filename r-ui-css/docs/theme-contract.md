# Theme contract

A theme is one CSS rule, `:root[data-theme="<name>"] { … }`, that overrides tokens. The default theme is `:root` itself; every other theme, including the worked examples under `src/examples/themes/`, is the same kind of object as yours and gets no privilege yours does not.

Start from [`src/_theme-template.css`](../src/_theme-template.css): it lists every themeable token, grouped by brand lever, with a one-line role for each. Delete what you do not change; omitted tokens inherit the default.

```css
/* app.css */
@import "@batthewz/r-ui-css";
@import "./themes/aurora.css";
```

```html
<html data-theme="aurora">
```

## Rules

1. **Root only.** The selector is exactly `:root[data-theme="<name>"]`. Subtree themes are unsupported: tokens declared at the root resolve there, so a theme scoped to a card would leave derived and aliased values behind.
2. **One scheme.** Set `color-scheme: light | dark` AND `--SCHEME-DARK: 0 | 1` to match. No `light-dark()`; dark is its own theme.
3. **Density is a lever, selection is not.** Override the per-density named values (`--R-SIZE-3-COMPACT`). Never set a selected name (`--R-SIZE-3`, `--H2`, `--BodyText-1`, `--ICON`) or an axis-derived token (`--CONTROL-H`, `--ROW-H`, `--HIT-MIN`).
4. **No `@media`.** The viewport never redefines a token; reduced motion, coarse pointers, `prefers-contrast` and forced colors are applied by the package for every theme, and they win over a theme's values.
5. **Name fonts, never load them.** A theme sets `--FONT-*` stacks; the app loads the faces (see [Fonts](#fonts-name-them-in-the-theme-load-them-in-the-app)). No `@import` or `@font-face` in a theme file.
6. **Structure is not a lever.** No `--LAYER-*` (stacking order).
7. **Pass the contrast contract** below.

The package checks its own themes against every rule (`bun run check`). The check scripts ship with the package, have no dependencies, and take extra theme files, so run them on yours (the file name must match the theme name):

```sh
node node_modules/@batthewz/r-ui-css/scripts/check-contrast.mjs ./themes/aurora.css
node node_modules/@batthewz/r-ui-css/scripts/check-theme-rules.mjs ./themes/aurora.css
```

## Brand levers

Brand is expressed through these levers. Layout and component structure are not levers.

| Lever | Tokens |
| --- | --- |
| Neutrals | `--C-CANVAS`, `--C-SURFACE-0..3`, `--C-TEXT-PRIMARY/SECONDARY/MUTED/INVERSE`, `--C-BORDER`, `--C-BORDER-STRONG`, `--C-SCRIM` |
| Primary action fill (ink or a hue) | `--C-PRIMARY`, `-HOVER`, `-ACTIVE`, `--C-TEXT-ON-PRIMARY` |
| Accent, selection, links | `--C-ACCENT`, `--C-ACCENT-HOVER`, `--C-TEXT-ON-ACCENT`, `--C-TEXT-ACCENT`, `--C-SELECTION`, `--C-TEXT-ON-SELECTION`, `--LINK-DECORATION` |
| Focus ring | `--C-FOCUS`, `--FOCUS-WIDTH`, `--FOCUS-OFFSET` (visibility is protected; the look is yours) |
| Typography | `--FONT-UI`, `--FONT-HEADING`, `--FONT-DISPLAY`, `--FONT-MONO`, `--FONT-*-SIZE-ADJUST`, `--WEIGHT-*`, `--HEADING-WEIGHT/TRACKING/CASE`, `--DISPLAY-WEIGHT`, `--DISPLAY-n-tracking`, `--NUMERALS-DATA/PROSE`, the prose/display sizes |
| Shape | `--RADIUS-SM/MD/LG/XL/FULL` |
| Depth | `--SHADOW-SM/MD/LG` (shadow-led) or quieter shadows, a stronger `--C-BORDER` and a 2px `--BORDER-WIDTH` (border-led), `--OPACITY-DISABLED` |
| Motion personality | `--DURATION-*`, `--EASE-*`, `--MOTION-*` |
| What each density means | every `*-COMFORTABLE` / `*-COMPACT` value |

Status colours are function, not brand: re-tune them for your palette, never re-mean them.

## The surface ramp

Surfaces run raised to recessed, **0 lightest and 3 darkest in every theme, dark ones too** (raised regions catch the light). The canvas sits between rungs 1 and 2:

```
SURFACE-0  ┐ raised: cards, dialogs, menus, input fills
SURFACE-1  ┘ panels inside a sheet, table headers
· · · CANVAS · · ·  the page floor
SURFACE-2  ┐ wells, chips, hover washes
SURFACE-3  ┘ tracks, disabled fills
```

Do not reorder the rungs and do not let the canvas equal one. Adjacent rungs are a weak cue by design; nothing may rely on a single step as its only edge. Do not pin the canvas to pure white or black: the recessed rungs need room.

## Contrast contract

`bun run check` measures these pairs in OKLCH -> sRGB -> WCAG 2.x, pessimistically across both gamut-mapping strategies, for the default theme and every example. A green table across the examples proves nothing about your theme: the rule is what you must meet.

| Pair | Minimum |
| --- | --- |
| `--C-TEXT-PRIMARY/SECONDARY/MUTED/ACCENT` and `--C-TEXT-{ERROR,SUCCESS,WARNING,INFO}` on the canvas and every surface 0–3 | 4.5 |
| `--C-STATUS-{S}` marks, `--C-ACCENT`, `--C-FOCUS`, `--C-BORDER-STRONG` on the canvas and every surface | 3 |
| `--C-TEXT-ON-PRIMARY` on `--C-PRIMARY`, `-HOVER`, `-ACTIVE` | 4.5 |
| `--C-TEXT-ON-ACCENT` on `--C-ACCENT`, `--C-ACCENT-HOVER` | 4.5 |
| `--C-TEXT-ON-SELECTION` and `--C-TEXT-SECONDARY` on `--C-SELECTION` | 4.5 |
| `--C-TEXT-INVERSE` on `--C-TEXT-PRIMARY` | 4.5 |
| `--C-TEXT-ON-{S}` on `--C-STATUS-{S}` | 4.5 |
| `--C-TEXT-{S}` and `--C-TEXT-PRIMARY` on `--C-STATUS-{S}-BG` | 4.5 |
| `--C-STATUS-{S}` on `--C-STATUS-{S}-BG` | 3 |

Consequences worth knowing before you pick colours:

- **A fill is only guaranteed against its own `on-*` text, never against a surface.** Ink on a surface (text, a 1–2px line, an icon) uses a text token. A filled chip that might blend into its surface is outlined in its `on-*` token.
- **The accent is a mark and a fill at once.** It must reach 3:1 on surfaces and carry 4.5:1 text. On a light theme that forces a fairly deep accent with light text; a vivid mid-tone cannot do both. Accent-coloured *text* has its own token, `--C-TEXT-ACCENT`, so links can be darker than the fill.
- **Warning marks cannot be pale yellow**: 3:1 on a light surface means amber-to-orange. On a dark theme its `on-*` text inverts to dark ink.
- **Move lightness, keep chroma and hue** when a pair fails, so the brand still reads as itself. Keep declared colours inside sRGB; out-of-gamut values render differently per engine.

## Density in a theme

Each density-dependent token has two named values on `:root`, which a theme may override:

```css
:root[data-theme="aurora"] {
  --R-SIZE-1-COMFORTABLE: 2rem; /* this brand's comfortable is roomier */
  --CONTROL-H-COMFORTABLE: 2.5rem;
  --ROW-H-COMFORTABLE: 2.75rem;
}
```

`[data-density]` selects between them (`--R-SIZE-1: var(--R-SIZE-1-COMFORTABLE)`), and `--CONTROL-H` / `--ROW-H` re-derive as `max(named value, --HIT-MIN)` at every density boundary. Because the theme sits on the same element as the root selection, your value is picked up at the root and inherited by every compact or comfortable subtree. Setting `--R-SIZE-1` directly would freeze it at one density everywhere, which is why the check forbids it.

The density set itself is closed: `comfortable` (default) and `compact`.

## `--SCHEME-DARK`: tuning an extension for dark without `light-dark()`

Every theme sets `--SCHEME-DARK` to 0 or 1. A library that adds its own tokens (anything domain-specific that this contract does not hold) declares a `-LIGHT` / `-DARK` pair and blends at the read:

```css
:root {
  --C-GRIDLINE-LIGHT: oklch(0.9 0.005 85);
  --C-GRIDLINE-DARK: oklch(0.32 0.005 85);
}

.gridline {
  stroke: color-mix(in oklch, var(--C-GRIDLINE-LIGHT), var(--C-GRIDLINE-DARK) calc(var(--SCHEME-DARK) * 100%));
}
```

No theme has to name the extension's tokens, and a theme that wants a different value can still override `--C-GRIDLINE-DARK` by name. Under `forced-colors: active` the package sets `--SCHEME-DARK` from the forced palette (`prefers-color-scheme`), not the theme, so an extension colour that keeps its value there (it opts out of repainting) takes the half that suits the forced Canvas. Blend at the read (a rule, or an `@theme inline` mapping) rather than in a `:root` declaration when the result must follow anything that changes below the root; for a value driven only by the theme, a `:root` declaration is equivalent because themes apply at the root.

The same switch works for non-colour values: `calc(var(--SCHEME-DARK) * 0.2 + 0.4)` gives 0.4 in light themes and 0.6 in dark ones.

## Faces: a chain of roles

| Role | Token | Read by | Unset means |
| --- | --- | --- | --- |
| UI | `--FONT-UI` | body text, controls, data, `font-ui` | (always set; the default is the system stack) |
| Heading | `--FONT-HEADING` | `h1`–`h6`, `text-h1`…`text-h6`, `font-heading` | the UI face |
| Display | `--FONT-DISPLAY` | `text-display-1`…`4`, headings in a prose region, `font-display` | the heading face |

So one face for everything is one line (`--FONT-UI`); a serif for every heading is two (`--FONT-UI`, `--FONT-HEADING`); a display face only for marketing headings sets `--FONT-DISPLAY` alone. Weight, tracking and case follow the role: `--HEADING-WEIGHT` / `--HEADING-TRACKING` for in-app headings, `--DISPLAY-WEIGHT` / `--DISPLAY-n-tracking` for display, `--HEADING-CASE` for both.

**Known limit: the line-height modifier drops the role.** `text-h1` carries the heading face, weight, tracking and case; `text-h1/(--X)` (or any `text-h*/…`, `text-display-*/…`) is a different utility to Tailwind and sets only the size and that line height. Add the role back beside it (`text-h1/(--X) font-heading`), or set the line height with `leading-(--X)` next to a plain `text-h1`, which keeps everything.

`--FONT-HEADING` and `--FONT-DISPLAY` are not declared by the package: readers write `var(--FONT-DISPLAY, var(--FONT-HEADING, var(--FONT-UI)))` where the face is painted, so the fallback resolves there. `getComputedStyle` reports them empty until a theme sets them. The same holds for the optional `--FONT-UI-SIZE-ADJUST`, `--FONT-HEADING-SIZE-ADJUST` and `--FONT-DISPLAY-SIZE-ADJUST` (a `font-size-adjust` value per face, e.g. `0.52`; unset is `none`, and each falls back to the role before it). Use them when a fallback face and the web face differ in x-height enough to jolt on load.

Figures have two roles as well: `--NUMERALS-DATA` (default `tabular-nums`) for UI text and tables, `--NUMERALS-PROSE` (default `proportional-nums`) for prose regions and display headings. Each takes any `font-variant-numeric` value your faces support, such as `tabular-nums slashed-zero`.

## Fonts: name them in the theme, load them in the app

A theme only names families. Loading a face costs a download, and a theme is a set of values that must cost nothing to import, switch or delete; it also cannot load one reliably, because an `@import` that is not at the top of the stylesheet is dropped. So the theme names the face with fallbacks of the same kind, and the app that uses the theme loads it.

The light editorial example in `src/examples/themes/` is the worked case: Fraunces (a variable serif) for headings, Inter for everything else.

```css
/* themes/editorial.css: names only */
:root[data-theme="editorial"] {
  color-scheme: light;
  --SCHEME-DARK: 0;
  --FONT-UI: "Inter Variable", "Inter", system-ui, sans-serif;
  --FONT-HEADING: "Fraunces Variable", "Fraunces", Georgia, serif; /* display follows */
}
```

```css
/* app.css: the app loads the faces, at the very top */
@import "@fontsource-variable/inter";
@import "@fontsource-variable/fraunces/opsz.css"; /* with the optical-size axis */
@import "@batthewz/r-ui-css";
@import "./themes/editorial.css";
```

Self-hosted `@font-face` rules or a font service's stylesheet work the same way. Notes:

- **The family name must match** what the loader registers (`@fontsource-variable/inter` registers `"Inter Variable"`). Keep the plain name after it for a system-installed copy.
- **Fallbacks of the same kind**: a serif stack for a serif face, so the page reads correctly before the face arrives or if the app never loads it.
- **Bundlers rewrite the face URLs** when they process the `@import` (Vite does). A plain CSS compile that inlines imports without rewriting URLs, such as the Tailwind CLI, leaves `url(./files/…)` relative to the wrong file; copy the font files next to the output or let a bundler do it.
- **Variable faces take the weight tokens as they are** (`--HEADING-WEIGHT: 560` is fine). With a static face, use weights you actually load.
- **Pick `--BORDER-WIDTH` in whole pixels.** Browsers floor a fractional border width, so 1.5px draws as 1px.

## Forced colors

Under `forced-colors: active` (Windows High Contrast) the package maps every `--C-*` role to a system colour, for every theme, ahead of the theme's values. A theme needs no forced-colors rules of its own and may not add any (rule 4). A library that adds its own colour tokens maps them too, inside its own `@media (forced-colors: active)` block.
