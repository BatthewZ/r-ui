# @batthewz/r-ui-react-components

React 19 components for the r-ui design system: dashboards and product UI that adapt on
four axes (theme, density, input, container) without a single prop for any of them.

Pairs with [`@batthewz/r-ui-css`](../r-ui-css), which owns the token contract and themes.
This package adds the components, the shared hooks, and the domain tokens a dashboard
needs (series and sequential palettes, trend, stale/serious status, chart chrome, KPI sizing).

> Status: pre-release (0.0.0). Every group below is built, tested, and exercised by the
> showcase's pages; see [CHANGELOG.md](./CHANGELOG.md) for what each component does and the
> known gaps.

## What's in it

| Group | Components |
|---|---|
| primitives | `Button`, `IconButton`, `Badge`, `StatusLabel`, `Card`, `Alert`, `Spinner`, `Skeleton`, `Kbd`, `Divider`, `Avatar`, `Link` |
| form | `Field`, `Input`, `Textarea`, `Select`, `SearchInput`, `Checkbox`, `RadioGroup` (+ `Radio`), `Switch`, `SegmentedControl`, `NumberInput` |
| overlays | `Tooltip`, `Popover`, `DropdownMenu`, `Dialog`, `Drawer`, `ToastProvider` + `useToast` |
| data | `Table`, `DataTable`, `VirtualizedTable`, `StatCard`, `Sparkline`, `Meter`, `DescriptionList`, `EmptyState` |
| navigation | `AppShell`, `Tabs`, `Breadcrumbs`, `Pagination`, `NavList` |
| layout | `Stack`, `Inline`, `Grid`, `Container`, `Section`, `Prose` |

Plus shared hooks (`useFloating`, `useRovingFocus`, `useVirtualRows`, …), locale-aware number
formatting that renders missing values as "—", and the domain tokens.

## Install

```sh
bun add @batthewz/r-ui-react-components @batthewz/r-ui-css react react-dom @floating-ui/react lucide-react
```

Tailwind v4 must be in your build (for example `@tailwindcss/vite`). In your app's CSS
entry, import the CSS package first, then this package's styles:

```css
@import "@batthewz/r-ui-css";
@import "@batthewz/r-ui-react-components/styles";
```

## Use

```tsx
import { formatCompact, formatDelta } from "@batthewz/r-ui-react-components";

formatCompact(128_430); // "128.4K"
formatDelta(-3.5);      // "-3.5"
formatCompact(null);    // "—"
```

The axes are attributes, not props:

```html
<html data-theme="…" data-density="compact" data-input="coarse">
  <section data-density="compact">…a compact card inside any page…</section>
</html>
```

## Develop

```sh
bun run showcase:dev    # the showcase app, with a View panel for theme, density and input
bun run showcase:build  # a static build of it, in showcase/dist/
bun run check           # all gates + typecheck + lint + test
bun run browser:check   # real-browser checks against a fresh showcase (needs playwright-cli)
bun run browser:check stress   # only the scripts whose name contains "stress"
bun run build           # dist/ (ESM, preserveModules, .d.ts)
```

The showcase has four pages: **Overview** (every component, every state, one section each),
**Dashboard** (an operations dashboard in an `AppShell`), **Marketing** (a landing page on the
fluid display and section scales, UI components inside it at UI scale) and **Stress** (nested
density, clipped floating panels, 10,000 rows, extreme and translated content, RTL). Each page
has a browser check in `scripts/browser/`.

Subpath imports: `@batthewz/r-ui-react-components/components/<group>` (primitives, form,
overlays, data, navigation, layout) and `/hooks/<name>` (for example `/hooks/use-floating`).

Contributing a component: see [AGENTS.md](./AGENTS.md).
