# @batthewz/r-ui-css

A design-token contract for Tailwind v4, in plain CSS. One vocabulary for colour, type, space, shape, depth and motion, a theme contract that lets a brand be one file, and four sizing axes that let the same markup serve a dense dashboard, a touch screen and a marketing page.

No JavaScript ships from this package.

## Why

- **Tokens are the only vocabulary.** `p-r3`, `text-body-1`, `bg-surface-0`, `h-control`. The Tailwind defaults this contract replaces (`text-sm`, `bg-blue-500`, `rounded`, `shadow-xl`, `font-bold`, `leading-tight`, `ease-in-out`) are removed from the build, so they generate nothing. Numeric spacing (`p-4`) still compiles for layout one-offs; components use the `r` scale.
- **A theme is one file.** Flip `<html data-theme="…">` and colour, faces, figures, shape, line weight, depth, motion and what "comfortable" and "compact" mean all change. Components never do.
- **Sizing follows the situation, not the screen.** Density can change per element, a coarse pointer raises the hit floor, components size to their container. The viewport only moves layout.
- **Two type scales, split by role.** A flat UI scale for everything interactive, a fluid prose/display scale for long-form and marketing text. A button inside an article is still a UI button.
- **Accessible in every theme.** Contrast floors are measured, hit targets follow the input axis, motion collapses under reduced motion, and forced colors (Windows High Contrast) map every role to a system colour. Every theme prints as ink on paper.
- **Checked, not hoped.** `bun run check` measures every contrast pair in every theme, enforces the theme rules, and compiles the package.

## Quick start

Tailwind v4 must be in your build (the Vite plugin, the PostCSS plugin or the CLI). The package is CSS and has no other dependency:

```sh
bun add @batthewz/r-ui-css
bun add -d tailwindcss @tailwindcss/vite   # or @tailwindcss/postcss, @tailwindcss/cli
```

```css
/* app.css */
@import "@batthewz/r-ui-css";
```

Tailwind finds the class names in your own markup by itself: it scans the directory the build runs in, skipping `node_modules` and anything git ignores. Add `@source` only for markup it skips, such as a package that ships templates or a sibling folder outside the project. The path is relative to the CSS file that declares it:

```css
/* src/styles/app.css */
@source "../../node_modules/some-ui-kit/dist"; /* markup Tailwind would not scan */
```

```html
<html data-density="comfortable">
  <body>
    <div class="rounded-lg border bg-surface-0 p-r2">
      <h3>Services</h3>
      <p class="text-fg-secondary">All systems normal.</p>
      <button class="mt-r3 h-control rounded-md bg-primary px-r3 font-medium text-fg-on-primary hover:bg-primary-hover">
        Deploy
      </button>
    </div>

    <section data-density="compact">…tighter, same markup…</section>

    <article class="prose max-w-measure">
      <h1>Long-form heading</h1>
      <p>Reading leading and a fluid size.</p>
    </article>
  </body>
</html>
```

The default theme is `:root` itself: light, warm neutrals, an ink primary, one restrained accent. For another theme, copy [`src/_theme-template.css`](src/_theme-template.css), import it after the package and set `data-theme` on `<html>`. Three worked examples (one dark; two light, with different personalities, one of them naming web faces that the app loads) live under [`src/examples/themes/`](src/examples/themes/); nothing imports them.

Check your own theme with the same scripts the package runs on its examples. They ship with the package and need nothing installed beyond Node:

```sh
node node_modules/@batthewz/r-ui-css/scripts/check-contrast.mjs ./src/themes/aurora.css
node node_modules/@batthewz/r-ui-css/scripts/check-theme-rules.mjs ./src/themes/aurora.css
```

The first measures every contrast pair in your theme; the second enforces the theme rules (root selector only, one scheme, no selected density names, no `@media`, no `!important`). The theme's file name must match its `data-theme` name. [docs/theme-contract.md](docs/theme-contract.md) explains each rule.

## Read next

| Doc | For |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Every token and utility group, and the rules for using them |
| [docs/axes.md](docs/axes.md) | Theme, density, input, container; the UI vs prose split |
| [docs/theme-contract.md](docs/theme-contract.md) | Writing a theme: levers, contrast pairs, density, `--SCHEME-DARK` |
| [CHANGELOG.md](CHANGELOG.md) | Releases |

## Develop

```sh
bun run check     # contrast, theme rules, compile
bun run test      # proves each check can fail
bun run specimen  # builds specimen/dist; open specimen/index.html over HTTP
```

The specimen page shows every token at every axis setting, with live measurements (`window.measure()`).
