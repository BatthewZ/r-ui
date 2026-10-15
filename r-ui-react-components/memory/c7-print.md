# Print adaptations

- **Adapt by what components already render.** `src/print.css` reaches components through
  their group classes (inside `:is()`, so the class-prefix gate sees references, not
  definitions) and their data attributes. When a component gains a print need that no class
  or attribute exposes, give it a `data-print` value from the CSS package rather than a new
  selector trick here.
- **Every scroller is a print question.** A fixed or capped scroll area prints one window of
  its content. Library scrollers are released in print.css; a page's own window (a fixed
  frame, a demo scroll box) carries `data-print="flow"`.
- **Virtualised content cannot print whole.** Spacer rows would print as blank pages; the
  table prints its mounted rows and says so.
- **Truncation needs a way to the full value, and paper has no tooltip.** Table cells wrap
  in print; a table wider than paper even when wrapped is the one honest loss.
- **Prove the dark theme prints light on the painted result**: text contrast against the
  fill that actually prints (exact fills) or paper, not against the token pair.
