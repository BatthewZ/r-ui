# @batthewz/r-ui-react-components

React 19 components for the r-ui design system: dashboards and product UI that adapt on
four axes (theme, density, input, container) without a single prop for any of them.

Pairs with [`@batthewz/r-ui-css`](https://www.npmjs.com/package/@batthewz/r-ui-css), which owns the token contract and themes.
This package adds the components, the shared hooks, and the domain tokens a dashboard
needs (series and sequential palettes, trend, stale/serious status, chart chrome, code
colours, KPI sizing).

> Status: pre-release (0.1.0). Every group below is built, tested, and exercised by the
> showcase's pages; see [CHANGELOG.md](./CHANGELOG.md) for what each component does and the
> known gaps.

## What's in it

| Group | Components |
|---|---|
| primitives | `Button`, `IconButton`, `Badge`, `StatusLabel`, `Chip`, `Card`, `Alert`, `Spinner`, `Skeleton`, `Kbd`, `Divider`, `Avatar`, `AvatarGroup`, `Link` |
| form | `Field`, `Input`, `Textarea`, `Select`, `SearchInput`, `Checkbox`, `RadioGroup` (+ `Radio`), `Switch`, `SegmentedControl`, `NumberInput`, `CurrencyInput`, `PasswordInput` (strength meter), `MaskedInput`, `Combobox`, `MultiSelect`, `TagInput`, `FileUpload`, `AvatarUpload` (crop and upload), `OTPInput`, `ColorPicker`, `Slider`, `RangeSlider`, `Rating`; form state: `useForm` + `Form`, `useFieldArray`, `ErrorSummary`, `FormActions` |
| overlays | `Tooltip`, `Popover`, `HoverCard`, `DropdownMenu`, `ContextMenu`, `Dialog`, `Drawer`, `ToastProvider` + `useToast` |
| commands | `CommandPalette` + `useCommandPaletteShortcut` |
| data | `Table`, `DataTable` (detail rows, columns menu, resizing, filters, pages, pinned columns, bulk actions), `VirtualizedTable`, `StatCard`, `Sparkline`, `Meter`, `DescriptionList`, `EmptyState`, `Timeline`, `ActivityFeed` |
| navigation | `AppShell`, `Tabs`, `Breadcrumbs`, `Pagination`, `NavList`, `TreeView` (lazy, tri-state, windowed), `RouterProvider` |
| layout | `Stack`, `Inline`, `Grid`, `Container`, `Section`, `Prose`, `ScrollPanel`, `Splitter` |
| preferences | `ThemeSwitcher`, `DensitySwitcher`, `InputSwitcher`, `PreferencesMenu`, `ThemeScript` |
| motion | `ScrollReveal`, `Stagger`, `startViewTransition` / `useViewTransition`, `Parallax` (CSS only), `CountUp`, `ReadingProgress`, `Spotlight` |
| disclosure | `Collapsible`, `Accordion` |
| charts | `LineChart`, `BarChart`, `Heatmap` (hand-rolled SVG, a table behind every chart) |
| content | `CopyButton`, `CodeBlock`, `Markdown` |
| dates | `Calendar`, `RangeCalendar`, `DatePicker`, `DateRangePicker` (dates, or dates and times with `withTime`), `TimeField`, `TimePicker` |
| steps | `Stepper`, `Wizard` |
| marketing | `Hero`, `MediaCard`, `Carousel`, `SiteHeader` + `NavigationMenu` (mega panels, a drawer when narrow), `Footer`, `LogoCloud` (optional marquee), `Pricing` + `PricingTable`, `Testimonial`, `FeatureGrid`, `FeatureRows`, `HowItWorks`, `CallToAction`, `EmailCapture`, `SectionHeading` |
| media | `Image` (a box sized before it loads, blur-up), `Lightbox`, `MasonryGrid` |
| feedback | `ProgressBar`, `ProgressRing`, `Banner`, `ErrorBoundary` (+ `ErrorFallback`) |
| toolbar | `Toolbar` (+ `Item`, `Group`, `Separator`), `ToggleGroup` |
| filters | `FilterBar` (+ `filtersToSearchParams` / `searchParamsToFilters`, defaults left out of the URL) |
| guards | `RequireAuth` |
| boards | `Kanban` (WIP limits; pointer, touch and keyboard moves) |

Pages print as ink on paper in every theme: the shell's navigation, menus and controls drop
out, tables repeat their heads, closed panels print open. Mark your own screen-only parts
with `data-print="hide"` (the CSS package's print conventions).

Plus shared hooks (`useFloating`, `useRovingFocus`, `useVirtualRows`, …), locale-aware number
formatting that renders missing values as "—", and the domain tokens.

## Install

```sh
bun add @batthewz/r-ui-react-components @batthewz/r-ui-css react react-dom @floating-ui/react lucide-react
bun add -d tailwindcss @tailwindcss/vite
```

`@batthewz/r-ui-css`, React, floating-ui, lucide and Tailwind v4 are peer dependencies: your
app owns one copy of each.

`CodeBlock` highlights with `lowlight` and `highlight.js` (dependencies, installed with this
package): lowlight's core and each language's grammar are separate chunks your bundler
fetches the first time a block in that language mounts, so a page with no code pays nothing.

Tailwind v4 must be in your build. With Vite, add its plugin:

```ts
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [react(), tailwindcss()] });
```

In your app's CSS entry, import the CSS package first, then this package's styles, then your
own themes:

```css
@import "@batthewz/r-ui-css";
@import "@batthewz/r-ui-react-components/styles";
@import "./themes/midnight.css";
```

The styles already tell Tailwind where this package's class names are (its shipped `src/`),
so you need no `@source` for it.

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
// themes.ts: one list for the switcher and the script
export const THEMES = [{ value: "default", label: "Light" }, { value: "midnight", label: "Dark" }];

<ThemeSwitcher themes={THEMES} />   // or <PreferencesMenu themes={THEMES} /> in a header
<head><ThemeScript themes={THEMES.map((t) => t.value)} /></head>   // server-rendered HTML
```

A client-only app has no server render, so inline the script into `index.html` at build
time. `@batthewz/r-ui-react-components/theme-script` is the same function with no React in
it, safe to import from a Vite config:

```ts
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { themeScript } from "@batthewz/r-ui-react-components/theme-script";
import { THEMES } from "./src/themes";

const preferencesScript = (): Plugin => ({
  name: "preferences-script",
  transformIndexHtml: () => [
    { tag: "script", children: themeScript({ themes: THEMES.map((t) => t.value) }), injectTo: "head-prepend" },
  ],
});

export default defineConfig({ plugins: [preferencesScript(), react(), tailwindcss()] });
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

A form in a box of capped height (a settings panel, a side sheet) scrolls its fields and
keeps the actions below the scroller, so the scrollbar stops at them:

```tsx
<Form form={form}>
  <ScrollPanel className="max-h-[calc(var(--CONTROL-H)*10)] rounded-md border bg-surface-0">
    <ScrollPanel.Body>{/* fields */}</ScrollPanel.Body>
    <ScrollPanel.Footer>
      <FormActions><FormActions.Submit>Save</FormActions.Submit></FormActions>
    </ScrollPanel.Footer>
  </ScrollPanel>
</Form>
```

A long form in the page's own scroll keeps its actions in view with
`<FormActions sticky>` instead.

### Your router, set once

```tsx
import type { ComponentPropsWithRef } from "react";
import { Link as RouterLink, useLocation } from "react-router";
import { RouterProvider } from "@batthewz/r-ui-react-components";

// Module scope: a link component made during render would remount every link.
function AppLink({ href, ...props }: ComponentPropsWithRef<"a"> & { href: string }) {
  return <RouterLink to={href} {...props} />;
}

export function Root() {
  const { pathname } = useLocation();
  return (
    <RouterProvider link={AppLink} isCurrent={(href) => href === pathname}>
      <App />
    </RouterProvider>
  );
}
```

`Link`, `NavList.Item`, `AppShell.NavItem` / `Brand`, `Breadcrumbs.Item` and `Pagination`
(with `getHref`) then render your router's link and mark the current page; an explicit `as`
or `current` still wins.

### Locale and translations, set once

Every component with words of its own reads them, and the locale it formats numbers, dates
and relative times in, from the nearest `LocaleProvider`:

```tsx
import { type LocaleLabels, LocaleProvider } from "@batthewz/r-ui-react-components";

// Module scope (or useMemo): a new object re-renders every labelled component.
const GERMAN: LocaleLabels = {
  Dialog: { close: "Schließen" },
  Pagination: { previous: "Vorherige Seite", next: "Nächste Seite", page: (n) => `Seite ${n}` },
  Alert: { tones: { error: "Fehler" } },
};

<LocaleProvider locale="de-DE" labels={GERMAN}>
  <App />
</LocaleProvider>;
```

- **Keys** are component names, the `X` of each exported `XLabels` / `DEFAULT_X_LABELS`
  (`Dialog`, `Pagination`; the charts share `Chart`, the preference controls
  `PreferencesMenu`). Each value is any subset of that component's labels, and a map such as
  `tones` may be given in part. A wrong key or label name is a type error.
- **Precedence:** the English defaults < each enclosing provider, outer to inner < the
  component's own `labels` prop. A component's `locale` prop beats the provider's locale.
- **Nesting:** an inner provider overrides only what it sets; the rest comes from the one
  around it. `dir="rtl"` (or `"ltr"`) switches a subtree's direction through a
  `display: contents` wrapper that also carries `lang`; the page's own direction belongs on
  `<html dir>`.
- **Your own components** read the same values: `useLocale()` returns the locale to format
  with (`undefined` means the runtime's default), e.g. `formatNumber(n, { locale })`.
- Label functions receive raw numbers, so a translation can choose its plural form and
  format the number in its own locale (`Combobox: { results: (n) => … }`).
- Put the provider outside `ToastProvider` (and anything else that renders components for
  you), so those components sit inside it.

### Tune the domain tokens

A theme may also retune this package's domain tokens by name: a data colour pair
(`--C-SERIES-3-DARK`), a domain size's per-density values (`--CHART-H-COMPACT`), or
`--PARALLAX-SHIFT`, how far `Parallax` drifts (`0px` turns it off while reveals keep moving;
reduced motion and print zero it whatever the theme sets).

```css
:root[data-theme="midnight"] {
  --PARALLAX-SHIFT: 2rem;
}
```

### Check your theme

A theme you write gets the same checks the example themes do. The CSS package's scripts
measure the contract's pairs and enforce the theme rules; this package's script measures its
domain colours (trend, serious and stale status, code roles) against your surfaces, and
fails a theme that sets a domain size's selected name (`--CHART-H`) instead of its
per-density names (`--CHART-H-COMFORTABLE`, `--CHART-H-COMPACT`):

```sh
node node_modules/@batthewz/r-ui-css/scripts/check-contrast.mjs ./src/themes/midnight.css
node node_modules/@batthewz/r-ui-css/scripts/check-theme-rules.mjs ./src/themes/midnight.css
npx r-ui-domain-contrast --theme ./src/themes/midnight.css
```

Each exits non-zero on a failure, so they can run in CI. The CSS package's checks want the
file named after its theme (`midnight.css` holds `:root[data-theme="midnight"]`).

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
overlays, commands, data, navigation, layout, preferences, motion, disclosure, charts, content,
dates, steps, marketing, feedback, toolbar, filters, guards, boards, media), `/hooks/<name>` (for example `/hooks/use-floating`,
`/hooks/use-preferences`) and `/theme-script` (the pre-paint script and preference helpers,
no React).

Contributing a component: see [AGENTS.md](./AGENTS.md).
