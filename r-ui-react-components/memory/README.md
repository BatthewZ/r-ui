# memory — what this package has learned

Short, dated entries an agent should know before changing things here. Each entry: what
happened, what it means, where it is enforced. Newest first. Lessons inherited from the
previous generation (`~/coding/@batthewz/response-ui-react-components/memory/traps.md`)
are summarised where they still apply; read the original for the full story.

## Inherited (still true)

1. **A stylesheet imported from JS escapes `@layer components`** and beats `className`.
   Only `src/styles.css` decides layering. Enforced: `verify:no-css-imports`.
2. **An alias declared on `:root` is substituted once and inherits as a fixed value**, so a
   subtree cannot move it. Blend/derive at the read (`@theme inline` values, use-site
   fallbacks), or re-declare at every boundary that must re-derive (`[data-density]`).
3. **Popover `auto` closes a nested panel on the click that opened it.** Floating panels use
   `popover="manual"`; dismissal belongs to `useDismiss`.
4. **The UA `[popover]` box leaks** (`overflow: auto`, `color: CanvasText`, `inset: 0`).
   `src/floating.css` takes it back off.
5. **A gate that measured nothing must fail.** Every gate here fails on zero inputs
   (zero pairs, zero themes, zero `@theme` names).
6. **jsdom has no layout, no CSS, and (today) no popover API.** Size, colour and paint are
   Playwright questions against the showcase.

## Group lessons

One file per component group, written as each group was built, plus one for the showcase
pages. Read the group's file before changing its components.

| File | Covers |
|---|---|
| [primitives-lessons.md](./primitives-lessons.md) | Looping animations under reduced motion, fills without an on-ink, hover by ink-at-alpha, the hit-area inset maths, boxed vs chrome-less controls, accessible names with new-tab hints, card headers that wrap by content (not a grid) |
| [form-lessons.md](./form-lessons.md) | Read-only native checks, hit areas behind the control and stacked rows, scoping "is this interactive?", component rules vs utilities, labelling groups, native select quirks, horizontal-field alignment |
| [overlays-lessons.md](./overlays-lessons.md) | In place + top layer and density, Escape ownership, Tab out of menus, the popover API in jsdom, CSS scroll lock, shared statics, clipped focus rings, hiding anchored panels, toasts under a modal |
| [data-lessons.md](./data-lessons.md) | Auto vs fixed table layout, dropped columns, virtualizing on `--ROW-H` and re-measuring through a probe, clamping the window, unbroken words in every text slot, wrapping cells, on-ink for domain fills |
| [navigation-lessons.md](./navigation-lessons.md) | The AppShell as the one viewport reader, rail as the base mode, clipped rail labels, sticky bottom nav, badge spacing in names, focus after disabling, global class names |
| [layout-lessons.md](./layout-lessons.md) | Page width and column floors as contract tokens, Grid's container wrapper, content-box caps, UI inside prose |
| [pages-lessons.md](./pages-lessons.md) | The showcase pages as consumers: an AppShell given the window, one `<main>`, edge-to-edge bands inside a padded shell, the known-bug box and its regression loop, workarounds that name a missing API |

## 2026-10-15 — integration gate 3 (after the parallel page build)

- **Pages are the real consumers, and their workarounds are findings.** Three page agents found
  a card header that starves its title, text slots that never break a word, a KPI value that
  spills, a row height that missed stylesheet changes, a nested `<main>`, a Sparkline and a
  table cell with no API for what the page needed, and a gate false positive. Each was fixed at
  the source with a test that goes red without it, and the page's workaround was removed. See
  [pages-lessons.md](./pages-lessons.md).
- **Watch the value, not a list of causes.** `useRowHeight` observed attributes and a media
  query, and missed a stylesheet edit; a probe sized by the token itself sees every cause.

## 2026-10-15 — integration gate 2 (after the parallel group build)

- **Parallel groups duplicate whatever is shared but unowned.** Three hit-area rules, two tone
  vocabularies (glyph + mark per tone), two loading-bar styles (one missing the reduced-motion
  stop), five hover washes and two segmented-control focus rings. The single sources now:
  the contract's `hit-area`, `util/tone`, `Skeleton`, the 8% primary-ink wash. Before writing
  a helper, look one group over.
- **A demo is a consumer and should look like one.** Overlay demos hand-rolled `<input>`s with a
  hairline border beside the form group's 3:1 field border; a data demo used the showcase
  shell's own segmented control. Demos import the real components.
- **A gate's false positive gets fixed in the gate.** Two groups bent their code around
  `verify:utilities-exist` following comparisons to a parameter default. The extractor now
  skips anything that can only be a boolean, with a fixture that goes red if it regresses.
- **Shared hooks are fixed at the source.** DataTable clamped `useVirtualRows`' window locally;
  the clamp is in the hook now and the workaround is gone.
- **One broken demo must not blank the page.** Each Overview section renders behind its own
  error boundary, and `browser:check` fails on a tripped one, on any console error and on any
  horizontal overflow, page or demo, across every axis.

## 2026-10-15 — integration gate

- **A replaced Tailwind default is not an error, it is nothing.** The CSS package clears
  Tailwind's colour, text-size, radius, shadow, weight, leading, tracking and easing scales,
  so `font-bold` or `rounded` compile to no rule and the element silently loses the style.
  Review and `verify:no-raw-tailwind` (a deny-list) cannot see that; only asking Tailwind's
  own design system can. Enforced: `verify:utilities-exist`. A class built as `bg-${x}` is
  invisible to the scanner for the same reason and is reported too.
- A plain marker class with no rule anywhere (a leftover `sc-view`) is also dead weight;
  the same gate catches it where it is written directly in `className`.

## 2026-10-15 — scaffold

- Floating model changed from the previous generation: panels are never portalled (not
  even into a `<dialog>`); they render in place and are always promoted to the top layer,
  so they inherit density from where they are written. `FloatingPortal` is not re-exported.
- Tailwind emits each domain colour utility twice: a fallback without `color-mix()` (the
  LIGHT half) and the real blend inside `@supports (color: color-mix(in lab, red, red))`.
  Grepping the built CSS for `bg-series-1{` finds the fallback first; the blend is there.
  Browsers without `color-mix()` (pre-2023) get light series steps in a dark theme.
- The series palette is the dataviz method's validated reference palette (worst adjacent
  ΔE: normal 19.6 light / 19.3 dark; CVD 9.1 / 8.4). Re-step within a hue; never re-order.
- `@batthewz/r-ui-css`'s `exports` does not expose `package.json`; the gates find it at
  `node_modules/@batthewz/r-ui-css` (workspace link), see `scripts/lib/themes.mjs`.
