# Lessons from the fix batch: one policy, one promise, docs that are gated

- **When the validator copies a renderer rule, check it against the renderer's code, not
  its intent.** The validator judged a `navigate` destination by scheme only, as a link's
  `href` is judged, while the renderer also checked it against the request policy and
  refused another origin. Both read "the URL rules", and the warning promised less than the
  renderer did. Read the branch that acts on the value and copy its conditions, then put
  one case of each condition into a test on each side.
- **What a document may reach is one object, passed everywhere unchanged.** Host decisions
  that lived on the view's props and adapters (an image predicate here, a Markdown
  allowlist there, a sensitive list elsewhere) drifted from what the validator, the
  handler and the CLI were told. One policy object, resolved with its defaults in one
  place and compared member by member, keeps the view and the validator agreeing, and
  leaves the adapters as effects only.
- **A shared helper is shared only once the local copy is gone.** Adding the helper to the
  shared module while a same-named copy stays in the renderer leaves two rules that pass the
  same tests today and diverge tomorrow. Delete the copy in the same change.
- **A docs test that only checks what the README says cannot see what it leaves out.** The
  README's blocks were run and its numbers measured, but nothing failed when an export went
  unmentioned or a removed one stayed named. A gate that lists every export of every
  subpath (types through the compiler, values from the loaded module) and demands each be
  named, or sit in a reasoned type-only allow-list that is itself checked for stale
  entries, turns "trim the surface to what is documented" into a fact.
- **A test that a casing rule holds must include the casing it rescues.** Every "keeps"
  case was lowercase, so removing the lowercasing kept the suite green. Pair every
  normalisation with an input only the normalisation lets through, and see it go red with
  the normalisation removed.
- **A host adapter receives what the renderer resolved.** Once `navigate` received an
  absolute URL rather than the document's string, the playground's hash router and the
  README's sample both had to take the part after the origin. When a contract's argument
  changes shape, find every adapter that consumes it, not only the call site.
- **A probe document needs a route as well as a check.** Control documents for the browser
  checks were written and their checks wired, but the playground's `?view=` resolved only
  the corpus, so the checks would have reported a route error instead of their claim.
  Resolve every name a check opens, with a test that each one does.
