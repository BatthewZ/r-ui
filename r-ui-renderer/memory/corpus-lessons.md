# The corpus and its browser checks: lessons

- **Never bend a document to silence a check.** The corpus is what models learn the format
  from; a document reworded around a validator false positive teaches the workaround. Keep
  the document as the advice says to write it and fix the rule at its source, as a contract
  fact the renderer and the validator both read (an option's required `value` is its
  identity; a stand-in part needs no root; a node prop's parts sit where the component
  renders them; an id-reference name typed as no id reference can be is the component's
  own). The corpus asserts zero issues with no allowance list: an excuse ledger outlives
  the bug it excused.
- **"No diagnostics" passes on a view stuck loading.** A document whose binding never
  answered renders its loading branch cleanly. Assert that every `api` binding was requested
  and answered before trusting a clean render.
- **A closed overlay proves nothing.** A dialog's or drawer's content mounts only while open,
  so a corpus render never checks it. Open each one through the document's own controls.
- **Realistic data finds format gaps a synthetic fixture never does.** Long names, negative,
  huge and missing numbers and empty lists each exercised a different branch (format
  `missing`, empty states, truncation). Writing whole products found the gaps worth
  reporting: no way to build a string from data (a `mailto:` link), `setState`'s shallow
  merge keeping a key a component's record value dropped, no responsive column span.
- **Layout that only works wide is a document bug.** A fixed `col-span-N` inside a grid
  that collapses to one column forces implicit columns at narrow widths; a sidebar beside
  content is an `Inline` that wraps, with a minimum width on the content.
- **A browser check waits on the page's one settled signal, never on a timeout**, and scopes
  every selector to the thing under test (a table by its caption, a dialog by its name).
  Probes that must see the first frame install before the page's scripts and switch
  themselves on by a key only the check sets, so they stay inert for every other check.
