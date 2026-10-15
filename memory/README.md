# Family memory

Lessons that span packages. Package-specific lessons live in each package's own
`memory/`.

- [parallel-builds.md](parallel-builds.md): how this family is built. Parallel
  batches of agents owning disjoint files, then one sequential gate that
  integrates, tests and looks; the structure that keeps parallel work safe in a
  single worktree; pitfalls seen.
