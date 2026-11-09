# Selector cost

A stylesheet in this package loads on every page of every consumer, so a selector's cost is paid everywhere, not only where it matches. `@scope` does not contain that cost: Chromium builds its invalidation sets as if the rule were unscoped.

- **A type selector before a sibling combinator whose subject matches any element is pathological.** `h2 + *`, `:is(h1, h2) + *` and `:is(h1, h2) + :not(h3)` make Chromium restyle a parent's whole subtree whenever any child is inserted or removed. On a large app surface (a canvas of thousands of elements with a hover popover) that is tens of milliseconds per insertion. A class, id or attribute on the left (`.bar + *`) narrows it and costs nothing measurable; so does a named subject (`* + :is(p, ul)`).
- **Naming the subject costs in proportion to how common it is.** A subject list that includes `div` stops the whole-subtree restyle but still costs several times more than one without it, because nearly every insertion is a `div`. Space the prose flow elements by name and let components carry their own spacing.
- **Measure, don't reason, about selector cost.** Chromium's invalidation rules are not documented well enough to predict: the `@scope` and `:not()` results above were both surprises. Trace with the `disabled-by-default-devtools.timeline.invalidationTracking` category, which names the selector behind each subtree invalidation, and compare `UpdateLayoutTree` element counts with the rule deleted from the CSSOM in the live page.
- The compile check refuses the pathological shape. Widen it only from a measurement.
