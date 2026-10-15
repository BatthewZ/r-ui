# @batthewz/r-ui-tw-merge

`cn()` for `@batthewz/r-ui-css`. It teaches [tailwind-merge](https://github.com/dcastil/tailwind-merge) the r-ui-css utility names, so conflicting classes collapse and unrelated ones survive:

```ts
import { cn } from "@batthewz/r-ui-tw-merge";

cn("p-r3 p-r5");                 // "p-r5"
cn("text-h1 text-fg-muted");     // "text-h1 text-fg-muted"   (a size and a colour)
cn("h-control", "h-row");        // "h-row"
cn("rounded-sm", { "rounded-lg": isOpen }); // clsx inputs work
```

Plain tailwind-merge gets both of the first two wrong: it keeps `p-r3 p-r5` (it has never heard of `r3`), and it reads `text-h1` as a colour and drops it in favour of `text-fg-muted`.

No CSS ships from this package, and r-ui-css needs nothing from it. Use it when you write Tailwind classes from JavaScript and merge a caller's `className` into your own.

## Install

```sh
bun add @batthewz/r-ui-tw-merge
```

`clsx` and `tailwind-merge` (v3) come with it. ESM only.

## Your own utility names

If your project adds utilities on top of r-ui-css (its own `@theme inline` block), build a project-local `cn` that knows them too:

```ts
// cn.ts
import { createCn } from "@batthewz/r-ui-tw-merge";

export const cn = createCn({
  theme: { spacing: ["chart"], text: ["figure"] },
});

cn("h-control h-chart");       // "h-chart"
cn("text-figure text-fg-muted"); // both kept: `figure` is a size, not a colour
```

Your lists are added to the built-in ones, never instead of them. [AGENTS.md](AGENTS.md) has the full extension rules.

## What it knows

Every utility name r-ui-css declares, one list per Tailwind namespace: colours, font families (`ui`, `heading`, `display`, `mono`) and weights, text sizes (UI, display and prose), spacing and sizes (`r1`–`r6`, `control`, `row`, `icon`, `hit`, `section-*`, `gutter`), `measure`, radius, shadow, opacity, durations, easings, animations, stacking layers (`z-raised`, `z-sticky`, `z-docked`, `z-bypass`), and the `focus-ring` utilities. tailwind-merge's own defaults keep working.

The list is checked, not trusted: `bun run check` parses r-ui-css's `@theme` blocks and fails if the two differ by a single name, in either direction.

## Develop

```sh
bun run check   # the mirror equals r-ui-css, namespace by namespace
bun run test    # the mirror check, plus merge behaviour
```

| Doc | For |
| --- | --- |
| [AGENTS.md](AGENTS.md) | API, extending with `createCn`, the mirror rule |
| [CHANGELOG.md](CHANGELOG.md) | Releases |
| [memory/](memory/README.md) | Lessons for whoever changes this package |
