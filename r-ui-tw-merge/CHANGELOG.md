# Changelog

## Unreleased

- **Packaging.** `LICENSE` (MIT) ships with the package.
- **Mirror** follows r-ui-css's additions: the `heading` font family; the stacking layers `raised`, `sticky`, `docked`, `bypass` as a `z` class group (tailwind-merge has no z-index theme key), so `z-10 z-sticky` collapses.
- **Mirror check**: an `@utility` that shares its exact class with a theme utility (r-ui-css's faces on `text-h1`, forced-colors handling on `bg-accent`) extends that utility and is not a separate name. `text-h1 font-mono`, `text-h6 uppercase` and `text-display-2 tabular-nums` keep both classes.

## 0.1.0 (unreleased)

First release.

- **`cn`, `createCn`, `mergeExtension`, `tailwindMergeExtension`, `twMerge`** for the `@batthewz/r-ui-css` 0.1.0 utility names: colours; font families and weights; UI, display and prose text sizes; spacing and sizes (`r1`–`r6`, `control`, `row`, `icon`, `hit`, `section-1`–`3`, `gutter`); container widths (`measure`, `page`, `column-sm`/`md`/`lg`); radius; shadow; `opacity-disabled`; durations; easings; animations; `focus-ring` / `focus-ring-inset`; `hit-area`. tailwind-merge's defaults are kept.
- **Extensions** take tailwind-merge's group keys at the top level. `theme` and `classGroups` are concatenated onto the built-ins; static keys and conflict maps pass through. `mergeExtension` returns a complete `ConfigExtension`. Passing `extend` throws.
- **Mirror check.** `bun run check` parses r-ui-css's `@theme` blocks and `@utility` rules and fails on any missing or stale name, per namespace.
