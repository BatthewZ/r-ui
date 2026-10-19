# Sweeps, live Views, clocks and waits

Learned turning the browser checks' matrices into live-switch sweeps, their fixed waits
into clocks and conditions, and their copied geometry claims into two sweeps (October 2026).

- **A live View switch is cheap but not free on a big page.** Switching theme, density or
  input on the whole Overview re-renders and restyles every section: about 1.5–2 s, against
  4–5 s for a fresh load. On a section or a smaller page it is a few hundred milliseconds.
  The measuring itself is rarely the cost; the switch and its settle are.
- **Live switching cannot see a fault that only a mount shows.** A component that reads the
  View once, when it mounts, stays clean through every live switch. Keep fresh loads, few
  but chosen so each value of every axis mounts fresh in every run, and rotate which
  combinations they are between runs (with the seed printed, so a red run repeats).
- **A fake clock lives as long as its browser context.** Installing one on the session's page
  would leave every later check on fake timers and fake frames. Put timer-driven claims in
  a context of their own. A clock left flowing still runs frames and CSS in real time; moving
  it fires every due timer at once, which makes "nothing before the delay, something just
  after" exact instead of a race.
- **Some fixed waits are timers in disguise.** A wait that looks like "let the exit finish"
  can be the component's own window: a hover within the skip delay after a close opens at
  once, so waiting for animations only made the next hover-intent check fail. Before
  replacing a wait, find what in the component it was outlasting.
- **A condition wait keeps the bound the fixed wait set.** "Scrolled past 100px within
  700ms" becomes "return as soon as it has, at most 700ms", not "wait up to three seconds":
  the speed was part of the claim.
- **Reduced motion's collapsed durations can still read as running.** A 0.01ms transition
  may be pending two frames on. "Nothing is moving" means no animation of at least a
  millisecond, the same rule the exit helpers use.
- **A test's fill is not a user's typing.** Playwright's `fill` focuses, selects all and
  deletes in quick succession. A component that places the caret a frame after focus can
  collapse that selection between the steps; it should leave a selection someone else made
  after the focus.
- **A size floor needs a definition of the target.** Measure what a press can land on: the
  element, its own hit-area pseudo, its labels, a hit-area wrapper or part drawn for it, a
  text field's frame. A bare `tabindex` (a focusable time, a tab panel, a scroller) is a
  keyboard stop, not a target. A link inside running text is exempt, as WCAG's target size
  is. A `hit-area` that follows a `hit-area` sibling deliberately does not grow toward it,
  so in a row each owns one pitch, not a full box.
- **Measure the cheap thing first and batch the writes.** Most targets meet the floor with
  their own box; read pseudos only for the rest. Token probes appended one per control
  force a layout each on a large page; append them all, read them all, remove them all.
- **A ledger of known findings must name the shortfall.** Listing an under-sized component
  without its axis would also forgive the same component regressing on the other axis.
  Each entry must still be found, so a fix cannot leave a stale excuse behind.
- **A sweep should find the panel wherever it ended up.** Looking only inside the card made
  a portalled or un-promoted panel read as "nothing opened"; finding it in the card, else in
  the top layer anywhere, lets each claim (in place, top layer, density) fail by name.
- **One clipping card per floating component.** A shared card is as tall as all its
  triggers, so a small panel from its first row may never leave it. A card barely taller
  than its one trigger makes "reaches past the clip" a real test for every panel.
