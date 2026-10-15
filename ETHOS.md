# Ethos

The intention and defining decisions behind the r-ui family:

- **[r-ui-css](r-ui-css/)** (`@batthewz/r-ui-css`): the token contract and themes, as Tailwind v4 CSS. Zero JavaScript.
- **[r-ui-tw-merge](r-ui-tw-merge/)** (`@batthewz/r-ui-tw-merge`): `cn()` and a tailwind-merge configured for the r-ui-css utilities. Zero CSS.
- **[r-ui-react-components](r-ui-react-components/)** (`@batthewz/r-ui-react-components`): React 19 components on top of both, plus the showcase app.

r-ui replaces the response-ui family. It keeps that family's contract-first discipline and reverses one of its defining decisions: tokens no longer change at viewport breakpoints.

---

## Layered, cherry-pickable

The split follows cost and audience. r-ui-css serves anyone who wants the design language (Astro, Rails, plain HTML) and costs no JS. r-ui-tw-merge serves Tailwind users who need `cn("p-r3 p-r5")` to dedupe correctly. r-ui-react-components is one consumer of the two, not the reason they exist. The foundation packages release independently; a project takes exactly the layers it wants.

## Tokens are the only vocabulary

No raw hex, `rem`, `px`, or Tailwind defaults (`p-4`, `text-sm`, `bg-blue-500`, `rounded`) in components. Everything is a token: `p-r3`, `text-h2`, surface and text roles. If no token fits, that is a question about the contract, not permission to improvise. The system gives up flexibility on purpose to get consistency.

Tokens come in three tiers: primitives (theme-private raw values) → semantic roles (the contract) → domain extensions (owned by the library that needs them). Components read semantic and domain tokens, never primitives. r-ui-css declares no primitive tokens: a theme writes its raw values straight into the role tokens, so the primitive tier exists only inside a theme file.

## What belongs in the universal contract

A token belongs in r-ui-css only if **all** of these hold:

1. **Standalone-meaningful**: useful to someone with no component library.
2. **Cross-cutting**: read by many contexts, not one component's config.
3. **Domain-neutral**: part of the universal language (colour, surfaces, text, borders, status, radius, shadow, motion, type, spacing), **and its name encodes no component or domain**.

Otherwise it is a **domain extension** and lives with the library that owns the domain. Chart, series, trend, KPI and stale tokens live in r-ui-react-components. Nothing is lost by this: custom properties cascade by name, so a theme can still override an extension token, and the owning library registers its own utilities with tailwind-merge.

## Knowledge runs one way

Dependencies run `r-ui-css + r-ui-tw-merge → r-ui-react-components`. Knowledge follows the same direction. r-ui-css is a standalone package that happens to be built on, not the base of a family: its docs never name a downstream package. r-ui-tw-merge mirrors r-ui-css and may name it, but never names anything downstream. A cross-reference from upstream to downstream always looks helpful locally, and it always leaks the family into a package meant to stand alone.

## Reskin without code; the consumer's theme is first-class

A theme is one CSS file of custom-property overrides, applied with `<html data-theme="…">`. Changing it needs no rebuild and no component edit. The brand is a theme, so the final brand, still undecided, will be a theme-file change.

**The contract is the product; the themes are not.** The default theme *is* `:root`. The example themes (`nightfall`, dark; `harbour`, light and deliberately different in personality) prove that the contract can carry a brand. Nothing depends on them, they sit outside semver, and deleting them breaks nothing. Once a shipped theme gets a privilege that a consumer's theme cannot have (a selector keyed to its name, a slot in a type union, a runtime default, a fixture), the reskinning claim is false. A check enforces this.

### One theme file, one scheme

Each theme is light **or** dark and sets `color-scheme` to match. There is no `light-dark()`. Some implementers want only one look, and a light-only brand should not have to author or ship dark values. Dark is designed, not inverted: it is its own file, tuned on its own terms.

Every theme also sets **`--SCHEME-DARK`** (`0` or `1`). This is the domain-neutral bridge for extensions. A downstream library declares its domain colours as `-LIGHT`/`-DARK` pairs and blends them at the read:

