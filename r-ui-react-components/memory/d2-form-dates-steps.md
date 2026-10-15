# Form, dates, steps: verification fixes (2026-10-16)

- **What the keyboard can reach must equal what is drawn.** A listbox that hides its
  options behind a load error still had them as `aria-activedescendant` targets and
  Enter commits. Empty the navigable list itself, not only the rendered body.
- **Descendant ids come from the item's key, never its position.** A filtered list
  renumbers; an id from the index points the cursor at a different option. Escape the
  key injectively into an IDREF (no whitespace, no collisions between escaped and
  literal text).
- **A container query can hide a focus target.** `.focus()` on a `display: none` node
  does nothing (jsdom happily focuses it, so tests pass): check that the target is
  rendered (`checkVisibility`) and give whatever the query hides a visible stand-in that
  reaches it (a folded chip row's "n selected" unfolds it). A `<style>` element in a test
  stands in for the query; jsdom's computed `display` honours it.
- **"Focus left for nowhere" and "the focused node unmounted" look the same at blur
  time** (both have a null `relatedTarget`). A refocus-after-status-change heuristic
  decides after the commit settles (a microtask): if focus is back inside, it was an
  unmount the layout effect repaired.
- **Side effects of opening or closing belong to the transition, not the handler.**
  With `open` controllable, a parent can open or close without calling ours; reset a
  draft on the observed change (render-time `seen !== open`), so both paths run it.
- **Widen a callback to the value's type** (`Date | null`) even when the component
  never sends the wider case today: one handler then serves the control and its
  siblings, and a later "clear" is not a break.
