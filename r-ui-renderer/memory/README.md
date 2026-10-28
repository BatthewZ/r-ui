# memory — @batthewz/r-ui-renderer

Durable lessons for anyone working in this package: principles and traps only, no TODOs,
line numbers or file inventories. One file per topic, indexed here. The family-wide lessons
are in the root `memory/`; the previous generation's renderer kept its own, and the ones
that still apply are carried into `AGENTS.md` and the gates.

| File | What it holds |
| --- | --- |
| [core-lessons.md](./core-lessons.md) | Rendering: one pure pass of library elements, boundaries by the parent's contract, memoising on node identity, decisions on resolved values, every issue once in the DOM, one marker walk |
| [rt-lessons.md](./rt-lessons.md) | Runtime and forms: the library owns form state, hosts beside the document, handlers on an external store, Dates never through `toJSON`, request identity, a settled request kept, time zones in tests |
| [stream-lessons.md](./stream-lessons.md) | The streaming parser: cheap snapshots, structural sharing, no quadratic pointers, one acceptance contract with `JSON.parse`, shown nodes stay shown, one reader per source |
| [val-lessons.md](./val-lessons.md) | The validator, Zod and `schema.json`: one schema source, picking the union branch, the shared stack, warnings as the renderer's promises, Zod's reader is no referee |
| [gate1-lessons.md](./gate1-lessons.md) | Where the halves meet: one function per shared rule, derive or curate-and-classify, key-for-key gates, identity as a runtime contract, inert submits, the end-to-end document |
| [ref-lessons.md](./ref-lessons.md) | The reference: render from emptied prose, list props as a document writes them, the validator decides what is listed, reference-only data in its own file, no Markdown in a React-free subpath |
| [pg-lessons.md](./pg-lessons.md) | The playground: "settled" is a host-side count, a check route takes its axes from the URL alone, host density through `ViewRenderer`, replay by remounting |
| [corpus-lessons.md](./corpus-lessons.md) | The corpus and its browser checks: never bend a document to silence a check, "no diagnostics" on a view stuck loading, open every overlay, realistic data finds format gaps, one settled signal |
| [gate2-lessons.md](./gate2-lessons.md) | The corpus meets the browser: exemptions as contract facts, never advertise a drop, judge built values on the result, the scan knows the library's idioms, look at what no check types |
| [packaging-lessons.md](./packaging-lessons.md) | The tarball: a JSON import ships four times, check the consumer's shape, documents for checks are not corpus, the measured size |
| [fix-batch-lessons.md](./fix-batch-lessons.md) | The fix batch: copy a renderer rule from its code, one policy object everywhere, delete the local copy, gate what the README leaves out, test the casing a rule rescues, adapters take what the renderer resolved, route every probe document, watch a layered guard from the first script, exact labels in checks |
| [theme-lessons.md](./theme-lessons.md) | A document's theme: read colours through a probe, mirror the root's guard rules where roles are redeclared, derive pairs from what the check measures, judge partial palettes where they touch the host, "no commit" vs "no frame", jsdom's unresolved `var()`, one issue per location |
| [generics-lessons.md](./generics-lessons.md) | Generic components in the contracts: default type arguments written as the synthetic module reaches them, props typed by a type parameter read at the default, a library change that breaks the renderer only through the release |
