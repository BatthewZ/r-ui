# Lessons from the second gate: the corpus meets the browser

- **An exemption is a contract fact or it is a bug.** Every corpus finding was a rule
  keyed on a name where the declarations already held the answer: an option's `value` is
  required (its identity), a controlled `value` never is; MasonryGrid's `list` is a
  boolean, which no id reference can be; a loading stand-in is a part that renders alone;
  a node prop the component renders inside a menu is placed inside that menu. Read the
  fact once (`contract-facts`) and let the renderer, the validator, the reference and the
  contract assembly all ask it, or the four drift apart again.
- **Never advertise what you drop.** A prop the renderer always drops must not appear in
  the contract's `props`, or the reference teaches it and `unknown-prop` stays silent on it.
- **A marker that builds a value is judged on what it builds.** URL and image rules run on
  the resolved string, so `"java"` and `"script:…"` joined are refused like the literal.
  The validator can only judge what the literal start decides (a complete scheme); say so
  rather than guessing at the rest.
- **The omission scan must know the library's idioms.** A component that sanitises a URL
  rebuilds its props bag (`{ ...rest, href }`) and spreads it later; a scan keyed on
  spreads into JSX alone lost the sink without a sound. When a library refactor makes a
  table entry stale, ask what new shape the sink took before deleting the entry.
- **Object-typed props are not key-checked.** A Grid `columns` map keyed `"lg"` instead of
  `"@lg"` passed the validator, the corpus tests and every browser check, and showed one
  column at every width. Only the screenshots found it. Container-query keys, nested
  shapes and bags belong to a later typed check; until then, look.
- **Layout bugs are document bugs first.** A Field `orientation: "horizontal"` around a
  Switch that labels itself, a sign-up form in a CTA's `actions` slot instead of its
  children, a Container (auto margins) as a Stack's child holding a size container, and
  marketing section padding inside a dashboard all rendered without a diagnostic. Each
  became a contract note or a corrected document, never an allowance.
- **A streaming claim must be able to happen.** "The heading is seen part-written" can only
  hold if a push can end inside it: pick a text longer than the push size, or the check
  passes or fails by where the boundaries fall.
- **Match what the user reads, not what you wrote.** A toast's text carries its tone for
  screen readers ("Success: Settings saved"); an exact-text locator never matched it.
