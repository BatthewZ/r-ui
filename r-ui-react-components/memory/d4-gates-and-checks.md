# Gates, browser checks and hooks: lessons from the verification batch

## Gates

- **Assert the line, not the token.** A gate's test that only checks `toContain("`p-4`")`
  cannot see a misreported line. `verify:no-css-imports` reported every import after the
  first one line early: its pattern begins at the newline before `import`, so the match
  index sat on the previous line. Every finding in a gate's test is matched as
  `<file>:<line>  <problem>`, and the total count is asserted so nothing extra slips in.
- **A multi-line declaration is one finding on one line.** Collapse its whitespace before
  printing it, or the report's one-finding-per-line shape breaks.
- **An allowance is one exact declaration in one file, with its reason.** Never a unit, a
  file or a directory: a near-copy beside it must still go red, and the fixture proves it.
- **Widening a unit list is widening a vocabulary.** `em`, `ch`, `lh`, viewport and
  container units are sizes too; only the lengths that name a unit (`1em`, `1lh`, `1ch`,
  either sign, `1px`, `100dvh`) pass. `_` is a space inside an arbitrary value, so a
  length after it (`p-[0_12px]`) must be read with the `_` turned back into a space.
- **A gate that ships to consumers imports nothing but Node.** `glob` is a devDependency;
  `readdirSync(dir, { recursive: true })` does the same job. Resolve a sibling package the
  way Node does (walk up the `node_modules` directories), since an app hoists it beside
  this one and a workspace links it inside.
- **Vacuity is a failure.** A gate that scanned zero files, found zero themes or read zero
  names says so and exits 1; each has a fixture that proves it.

## Browser checks

- **Pick a subject by what it is.** "A dark theme" is the first listed theme whose
  `--SCHEME-DARK` is 1; "a theme with web faces" is one whose `--FONT-UI` or display face
  is a family the app declares with `@font-face`. The showcase publishes its theme list on
  `<html data-showcase-themes>`, so no check names an example theme. Read schemes before
  emulating forced colours, which repoint `--SCHEME-DARK`.
- **Reset in the harness, not in each script.** A script that throws halfway skips its own
  cleanup; the runner's `finally` restores storage, emulation, viewport and the page for
  every script, and reports the script's own error over a reset error.
- **`Math.min(...[])` is `Infinity`, `[].every()` is `true`.** Both pass any floor. Count
  the list first, then take its minimum.
- **A positive control per absence.** "This selector has no box in print" proves nothing
  if the selector matches nothing on screen either; count it on screen first.

## Hooks

- **A hook with no consumer is deleted, not demoed.** Its docblock had named consumers
  that never used it. If a two-beat panel swap comes back, the lessons it carried: hold
  the swap in ONE state atom written through functional updaters (two atoms tear when
  React replays and discards a render), end an exit by naming the value to settle on
  (outside render, `prev` is the committed base, so a relative updater bails out), and
  treat "no `getAnimations`" as "wait for `animationend`", never as "nothing animates".
- **A geometry default is a raw value.** An observer's margin that encodes a header's
  height belongs to the caller; the hook's default names no length.
