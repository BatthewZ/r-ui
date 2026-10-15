# Packaging

What publishing the family taught. Verify a packaging change the way a consumer meets it:
pack each package from a clean copy (`bun pm pack`), install the tarballs into a separate
app with npm (not the workspace, whose links hide missing files and undeclared
dependencies), then typecheck that app with `strict` and `skipLibCheck: false` and build it.

- **`files` ships every file under a folder it names.** Listing `scripts` shipped a
  specimen builder without the specimen it builds. Name the consumer-facing files instead
  of the folder.
- **A package the consumer's CSS imports is a peer, not a dependency.** The consumer owns
  the one copy its Tailwind build compiles; a nested copy would be a second contract. Pair
  the peer range with a `workspace:^` dev dependency for development.
- **`workspace:^` packs as `^x.y.z`; `workspace:*` packs as the exact version.** An exact
  pin between packages that release independently forces a second copy on any mismatch.
- **Source maps embed the sources unless told not to.** With `src/` already in the
  tarball, `sourcesContent` was a second copy: dropping it (`sourcemapExcludeSources`) took
  the component package from 1.04 MB to 0.87 MB packed and from 4.0 MB to 3.0 MB unpacked,
  and the maps still resolve to the shipped sources.
- **A build-time import must not pull in the UI.** A Vite config imported the pre-paint
  script through a components barrel, so the config loaded React components to read one
  string. A subpath export that points at an import-free module keeps build tools out of
  the component graph, and a test holds the module import-free.
- **Remove a dependency only after searching the scripts too.** `tailwind-merge` was unused
  by the components but imported by a gate; it moved to the dev dependencies rather than
  out.
