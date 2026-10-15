# The four axes, and the role split

Every size and colour a component reads is decided by four independent axes. **The viewport is not one of them.** A media query on width may move layout (grid areas, a sidebar becoming a rail or a bottom bar), but it never redefines a token; `bun run check` fails if one does.

| Axis | Set by | Drives |
| --- | --- | --- |
| Theme | `<html data-theme="name">` (root only) | Colour, faces, weights, radius, shadows, motion, what each density means |
| Density | `data-density="comfortable" \| "compact"` on **any** element | `--R-SIZE-*`, `--H*`, `--BodyText-*`, `--ICON`, the density side of `--CONTROL-H` / `--ROW-H` |
| Input | `@media (pointer: coarse)`, or `html[data-input="fine" \| "coarse"]` | `--HIT-MIN`, and through it `--CONTROL-H` / `--ROW-H` |
| Container | the component's own width | `@container` rules and `cqi` units, including the fluid prose scale |

## 1. Theme

One file, one scheme, applied at the root. See [theme-contract.md](theme-contract.md).

## 2. Density

A closed set, and a public contract: `comfortable` (the default on `:root`) and `compact`.

```html
<main>                                 <!-- comfortable: the page -->
  <section data-density="compact">     <!-- this card is compact -->
    <div data-density="comfortable">   <!-- and can switch back -->
```

How it works, because it is the part most often broken:

1. Every density-dependent token has **named values** on `:root`: `--R-SIZE-3-COMFORTABLE: 0.75rem`, `--R-SIZE-3-COMPACT: 0.5rem`. Themes may override these.
2. `[data-density]` **only selects**: `[data-density="compact"] { --R-SIZE-3: var(--R-SIZE-3-COMPACT) }`.
3. **Derived tokens are re-declared at every density boundary.** A custom property resolves its `var()`s on the element that declares it and inherits the result. If `--ROW-H: max(var(--ROW-H-COMPACT…))` lived on `:root` alone, a compact card would inherit the root's already-resolved comfortable value. Declaring it in each selection block re-derives it at the boundary.

A density boundary also resets its own body text to `--BodyText-1`, so a compact card gets compact text without a utility. Never set a font size on `:root`: it would move `rem`.

The UI scale is **flat across viewports**: a wider screen gets more columns, not bigger text.

## 3. Input

```css
:root { --HIT-MIN: 1.5rem; }                                         /* fine: WCAG 2.5.8 minimum */
@media (pointer: coarse) { :root:not([data-input="fine"]) { --HIT-MIN: 2.75rem; } }  /* 44px */
:root[data-input="coarse"] { --HIT-MIN: 2.75rem; }
```

`pointer` (the primary pointer), not `any-pointer`: a laptop with a touch screen keeps fine targets.

```
--CONTROL-H = max(density's control height, --HIT-MIN)
--ROW-H     = max(density's row height,     --HIT-MIN)
```

So compact + touch shrinks the text but keeps 44px rows. Both are registered with `@property … syntax: "<length>"`, so `getComputedStyle(el).getPropertyValue("--ROW-H")` returns px: useful for virtualised lists that need a row height in script.

Visually small controls (checkbox, switch, icon button) meet the floor with the `hit-area` utility, an invisible pseudo-element sized by `--HIT-MIN`, not by growing. In a row of sibling small targets the later hit area does not grow back over its neighbour; small targets that are not siblings, or that stack vertically, need `--HIT-MIN` between their centres.

## 4. Container

Components adapt to their own width with `@container` queries and `cqi` units, so the same card works in a sidebar and in a main column. A `cqi`-based value must stay an unregistered custom property: registering it would resolve `cqi` once, where declared, instead of where used.

## The role split: UI scale vs prose/display scale

Two type and spacing scales, chosen by **role**, never by viewport.

| | UI scale | Prose / display scale |
| --- | --- | --- |
| For | Everything in an app; every control anywhere | Long-form text and marketing layout |
| Tokens | `--R-SIZE-1..6`, `--H1..H6`, `--BodyText-1..3`, `--CONTROL-H`, `--ROW-H`, `--ICON` | `--DISPLAY-1..4`, `--ProseText-1..3`, `--SECTION-1..3`, `--GUTTER`, `--MEASURE`, `--PROSE-FLOW` |
| Utilities | `p-r3`, `text-h2`, `text-body-1`, `h-control`, `h-row`, `size-icon` | `text-display-1`, `text-prose-2`, `py-section-1`, `px-gutter`, `max-w-measure` |
| Driven by | Density (and input, for heights) | Container width: one continuous `clamp()` from 360 to 1280px, in `cqi` |
| Leading | Tight, fixed per size | Reading leading, unitless so it tracks the size |
| Figures | Tabular (the body default) | Proportional |

### Marking a prose region

```html
<article class="prose max-w-measure">           <!-- or data-prose -->
  <h1>Display heading</h1>
  <p class="text-prose-1">A lead paragraph.</p>
  <p>Running prose, with <a href="/docs">a link</a> and <code>code</code>.</p>
  <button class="h-control px-r3 …">Still a UI button</button>
  <div class="not-prose">…a UI island: nothing in here is prose-styled…</div>
</article>
```

Inside a prose region, `p`, lists, headings, `blockquote`, `figcaption`, `code`, `pre`, `hr`, media and class-less links take the prose scale. The region sets no font size on itself, so a button, menu, table or form inside it keeps the UI scale, its control height and UI leading. Lists with a `role` and links with a `class` are skipped. Utilities always win over region styles.

### Marketing layout

```html
<section class="px-gutter py-section-1">
  <h1 class="font-display text-display-1">Hero</h1>
  <p class="mt-section-3 max-w-measure text-prose-1 text-fg-secondary">Lead copy.</p>
  <button class="mt-r1 h-control …">Get started</button>   <!-- UI tokens, always -->
</section>
```

Put `@container` (Tailwind's `@container` class) on a column to make its display type size to the column rather than the viewport.
