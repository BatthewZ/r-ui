# Family memory

Lessons that span packages. Package-specific lessons live in each package's own
`memory/`.

- [parallel-builds.md](parallel-builds.md): how this family is built. Parallel
  batches of agents owning disjoint files, then one sequential gate that
  integrates, tests and looks; the structure that keeps parallel work safe in a
  single worktree; sharing it with other live sessions; pitfalls seen.
- [packaging.md](packaging.md): publishing the packages. Verifying a packaging
  change through tarballs in a separate app, `files`, peers vs dependencies,
  `workspace:` ranges, source maps, build-time imports.
