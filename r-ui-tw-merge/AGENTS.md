# @batthewz/r-ui-tw-merge: how to use it

`cn()` plus a tailwind-merge configured for the utility names of `@batthewz/r-ui-css`. Hand-written ESM in `src/`, no build step. Its only job is merge awareness: generating a utility is the CSS layer's job, and you need both.

## API

| Export | Use |
| --- | --- |
| `cn(...inputs)` | `clsx` + merge, built-in names only. The default. |
| `createCn(extension)` | A `cn` that also knows your names. Build one per project, export it, import it everywhere. |
| `mergeExtension(extension)` | The tailwind-merge `ConfigExtension` that `createCn` uses: `extendTailwindMerge(mergeExtension(ext))`. |
| `tailwindMergeExtension` | The built-in mirror, deeply frozen. Read it; never mutate it. |
| `twMerge(...classLists)` | The configured merge without `clsx`. |
| `type RUiExtension` | The `extension` argument. |

```ts
import { cn } from "@batthewz/r-ui-tw-merge";

<button className={cn("h-control rounded-md bg-primary px-r3 text-fg-on-primary", className)} />
```

## Extending with `createCn`

A library or app that declares its own utilities (its own `@theme inline` block) registers them here, or `cn()` will not dedupe them, and a new text size will be misread as a colour and dropped.

```ts
import { createCn } from "@batthewz/r-ui-tw-merge";

export const cn = createCn({
  // `--spacing-chart` -> h-chart, p-chart, …   `--text-figure` -> text-figure
  theme: { spacing: ["chart"], text: ["figure"] },
  // A namespace tailwind-merge has no theme key for goes in a class group.
  classGroups: { opacity: [{ opacity: ["faint"] }] },
});
```

Rules:

- **Top level, not `extend`.** `theme`, `classGroups`, `conflictingClassGroups`, `conflictingClassGroupModifiers`, `postfixLookupClassGroups` and `orderSensitiveModifiers` go at the top level of the extension. Passing `extend` throws: it would otherwise be silently replaced.
- **Concatenated, never replaced.** Your `theme` and `classGroups` arrays are appended to the built-ins key by key, so extending `spacing` cannot wipe `text`, and adding to `opacity` keeps `opacity-disabled`.
- **Everything else passes through**: `cacheSize`, `prefix`, `experimentalParseClassName`, `override`, and the conflict maps.
- **Pick the key by the Tailwind namespace of the CSS variable.** `--color-x` -> `theme.color`, `--spacing-x` -> `theme.spacing`, `--text-x` -> `theme.text`, `--font-x` -> `theme.font`, `--font-weight-x` -> `theme["font-weight"]`, `--container-x` -> `theme.container`, `--radius-x`, `--shadow-x`, `--ease-x`, `--animate-x` likewise. `--opacity-x` -> `classGroups.opacity: [{ opacity: ["x"] }]`, `--transition-duration-x` -> `classGroups.duration: [{ duration: ["x"] }]`. An `@utility x` -> a class group of its own.
- **Colour is the forgiving one.** tailwind-merge already treats any unknown `bg-*` / `text-*` suffix as a colour, so a missing colour name rarely changes the result. Register colours anyway; every other namespace changes behaviour when a name is missing.

## The mirror rule

`tailwindMergeExtension` in `src/index.js` lists every utility name r-ui-css declares, and nothing else:

- every name in every `@theme` block reachable from r-ui-css's `"."` export (relative `@import`s followed), excluding wildcard resets, `--default-*` and sub-properties like `--text-h1--line-height`;
- every `@utility` name.

`bun run check` parses r-ui-css at test time from the workspace and compares, namespace by namespace, in both directions. A name in the CSS and not here is **missing**; a name here and not in the CSS is **stale**; a declaration in a namespace this package does not mirror, or in no known namespace, is a **problem**. All three fail. The check has no allowlist.

When r-ui-css adds, removes or renames a utility name, the mirror changes in the same change. Value changes (colours, sizes, durations) never reach this package.

Adding a namespace: put the names in `tailwindMergeExtension`, add its key to the tables in `test/lib/mirror.js` (and a probe in `test/merge.test.js`, which fails until you do), and add merge tests that a pair conflicts and a neighbour survives.

## Editing rules

- `src/index.js` holds the only copy of the names. `src/index.d.ts` types each list as `readonly string[]` on purpose; do not copy the names into it.
- Keep `src/index.d.ts` in step with the exported shape (new theme key, new class group).
- Tests live in `test/` (not published). `node --test`, no extra install.
- Never name a downstream package in this package's docs. It may name r-ui-css, which it mirrors.
- Pre-1.0: removing or renaming a name is breaking (minor bump + changelog entry); adding one is a minor bump too.