```css
color-mix(in oklch, var(--X-LIGHT), var(--X-DARK) calc(var(--SCHEME-DARK) * 100%))
```

A theme therefore never has to name domain tokens, though it may override them by name.

Themes apply at the root only (`:root[data-theme="name"]`). Subtree themes are unsupported, and the docs say so.

## Four axes; the viewport only moves layout

| Axis | Set by | Drives |
| --- | --- | --- |
| **Theme** | `:root[data-theme]` | Every colour, font, radius, shadow and motion value |
| **Density** | `[data-density="comfortable"\|"compact"]` on **any** element | UI spacing, UI type, `--CONTROL-H`, `--ROW-H`, `--ICON` |
| **Input** | `@media (pointer: coarse)`, forced by `html[data-input]` | `--HIT-MIN` (1.5rem fine, 2.75rem coarse) |
| **Container** | The component's own width | `@container` rules and `cqi` sizes |

**The viewport is not an axis.** An `@media (width …)` query moves grid areas and picks the sidebar mode (full, rail, bottom nav). It never redefines a token.

The old family stepped its sizes at a 40rem viewport breakpoint. That puts a component's size on the wrong question. A table in a narrow sidebar on a wide screen is not a wide table. A touch laptop is not a phone. Compact is a choice the user or the context makes, not a property of the screen. Each fact gets its own axis:

- **Density** is a closed, documented set: `comfortable` (default) and `compact`. A subtree can be compact.
- **Input** sets the hit floor: `--CONTROL-H` and `--ROW-H` are `max(density value, --HIT-MIN)`.
- **Container** lets a component adapt to the space it actually has.

## UI scale and prose/display scale

Sizing is split by **role**, not by context:

- **UI scale** (driven by density, flat across viewports): spacing `--R-SIZE-1..6`, UI text `--BodyText-1..3` with tight leading, in-app headings `--H1..H6`, `--CONTROL-H`, `--ROW-H`, `--ICON`.
- **Prose/display scale** (fluid, density-independent, `clamp()` over `vw`/`cqi`, no single breakpoint step): display headings, long-form body with reading leading, and section-rhythm spacing for marketing layouts.

An "editorial density" was considered and rejected. A density cascades to everything beneath it, so a button, menu, table or form inside an article would pick up reading leading and display sizes. UI chrome stays UI wherever it sits. The element's role picks the scale, and the surrounding section does not.

## Correctness is enforced, not trusted

Contracts that must hold are scripts, wired into each package's `check` script (`bun run check` at the root runs them all).

**r-ui-css**
- Contrast, per theme: text on every surface ≥ 4.5:1; status marks and focus ring ≥ 3:1 on every surface; on-fill text on its fill ≥ 4.5:1.
- Theme rules: no theme sets a selected density name; every theme sets `color-scheme` and `--SCHEME-DARK`; theme selectors are only `:root[data-theme=…]`.
- No example-theme name outside that theme's own file.
- No viewport `@media` block declares a token.
- The package compiles, every `@theme` name yields its utility, and the Tailwind defaults it replaces generate nothing.

**r-ui-tw-merge**
- The mirror equals r-ui-css's `@theme` names.

**r-ui-react-components**
- No raw Tailwind spacing, size or text defaults and no raw colours in components. With no primitive tokens to read, this is also what keeps primitives out of components.
- Every class a component or showcase file writes generates CSS. The Tailwind scales r-ui-css replaces compile to nothing, silently, so `font-bold` is a failing check rather than an unstyled element.
- Every domain colour has its dark pair, and domain colours meet the contrast floors in every theme.

---

## Defining decisions

