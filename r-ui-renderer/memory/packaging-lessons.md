# Packaging the renderer: lessons

- **A JSON import ships up to four times.** Vite turns it into a JS module, `vite-plugin-dts`
  writes a `.json.d.ts` with the whole document as a type, a module that re-exports it
  inlines that inferred type into its own `.d.ts`, and `src/` ships the file itself. Keep
  declarations to code (`include` the `.ts` files only), spell out the type of anything
  that holds documents (a name union and `unknown` values), and leave the source JSON out
  of `files`: dist carries the data once. A JSON chunk then ships without a source map,
  since its map would name a file the tarball no longer holds.
- **Check the shape a consumer gets, not the build log.** Every subpath must resolve to a
  module the build emits, and no test, test helper or check fixture may be an entry or a
  packed file; a test asserts both from the config and from `bun pm pack --dry-run`.
- **Documents for checks are not corpus.** Control documents (a refused image, a card that
  reaches for the whole page) carry deliberate warnings; they live apart from the corpus,
  are never built or packed, and declare the diagnostics they render, so a check that finds
  none knows its probe is blind.
- **Measured (October 2026, `npm pack --dry-run`):** before the `./examples` subpath was made
  lean, 718 KB packed / 3.63 MB unpacked, 593 files; after, 505 KB packed / 2.03 MB
  unpacked, 513 files. Re-measure after a change to `files`, the entries or the corpus.
