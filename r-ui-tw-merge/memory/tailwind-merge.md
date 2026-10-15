# tailwind-merge behaviour this package depends on

## The default scales decide which namespaces are load-bearing

tailwind-merge ships a default theme per key, and the mirror only matters where that default would not already accept the name:

- **`color` accepts anything.** Any unknown `bg-*` / `text-*` / `border-*` suffix is a colour, so colour names change almost nothing. They are mirrored for completeness and so the mirror check can be exact, not because merges depend on them.
- **`text` accepts T-shirt sizes only.** An unregistered `text-h1` falls through to the colour group, so `text-h1 text-fg-muted` keeps only the colour. That is the failure worth guarding most: it drops a class without any sign.
- **`spacing` accepts numbers and `px`, `container` T-shirt sizes, `ease` and `animate` short literal lists.** Unregistered names there become unknown classes, which are never merged, so a pair simply stops collapsing.
- **`radius`, `shadow`, `font-weight` defaults already cover common names** (`sm`, `md`, `lg`, `semibold`). They still go in the mirror: the mirror is defined by the CSS, not by what happens to work.

## Some Tailwind namespaces have no tailwind-merge theme key

`--opacity-*` and `--transition-duration-*` generate `opacity-x` and `duration-x`, but tailwind-merge validates those groups with number checks, not a theme. Their names extend the `opacity` and `duration` class groups instead. `@utility` names get class groups of their own. The mirror comparison reads names out of class groups as well as `theme`, so these are checked like everything else.

## The extension shape

tailwind-merge's `ConfigExtension` keeps group keys (`theme`, `classGroups`, conflict maps) under `extend`/`override` and static keys (`cacheSize`, `prefix`) at the top. An earlier design took everything at the top level and pushed the leftovers into `extend`, which put `cacheSize` where tailwind-merge never reads it and let a user's `classGroups` replace the built-in ones. The fix is to sort keys by kind: concatenate `theme` and `classGroups`, put group keys under `extend`, leave static keys at the top, and reject `extend` from the caller rather than overwrite it.

## Parsing the CSS

Read the CSS package's entry from its `"."` export and follow relative `@import`s; that is the set of names a consumer actually gets. Skip wildcard resets (`--color-*: initial`), `--default-*` and sub-properties (`--text-h1--line-height`). Resolve the namespace by longest prefix against a list that includes the namespaces this package does not mirror, or `--text-shadow-sm` is misread as the text name `shadow-sm`. Anything unclassifiable is a failure, never a skip.

## A same-name `@utility` is not a new name

r-ui-css adds declarations to some theme utilities with an `@utility` of the same class (a face on `text-h1`, forced-colors handling on `bg-accent`). Tailwind emits both blocks under one class, so tailwind-merge must keep treating it as the theme name: a separate class group would stop `text-h1 text-h2` collapsing. The parser recognises a companion only by the exact class a theme name generates (`text-h1`, `bg-ink`, `z-sticky`), never by prefix, so `text-h1-face` is still a new name to mirror.
