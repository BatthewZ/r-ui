# Moving a browser check into a unit test

Learned taking keyboard, state and commit checks out of the browser into jsdom
(October 2026). The rule that made it safe: break the source once and watch the new home
go red before deleting the old check.

- **A green break is a finding. Find out which kind it is.** Sometimes the break was not a
  fault at all. Removing the tree's "focus the parent on retry" changed nothing, because
  its orphaned-focus fallback hands focus to the same row. Break both and the test goes
  red. Other times the test is too weak. A `*` test with no deeper branch on screen cannot
  tell siblings at this level from every expandable row. Strengthen the test in that case.
  Deleting the browser check on a green break skips both questions.
- **With two items, wrapping hides direction.** In a roving group of two with loop on,
  "next" and "previous" both land on the other item. A mirroring test written that way
  passes with the mirroring removed. Use three items for any claim about direction.
- **A MutationObserver in jsdom sees what a browser's would.** Observer callbacks run as
  microtasks after a commit in both. A one-commit flash that a passive effect later
  clears shows up only when that update is not flushed by a discrete event: React runs a
  click's effects before the browser paints, and a timer's after. Drive a commit-watching
  test through a timer as well as through clicks, or the flash never appears. A
  per-render test (`rerender` inside `act`) never sees such a flash.
- **jsdom reads `direction` from inline style only.** A `dir` attribute sets `direction`
  through the UA stylesheet, which jsdom does not have. Unit tests set
  `style={{ direction: "rtl" }}` to exercise `isRtl`. That the attribute reaches the
  computed direction, and the order things are drawn in, stay in a browser check.
- **What stays in the browser after a conversion** is real geometry and paint: how
  elements are drawn (a sticky band's edge, a form inline or stacked by its own width,
  RTL drawn order, a checked box's fill), windowed rows with real heights, and focus
  after a real press on a non-focusable part such as a chevron. Keys, states, ARIA and
  Tab order (`user.tab()` honours `tabIndex`) move to the unit test.
- **A group can lose its last component-tier script.** When that happens, give the group
  a reason in `verify-browser-tags`' `UNCHECKED_GROUPS` that names where its proof now
  lives.
  The gate fails an entry whose group has a component-tier script again, so the
  allowance cannot outlive its reason.

## What the gate after the conversions found

- **A script's header drifts from its body.** Read against their bodies, about sixty header
  claims across thirty scripts were asserted more weakly than written ("each" where one was
  measured, "the URL" where a link's text was read, "inside its box" where only the inline
  edges were) or not at all (a carousel "one per view at 375" that nothing opened). Treat a
  header as a claim list: each line has an assertion that goes red under a break, or the line
  says less.
- **A check of the first two items cannot see the rest.** The RTL toolbar check compared the
  first two controls, which share a group: reversing the order of every unit stayed green.
  An order claim walks every neighbour pair.
- **A readout matched by shape passes on a stale value.** A "saved sizes" readout checked
  against `Saved: 20 · \d+ · \d+` passed when the commit sent the sizes from before the drag.
  Compare a readout with the value the gesture produced.
- **A merge proves itself by its summary.** A merged script's `ok` line is the parts'
  lines joined; a difference is either a trimmed clause (named in the mapping) or a bug.
