# The first integration gate: lessons

- **A rule two halves enforce lives in one function both call.** The renderer and the
  validator had each grown their own ISO parser, prop-path walker, `srcset` splitter,
  `data-*` judgement, Intl check, `name` exemption and ref-typed-prop rule; each pair
  had drifted (a looser date parser in forms, a validator `srcset` split that ignored
  `data:` commas, a `RefObject` union split inside its generic). Put the rule in `spec/`
  (React-free, so the validator can call it) and delete the copies.
- **Derive what the declarations show; curate the rest behind a classifying gate.** A
  native `name` attribute is readable off the props type, so the deriver records it; a
  component's own `name` prop is not (a person, a glyph, a hidden input), so a curated
  table decides it and a test fails on any library `name` prop no table classifies.
- **Facts the format declares need a key-for-key gate against the library.** The column
  shape kept a key (`wrap`) the library never had, so every document that used it got a
  silent drop. Compare the format's keys, the keys the renderer reads and the library's
  keys as three sets.
- **Identity is part of a runtime's contract with a memoised renderer.** A hook that
  rebuilds equal records on every streamed chunk invalidates every memo below it; return
  the previous object while its entries are the same, per record, at the source rather
  than in a stabiliser downstream.
- **A form submit that cannot run its handler must not touch the store.** While the
  document streams, actions are inert; letting the library validate and count the
  submit leaves `submitCount` and errors claiming a submit that never happened.
- **An end-to-end document finds the seams unit tests share an assumption about.** One
  realistic dashboard validated, rendered, streamed byte by byte and submitted, with its
  breaks tried one by one (a default flipped, a remount key, a dropped error mapping, a
  memo ignoring its context), each turning it red.
