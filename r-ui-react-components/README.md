# @batthewz/r-ui-react-components

React 19 components for the r-ui design system: dashboards and product UI that adapt on
four axes (theme, density, input, container) without a single prop for any of them.

Pairs with [`@batthewz/r-ui-css`](../r-ui-css), which owns the token contract and themes.
This package adds the components, the shared hooks, and the domain tokens a dashboard
needs (series and sequential palettes, trend, stale/serious status, chart chrome, code
colours, KPI sizing).

> Status: pre-release (0.0.0). Every group below is built, tested, and exercised by the
> showcase's pages; see [CHANGELOG.md](./CHANGELOG.md) for what each component does and the
> known gaps.

## What's in it

| Group | Components |
|---|---|
| primitives | `Button`, `IconButton`, `Badge`, `StatusLabel`, `Card`, `Alert`, `Spinner`, `Skeleton`, `Kbd`, `Divider`, `Avatar`, `Link` |
| form | `Field`, `Input`, `Textarea`, `Select`, `SearchInput`, `Checkbox`, `RadioGroup` (+ `Radio`), `Switch`, `SegmentedControl`, `NumberInput`, `Combobox`, `MultiSelect`, `TagInput`; form state: `useForm` + `Form`, `useFieldArray`, `ErrorSummary`, `FormActions` |
| overlays | `Tooltip`, `Popover`, `DropdownMenu`, `Dialog`, `Drawer`, `ToastProvider` + `useToast` |
| data | `Table`, `DataTable`, `VirtualizedTable`, `StatCard`, `Sparkline`, `Meter`, `DescriptionList`, `EmptyState` |
| navigation | `AppShell`, `Tabs`, `Breadcrumbs`, `Pagination`, `NavList`, `RouterProvider` |
| layout | `Stack`, `Inline`, `Grid`, `Container`, `Section`, `Prose` |
| preferences | `ThemeSwitcher`, `DensitySwitcher`, `InputSwitcher`, `PreferencesMenu`, `ThemeScript` |
| motion | `ScrollReveal`, `Stagger`, `startViewTransition` / `useViewTransition` |
| disclosure | `Collapsible`, `Accordion` |
| charts | `LineChart`, `BarChart`, `Heatmap` (hand-rolled SVG, a table behind every chart) |
| content | `CopyButton`, `CodeBlock`, `Markdown` |
| dates | `Calendar`, `RangeCalendar`, `DatePicker`, `DateRangePicker` |

Plus shared hooks (`useFloating`, `useRovingFocus`, `useVirtualRows`, …), locale-aware number
formatting that renders missing values as "—", and the domain tokens.

## Install

```sh
bun add @batthewz/r-ui-react-components @batthewz/r-ui-css react react-dom @floating-ui/react lucide-react
```

`CodeBlock` highlights with `lowlight` and `highlight.js` (dependencies, installed with this
package): lowlight's core and each language's grammar are separate chunks your bundler
fetches the first time a block in that language mounts, so a page with no code pays nothing.

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

### Saved preferences, no flash

`useTheme`, `useDensity` and `useInputMode` (and the switchers built on them) set the
attribute on `<html>` and save the choice in `localStorage`. Put the pre-paint script in your
document `<head>` with the same options, so a reload applies it before the first paint:

```tsx
const THEMES = [{ value: "default", label: "Light" }, { value: "midnight", label: "Dark" }];

<head><ThemeScript themes={THEMES.map((t) => t.value)} /></head>   // SSR / static HTML
// client-only app: inline `themeScript({ themes })` in index.html at build time

<ThemeSwitcher themes={THEMES} />   // or <PreferencesMenu themes={THEMES} /> in a header
```

### Forms

```tsx
const form = useForm({ schema, defaultValues: { name: "" }, onSubmit: save });

<Form form={form}>
  <Field name="name"><Field.Label>Name</Field.Label><Input /><Field.Error /></Field>
  <FormActions><FormActions.Submit>Save</FormActions.Submit></FormActions>
</Form>
```

`schema` is any [Standard Schema](https://standardschema.dev) (Zod, Valibot, ArkType…).
Every control in the library binds through the `Field` it sits in; a failed submit focuses
the first invalid field. Dates are calendar dates (`Date` at local midnight) and submit as
`YYYY-MM-DD`.

### Your router, set once

```tsx
// Module scope: a link component made during render would remount every link.
const AppLink = ({ href, ...props }) => <RouterLink to={href} {...props} />;

<RouterProvider link={AppLink} isCurrent={(href) => href === pathname}>
  <App />
</RouterProvider>
```

`Link`, `NavList.Item`, `AppShell.NavItem` / `Brand`, `Breadcrumbs.Item` and `Pagination`
(with `getHref`) then render your router's link and mark the current page; an explicit `as`
or `current` still wins.

## Develop

```sh
bun run showcase:dev    # the showcase app, with a View panel for theme, density and input
bun run showcase:build  # a static build of it, in showcase/dist/
bun run check           # all gates + typecheck + lint + test
bun run browser:check   # real-browser checks against a fresh showcase (needs playwright-cli)
bun run browser:check stress   # only the scripts whose name contains "stress"
bun run build           # dist/ (ESM, preserveModules, .d.ts)
```

The showcase loads the example themes and their web faces the way an app would (its CSS
entry imports them; a theme file only names its faces). It has four pages: **Overview** (every component, every state, one section each),
**Dashboard** (an operations dashboard in an `AppShell`), **Marketing** (a landing page on the
fluid display and section scales, UI components inside it at UI scale) and **Stress** (nested
density, clipped floating panels, 10,000 rows, extreme and translated content, RTL). Each page
has a browser check in `scripts/browser/`.

Subpath imports: `@batthewz/r-ui-react-components/components/<group>` (primitives, form,
overlays, data, navigation, layout, preferences, motion, disclosure, charts, content, dates)
and `/hooks/<name>` (for
example `/hooks/use-floating`, `/hooks/use-preferences`).

Contributing a component: see [AGENTS.md](./AGENTS.md).
