# Testing

Tests run per package, through each package's `test` script. React components are tested with Vitest and Testing Library on jsdom, in colocated `*.test.tsx` files. CSS contracts (contrast, theme rules, the tw-merge mirror, token usage, utilities that exist) are check scripts, not unit tests; run them with `bun run check`. Each check script has its own test that proves it goes red on a fixture or a tampered copy (Vitest in r-ui-react-components, `node --test` in r-ui-css and r-ui-tw-merge).

Prefer integration tests over heavily mocked unit tests:

- Test real interactions between components, not isolated units with mocks.
- Mock only external dependencies, and only when you must, at the boundary.
- Test the integration points where bugs actually occur.
- Exercise the code paths users actually use, including the way callers spread props.

**IMPORTANT:** NEVER USE `... || true` IN ASSERTIONS. IT HIDES THE SIGNAL AND MAKES THE TEST REDUNDANT, AND I WILL FIGHT YOU IF YOU DO IT.

NEVER WRAP ASSERTIONS IN `if (isVisible)` OR SIMILAR GUARDS. It hides the signal and makes the test redundant, AND I WILL FIGHT YOU IF YOU DO IT.

Other ways a test passes for the wrong reason:

- **Never observed failing.** Red first: watch the check fail before the patch lands, and re-break the code once after it goes green.
- **Bare "was called".** Assert exact call counts; a handler that fires twice passes a bare spy check.
- **Both sides empty.** A comparison test needs its reference side asserted as non-trivial first.
- **A mock that removes an error.** If a mock's comment explains what it prevents, it is hiding a bug.
- **A frozen branch.** Don't stub `matchMedia` globally or hardcode it to one value, because that makes the other branch unreachable rather than green. Stub it per test.
- **Only one direction of a conflict fix.** Assert both: the component's value survives the caller's, and the caller's value survives where the component has no opinion.
- **A substring that matches the old name.** `toContain` cannot prove a class rename. Query by class selector instead.
- **A null result with no positive control.** "Nothing renders" is also what a broken selector produces. Make the harness show the thing once.

## What jsdom cannot see

Name the specific wall you hit; "jsdom limitations" is not a finding.

- **No top layer, `inert`, `::backdrop` or `showModal`.** A panel that is dead inside a modal `<dialog>` looks visible and clickable in jsdom.
- **No layout and no pointer geometry.** Sizes, alignment, hit areas and container queries can only be asserted as classes in jsdom.
- **No CSS.** Vitest's default `css: false` turns every CSS import into an empty string, so an assertion over a stylesheet asserts nothing. Put CSS invariants in a check script.

Rendering, geometry, hit-floor, density and theme-against-axis claims **are** settleable, in a real browser (`playwright-cli -h`). Before trusting a measurement, validate the harness by asserting one computed value you can predict from source.

## Theme fixtures

Never use an example theme's name in a fixture. Invent one (`aurora`).

The goal is to catch real bugs that affect users, not to reach a coverage number.
