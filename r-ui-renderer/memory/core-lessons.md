# Render core: lessons

- **Build the library's elements in one pure pass; put boundaries by the parent's contract.**
  A parent that reads its children (identity, props, clone, count) gets them raw; every
  other child gets a boundary. Errors inside an inspecting parent's children land on the
  boundary around that parent. `$each` returns a keyed array and `$cond` returns its branch,
  so both are invisible to counting and identity parents.
- **Memoising on node identity needs every input compared, not just the node.** The
  context is rebuilt on every view render; compare it field by field (roots one level down)
  and leave the stream's pending set out, or every streamed chunk invalidates everything.
  Compare the node's own "still streaming" flag instead. A runtime that rebuilds its
  `data`/`status` records per snapshot defeats the memo just as surely: keep their identity
  while their entries are the same.
- **A policy list names DOM attributes; a contract can give the same name a meaning.**
  `form` is a DOM id reference, except as Form's or Wizard's form handle. Check the
  contract's meaning before the generic list, and pick the default by the miss you can
  afford: `name` keeps its meaning unless the contract says it is a DOM name (an
  Avatar's person and the Icon's kebab-case glyph were both being dropped the other way).
- **"Dropped" is not always safe for the component.** Image reads an absent `src` as
  loading and throws on it; a refused `src` becomes `null`, the library's "no picture". A
  required Intl prop that is dropped makes its component throw; the boundary shows that.
- **Coercions that consume markers run on the literal.** Column defs and row templates
  turn a `$node` into a function, so they must see it before resolution. Everything keyed
  by a prop's name but decided by its value (URLs, images, element choices, dates, sets,
  icons) runs on the resolved value, and its test must use the `$ref` spelling.
- **Every issue once in the DOM.** An in-place diagnostic reports with `inPlace`; anything
  with no element (a dropped prop, a node inside table rows or a `ul`) goes to the hidden
  issue log. The channel delivers on a microtask, so a test of the log awaits one.
- **Test helpers that are not tests:** a file named `*.test.helpers.tsx` stays out of the
  package (`*.test.*`) and out of the test run (`*.test.tsx` only).
- **One marker walk.** Props and action payloads resolve markers through one `MarkerResolver`;
  a prop subclass differs only where it must (a `$node` renders, an `on…` key is a handler,
  drops are reported). A rule about `$ref`, `$format` or `$concat` changes there, once, or the
  two drift apart silently.
