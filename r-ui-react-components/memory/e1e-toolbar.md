# Toolbar and ToggleGroup (batch E1)

- **A roving tab stop over children a caller writes reads the DOM, not a registry.** A
  toolbar holds Buttons, Selects, Inputs and menu triggers that know nothing of it, so
  `useRovingFocusWithin` finds its items by query, leaves out what is not an item (a popup
  opened from one, anything inert or hidden), and writes the stop as the `tabindex`
  attribute (a button's default 0 is otherwise indistinguishable from "managed"). A
  MutationObserver keeps the stop right when a child disables an item without the owner
  rendering.
- **`inert` is not everywhere, and jsdom ignores it.** Focusable elements inside an inert
  or hidden subtree of the group get `tabindex="-1"` too; they rejoin the walk when shown.
  Unit tests assert the `inert` attribute, not the accessibility tree jsdom cannot prune.
- **Keys a control owns stay with it.** A text input keeps its caret: the group's arrows
  act only once the caret sits at the edge the arrow points past (no selection), and Home
  and End never leave it. A select keeps the keys that step it. A key a part already
  handled (`defaultPrevented`, a menu button opening on ArrowDown) is not the group's, and
  neither is any key from a popup inside the group's element.
- **A part rendered twice is two instances.** The overflow menu renders a moved unit a
  second time in its menu form; an uncontrolled ToggleGroup would keep two values. Its
  uncontrolled value lives with the toolbar, keyed by the unit's React key, and only the
  bar rendering emits side outputs (the hidden inputs a form submits).
- **A portal cannot host menu items.** React's synthetic events follow the React tree, so a
  menu item portalled from a part never reaches the menu's own key handler. Render the
  part's menu form inside the menu instead, and share state as above.
- **Measure what you hide.** A moved unit stays laid out (absolute, `max-content`,
  `visibility: hidden`, inert) so the toolbar can tell when it fits again. A hidden box
  still counts toward scrollable overflow, so it hangs from the inline end (overflow
  toward the start is unreachable) with its paint contained (its controls' coarse hit
  areas too). And the toolbar
  must take its width from its container: a content-sized toolbar shrinks as it hides
  units, re-measures smaller and collapses to "More".
- **The contract's hit-area sibling rule is for rows with no gap.** It stops a later hit
  area growing back over its neighbour, which also leaves that control short of the floor.
  Where a row guarantees a gap of `--HIT-MIN` minus the control's size, nothing can overlap,
  so the toolbar lifts the rule with a more specific utility (a group stylesheet cannot: it
  sits in a lower layer than any utility).
- **A line drawn with `bg-border` vanishes under forced colours** (the background is
  repainted). A separator is a border.
