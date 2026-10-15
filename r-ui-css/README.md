# @batthewz/r-ui-css

A design-token contract for Tailwind v4, in plain CSS. One vocabulary for colour, type, space, shape, depth and motion, a theme contract that lets a brand be one file, and four sizing axes that let the same markup serve a dense dashboard, a touch screen and a marketing page.

No JavaScript ships from this package.

## Why

- **Tokens are the only vocabulary.** `p-r3`, `text-body-1`, `bg-surface-0`, `h-control`. The Tailwind defaults this contract replaces (`text-sm`, `bg-blue-500`, `rounded`, `shadow-xl`, `font-bold`, `leading-tight`, `ease-in-out`) are removed from the build, so they generate nothing. Numeric spacing (`p-4`) still compiles for layout one-offs; components use the `r` scale.
- **A theme is one file.** Flip `<html data-theme="…">` and colour, faces, shape, depth, motion and what "comfortable" and "compact" mean all change. Components never do.
- **Sizing follows the situation, not the screen.** Density can change per element, a coarse pointer raises the hit floor, components size to their container. The viewport only moves layout.
- **Two type scales, split by role.** A flat UI scale for everything interactive, a fluid prose/display scale for long-form and marketing text. A button inside an article is still a UI button.
- **Checked, not hoped.** `bun run check` measures every contrast pair in every theme, enforces the theme rules, and compiles the package.

## Quick start

```css
/* app.css */
@import "@batthewz/r-ui-css";
@source "./src/**/*.{html,tsx,vue,svelte}"; /* your own markup, relative to this file */
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

The default theme is `:root` itself: light, warm neutrals, an ink primary, one restrained accent. For another theme, copy [`src/_theme-template.css`](src/_theme-template.css), import it after the package and set `data-theme` on `<html>`. Two worked examples (one dark, one light with a different personality) live under [`src/examples/themes/`](src/examples/themes/); nothing imports them.

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
