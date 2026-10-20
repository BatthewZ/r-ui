# Form: lessons (2026-10-15)

- **Read-only on a native checkbox/radio: drop the change, never `preventDefault` the click.**
  React reports a checkbox's `onChange` from the same `click` dispatch and then restores the
  controlled `checked`; the browser's canceled-activation revert runs after that and toggles
  it back the wrong way (jsdom showed `checked` flipping to the opposite of both states).
  Guarding the setter in `onChange` and letting React restore is the whole fix.
- **A pseudo-element hit area must sit behind the control it surrounds.** An absolutely
  positioned `::before` paints above its in-flow sibling input, so a press on the box itself
  hit the `::before` (still toggled via the label, but the input never received the pointer
  and Playwright refused to click it). `isolation: isolate` on the wrapper plus `z-index: -1`
  on the `::before` keeps the extra area clickable and the control on top; the contract's
  `hit-area` utility now does exactly this.
- **Stacked hit areas steal presses.** On coarse input a 16px box grows a 44px hit box, but
  checkbox rows sat 24–28px apart, so a press low on one box toggled the next row (measured
  with `elementFromPoint`). A labelled row is its own target: padding it to `--HIT-MIN` tall
  puts rows a floor apart and the box needs no pseudo-element at all; only a label-less box
  keeps `hit-area`.
- **"Is the press on something interactive?" must be scoped to the component.** Input's frame
  focuses its field on a press of padding or a decorative adornment, skipping interactive
  targets via `closest("button, …, [tabindex]")`. In the showcase `<main tabindex="-1">` (a
  skip-link target) matched as an ancestor, so every press was skipped. Only count a match
  that `currentTarget.contains()`.
- **A component rule cannot recolour what a utility already coloured.** Group CSS is in
  `@layer components`, below utilities, so `.form-select:has(option[value=""]:checked)` lost
  to a `text-fg-primary` on the same element and the placeholder never read muted. Put the
  default colour in the component rule too, not a utility, when a state rule must override it.
- **A `<label for>` cannot name a group.** Field publishes its label's id; RadioGroup and
  SegmentedControl take it as `aria-labelledby`. The label's `for` is harmless there.
- **Native `<select>` starts on the first ENABLED option**, so a disabled placeholder option is
  skipped unless the value is explicitly `""`.
- **Horizontal fields align the label to the control by centring it in a control-height row;**
  a check row or radio list is one text line tall, so its first line needs
  `(--CONTROL-H − line-height) / 2` of top padding to meet the label.
- **The `Write`/editor path can turn ` `-style escapes into literal characters** in source;
  invisible NBSPs in a regex are unreviewable. Write such escapes through a script and grep
  `-P '[^\x00-\x7F]'` afterwards.
- **A colour set by a utility on the root outranks the component layer.** Rating's
  `text-rating` sits in the utilities layer, so a component rule recolouring the root
  (forced colours, disabled) loses to it. A state override targets the part that paints
  (the fill's `svg`), not the root.