| Decision | What it means |
| --- | --- |
| **Tailwind v4, CSS-first, `@theme inline`** | No `tailwind.config.js`; nothing in JS can drift from the CSS. |
| **OKLCH** | Lightness, chroma and hue are separate levers, which makes contrast tuning tractable. |
| **One theme file = one scheme** | Light or dark, never both. No `light-dark()`. `--SCHEME-DARK` bridges domain extensions. |
| **Themes at the root only** | `:root[data-theme]`. No subtree themes. |
| **Four axes; viewport moves only layout** | Theme, density, input, container. No token changes under `@media (width …)`. |
| **Per-density named values** | `:root` declares `--R-SIZE-3-COMFORTABLE` / `--R-SIZE-3-COMPACT`; `[data-density]` only *selects* `--R-SIZE-3`. Themes tune what each density *means* and never select one. Derived tokens are re-declared at every density boundary so they re-derive there. |
| **Registered derived lengths** | `--CONTROL-H` and `--ROW-H` are `@property` `<length>`, `inherits: true`, so `getComputedStyle` returns px. A `cqi`-based token is never registered: registration would compute it once, at the element that declares it, and inherit the frozen length. |
| **UI vs prose/display role split** | The element's role picks the scale; UI inside prose stays UI. |
| **Separate colour roles** | Primary fill, accent, focus and selection are independent, so a theme can make primary ink and accent a hue, or the reverse. |
| **Status triples** | Each status has a mark (≥ 3:1), a text-safe colour (≥ 4.5:1) and a subtle background. Status always comes with an icon and a label. |
| **Domain colours downstream** | Series, sequential, trend, stale and chart chrome live in r-ui-react-components as `-LIGHT`/`-DARK` pairs. |
| **Motion collapses in the CSS package** | Motion tokens go to ~0 under `prefers-reduced-motion`, so components need no per-component handling. |
| **Descending numbering** | `1` is always the largest or most significant step, on every scale. |
| **ESM only, React 19** | No CJS builds. |

---

## Lessons carried from the old family

- **Resolve aliases at the read when a subtree must be able to move them.** A `var()` inside a custom-property declaration resolves once, at the declaring element, and descendants inherit the result rather than the indirection. Write `var(--TOKEN, var(--SOURCE))` where the value is painted. Density is the axis that moves per subtree here, which is also why derived tokens are re-declared at each density boundary.
- **Floating panels render in place and use the top layer, not portals.** A panel portalled to `<body>` leaves its subtree, so it loses that subtree's density and custom properties. It also stops working inside a modal `<dialog>`, where everything outside is inert. `popover` and `<dialog>` give stacking without leaving the tree.
- **Hit area comes from a pseudo-element.** Small-looking controls (checkbox, switch, icon button) meet `--HIT-MIN` with an invisible `::before`/`::after`, not by growing visually.
- **The tw-merge mirror is tested against the CSS.** It was the old family's known fragility: a hand-kept list with nothing to catch drift. The decoupling stays, because pure-CSS consumers pay no JS, and drift is now a failing check.
- **Example themes drift into API unless a check stops them.** It happened before (ramps keyed to a theme name, union slots, defaults). The fix is almost never an allowance.
- **A default that utilities should beat goes in `@layer base`.** An unlayered rule outranks every utility regardless of specificity.
- **jsdom cannot represent the failures that matter most here:** the top layer, `inert`, layout, pointer geometry and stylesheet contents. CSS invariants live in check scripts, and rendering claims are settled in a real browser.
- **Tailwind `@source` paths are self-relative.** A sideways path into a sibling folder assumes a hoisted `node_modules` and matches nothing under isolated stores.

---

## Design principles

The default look is a **placeholder**: modern, classy, clarity first, less is more, with a few tasteful details. The real brand comes later, as a theme. These principles exist so that (1) the placeholder is good and (2) the contract can carry any future brand without touching components. The placeholder must look clearly different from the old family (no Poppins, no saturated blue accent).

### A. Visual design

