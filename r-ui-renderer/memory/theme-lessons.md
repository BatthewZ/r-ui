# A document's theme: lessons

- **Read a role's colour through a probe.** A custom property's computed value is its
  text, unresolved; set an element's `color` to `var(--C-X)` and read that. Browsers
  serialise the result in the colour's own space (`rgb(…)`, `oklch(…)`, `color(srgb …)`),
  so the parser reads more spellings than a document may write.
- **A redeclared role escapes every `:root` rule that guards it.** Print, forced colours and
  more contrast replace the roles on `:root` with `!important`; inline roles on the view
  root are another element's declarations, and win for everything inside it. Mirror those
  rules on the declaring element (generated from the CSS package, never copied), or a dark
  document prints light text on white paper.
- **Derive the pair list from what the check measures, not from its constants.** The
  contrast check exports its pair rows but keeps its surface list private; running its own
  measurement over the default theme and reading the rows it returns yields exactly what it
  checks, the scheme row included.
- **A partial palette is judged against the host's roles, and only where it touches them.**
  The document's light text fails on the host's light surfaces; the host's own weak pair
  is the host's to fix and must not refuse a document that never touched it.
- **"Before paint" and "in no commit" are different claims, and a check sees only one of
  them.** A layout effect that commits a palette and reverts it in the same task paints
  nothing, and a `MutationObserver` callback (a microtask after that task) already sees the
  revert. To prove no commit ever carried it, record each mutation's `oldValue`; to prove no
  frame did, sample every animation frame. A check in a passive effect paints first, and
  only the frame sampler catches it.
- **jsdom computes `color: var(--x)` as the text `var(--x)`.** Measuring there fails every
  pair as unmeasurable. Detect it and judge what the document decides alone, as the
  validator does, so a host's jsdom tests neither see a false refusal nor skip a true one.
- **The issue channel's identity is code and path.** Several failing pairs at one role
  collapse to the first; group them into one issue per document location, each naming
  both roles and the ratio.
- **A floor written as `ratio < min` passes NaN.** An infinite channel (`1e400` as a hue)
  measures as NaN, and every comparison with NaN is false. Fail a ratio that is not finite as
  unmeasured.
- **A grammar's `\s` is JavaScript's whitespace, not CSS's.** It takes U+00A0 and U+2028; the
  browser then drops the role at computed-value time and the probe reads something else.
  Spell CSS whitespace out (`[ \t\n\r\f]`).
- **A verdict must agree with its report.** The issue channel delivers an issue once per
  view and never retracts it; a refusal that flipped back to applied when the host's theme
  changed back left a "refused" diagnostic beside a themed view. A refusal holds for the
  document; a new document is judged afresh.
