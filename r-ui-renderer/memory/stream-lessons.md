# Streaming parser: lessons

- **Make snapshots cheap to take and pay only when they are read.** A push records O(depth)
  state: each open frame's member count, open key and readiness, over append-only member
  arrays. The open spine is built only when `spec` is first read, and cached per frame by
  revision. Building it on every push is quadratic on a wide open array: 1 MB fed a
  character at a time took 130 s that way, against under a second this way.
- **Structural sharing comes from append-only members.** A closed value is final the moment
  it closes and is never copied again. A snapshot slices to the length it saw, so an old
  snapshot read late is still exact.
- **Never hash every open pointer.** Spelling each pointer of a hostile nesting depth is
  O(depth²). The pending set answers `has` by walking tokens, and spells pointers out only
  when someone iterates it.
- **Text from the document never indexes a plain object.** A node whose first key is
  `constructor` returned `Object` from a grammar table and threw. Use `Map`s. Build members
  with an own `__proto__` (via `defineProperty`), as `JSON.parse` does.
- **One acceptance contract, fuzzed against the reference.** The parser accepts exactly what
  `JSON.parse(stripCodeFence(text))` accepts. Random mutation finds most divergences but
  misses rare corners of the grammar (a leading zero), so pair it with a table of
  spellings.
- **A shown node stays shown.** You only know a key is out of order when it arrives. A node
  already emitted cannot be retracted, because the emitted pointer set only grows. So a late
  key (props after children) joins the node only once its value has closed.
- **Show nothing half-made.** Partial text drops a trailing high surrogate, which may be half
  of a pair still arriving, and drops an escape still being read.
- **One reader per source, cancelled late.** A `ReadableStream` or generator can be read only
  once. Share one reader per source object, and cancel it a macrotask after the last
  subscriber leaves. Cancelling in effect cleanup kills the stream before StrictMode's
  remount.
- **`ReadableStream`'s `controller.error()` discards queued chunks.** A test stream that
  fails after delivering data must fail on a later pull.