1. **Content is the hero; chrome recedes.** Every border, fill, icon and shadow earns its place; when in doubt, remove it. Build structure from space and alignment first, hairlines second, fills third, shadows last. Marketing and hero moments are the exception: there the display scale, a generous section rhythm and one confident visual carry the page. Still restrained, never busy.
2. **Hierarchy uses few levers, one or two at a time:** size, weight, text contrast (primary / secondary / muted), space. Never colour alone.
3. **Colour is mostly neutral and always means something** (≈90% neutrals is a heuristic). Primary fill means the main action. Accent means links, selection markers and "you are here". Focus means keyboard focus. Status means state, always paired with an icon and a label. Series colours are for data marks only.
4. **One rhythm.** Spacing comes from the scales. Proximity groups related things, edges align, and equal things get equal treatment.
5. **Typography is quiet and functional.** One UI family plus mono (a display face is an optional brand lever), and two or three weights. UI text uses tight leading, prose uses reading leading. Figures are tabular in data and proportional in prose. In-app headings separate by weight and space more than by size jumps. Display headings use the fluid scale and may be large.
6. **Depth is rationed.** The surface ramp shows nesting, hairline borders show structure, and shadows appear only on floating layers (menus, dialogs, toasts).
7. **Every state is designed:** rest, hover, active, focus-visible (always, ≥ 3:1), selected, disabled, loading, empty, error, stale.
8. **Accessibility is design:** WCAG AA (4.5:1 text; 3:1 non-text marks, including status marks and focus), a hit floor (24px fine pointer, per WCAG 2.5.8; 44px coarse), `prefers-reduced-motion`, `prefers-contrast`, `forced-colors`, logical properties (RTL), keyboard paths, and names for icon-only controls.
9. **Motion explains cause and effect.** About 120–200ms, small distances, eased.
10. **Design with real content:** long names, huge, tiny and negative numbers, missing values ("—"), empty lists, translations ~30% longer. Truncate with a way to see the full value. Numbers are locale-formatted (`Intl`), with units, and compact forms (1.2k) are an explicit choice.
11. **UI inside prose stays UI.** It uses the UI scale (control height, UI leading), never prose leading or the display scale.

### B. Design-system principles

1. **Three token tiers:** primitives → semantic roles → domain extensions. Components read the last two only.
2. **Name by role, never by appearance:** `--C-ACCENT`, not `--blue-600`.
3. **Constraints are the product:** closed scales, few variants, few props.
4. **Encode decisions, not just values.** Things that must move together are paired (fill + on-fill text, surface order, per-density named values), and checks enforce the pairing.
5. **Composition over configuration:** compound parts, consistent prop names (`size`, `variant`, `tone`), forwarded refs, `className`/`classNames` slots.
6. **Single source of truth; one-way knowledge.** Breaking the contract is a versioned, changelogged event.
7. **Document the why next to the what.** Each token gets a one-line role. Each component documents its states and its a11y contract.

### C. Brand and theming

1. **Brand levers are the theme author's mental model; the semantic tier is the contract.** The theme template is organised by lever:
   - neutrals: temperature and chroma of canvas, surfaces, text, borders;
   - primary action fill (+ on-primary text), which may be ink or a hue;
   - accent (+ on-accent), selection highlight, link treatment;
   - focus ring style (colour, width, offset); its visibility is protected, its look is brand;
   - typography: UI face, optional display face, mono, heading weight, tracking and case;
   - shape: the radius scale;
   - depth: shadow-led or border-led, border weight and opacity;
   - motion personality: durations and easing;
   - what comfortable and compact each *mean* (the per-density named values).

   Layout and component structure are not levers.
2. **Brand never overrides function.** Status meaning, focus visibility, contrast and the accent's meaning survive every theme.
3. **Recognition = consistency + one or two signature details.**
4. **Dark is designed, not inverted:** lifted text, lower chroma on large fills, lighter raised surfaces, borders instead of heavy shadows, re-tuned data colours. Every theme sets `color-scheme` and `--SCHEME-DARK`.
5. **Every theme is tested against every axis:** both densities × fine/coarse × narrow/wide containers, and it passes the contrast check.
6. **Example themes prove the contract; they are not the product.**

### The placeholder default theme

Neutral, slightly warm greys. An ink (near-black) primary fill. One restrained accent (deep teal-blue), used only for interaction and "you are here". Status hues work as marks (≥ 3:1 on surfaces, so no pale-yellow warning marks), each with text-safe and subtle-background variants. The system UI font stack, no web font. Semibold headings, with tracking set per display step. Tabular numerals in data. Radius ≈ 4 / 6 / 8px. Hairline borders. Soft shadows on floating layers only.

---

## In one line

A contract-first design system where every fact about the UI has its own axis, every guarantee is a check, and a consumer's theme gets exactly the same deal as ours.
