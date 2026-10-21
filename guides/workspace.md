# Workspace

One bun workspace at the repo root. `package.json` lists `r-ui-css`, `r-ui-tw-merge`, `r-ui-react-components` and `r-ui-renderer`. Internal dependencies use `"workspace:^"`, which packs as a `^x.y.z` range (`workspace:*` would pack an exact pin).

r-ui-renderer takes the library as a **peer** (`"^0.1.0"`, written by hand, so the workspace never rewrites it) and as a `workspace:^` dev dependency for its own tests and gates. A library minor bump therefore means editing that peer range by hand (see the bump rule in [CLAUDE.md](../CLAUDE.md)).

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
