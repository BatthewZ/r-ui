# memory — @batthewz/r-ui-renderer

Durable lessons for anyone working in this package: principles and traps only, no TODOs,
line numbers or file inventories. One file per topic, indexed here. The family-wide lessons
are in the root `memory/`; the previous generation's renderer kept its own, and the ones
that still apply are carried into `AGENTS.md` and the gates.

| File | What it holds |
| --- | --- |
| [core-lessons.md](./core-lessons.md) | Rendering: one pure pass of library elements, boundaries by the parent's contract, memoising on node identity, decisions on resolved values, every issue once in the DOM |
| [rt-lessons.md](./rt-lessons.md) | Runtime and forms: the library owns form state, hosts beside the document, handlers on an external store, Dates never through `toJSON`, request identity, time zones in tests |
| [stream-lessons.md](./stream-lessons.md) | The streaming parser: cheap snapshots, structural sharing, no quadratic pointers, one acceptance contract with `JSON.parse`, shown nodes stay shown, one reader per source |
| [val-lessons.md](./val-lessons.md) | The validator, Zod and `schema.json`: one schema source, picking the union branch, the shared stack, warnings as the renderer's promises, Zod's reader is no referee |
| [gate1-lessons.md](./gate1-lessons.md) | Where the halves meet: one function per shared rule, derive or curate-and-classify, key-for-key gates, identity as a runtime contract, inert submits, the end-to-end document |
