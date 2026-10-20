# Workspace

One bun workspace at the repo root. `package.json` lists `r-ui-css`, `r-ui-tw-merge` and `r-ui-react-components`. Internal dependencies use `"workspace:^"`, which packs as a `^x.y.z` range (`workspace:*` would pack an exact pin).

## Commands

```sh
bun install                                              # from the root only
bun run check                                            # every package's check script
bun run test                                             # every package's tests
bun run --filter @batthewz/r-ui-react-components test   # one package
```

## The isolated linker

Bun ≥ 1.3 installs workspaces with the isolated linker: packages live in `node_modules/.bun/`, and each package's `node_modules` holds symlinks to its own declared dependencies only. In practice:

- **A package can import only what its own `package.json` declares.** An import that resolves only because a sibling declares the dependency fails here. Declare it; don't rely on hoisting.
- **Tailwind `@source` paths must be self-relative.** A sideways path into a sibling package (`@source "../../r-ui-…"`) assumes a hoisted layout and silently matches nothing. A package that ships components registers its own sources from its own CSS entry.
- **Run one install at a time.** Concurrent `bun install` runs corrupt `bun.lock`.
