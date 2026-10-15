# Commands: CommandPalette, ContextMenu and the shared menu (2026-10-15, round 3, c1)

- **One menu, several openers.** DropdownMenu and ContextMenu share `menu-internals`
  (open state, the floating panel, keys, every item kind); a root only decides how it
  opens, what the panel is anchored to and where focus returns. A second menu-like
  surface adds a root and a trigger, never a copy of the panel.
- **A context menu anchors to a virtual point measured against its region.** The point is
  stored as an offset from the region and re-read on every position pass, with the region
  as `contextElement`, so `autoUpdate` follows the content on scroll and `hide()` hides the
  menu with it. A point fixed in viewport coordinates floats free of what was clicked.
- **No DOM reference on a context menu.** floating-ui's light dismiss treats a press on
  the reference as inside; a context menu must close on any press, including a left click
  in its own region, so only the position reference is set.
- **Chromium makes a contextmenu event from the keyboard, unless the keydown is
  prevented.** Shift+F10 and the Menu key fire `contextmenu` with `button: -1` (measured);
  the spec's tell is an empty `pointerType`. Handle the keydown (open at the focused
  element, prevent it) and treat a non-right-button mouse contextmenu as keyboard-made for
  engines that send it anyway (Windows sends the Menu key's on keyup).
- **A long press needs a slop, and its release's mouse events must be swallowed.** Cancel
  on movement past a few pixels (a scroll), on pointerup and pointercancel; after it opens,
  the finger's release sends a compat mousedown (which would focus the region and pull focus
  out of the menu) and a click on whatever is under it, so the region prevents that
  mousedown and eats that click in the capture phase. Android also fires `contextmenu`
  itself: ignore it once the press opened.
- **Nested regions: one mechanism, not two.** A handled open is default-prevented and every
  region ignores a prevented event, so only the innermost opens. A `stopPropagation` beside
  it was redundant (no test could fail on either alone) and hid the event from page
  listeners; it is gone, and the test fails when the one mechanism breaks.
- **The palette is its own group.** It needs overlays (Dialog) and form (Input) while form
  already needs overlays; living in overlays made a two-way group dependency. A component
  that needs two groups sits above both.
- **A palette's command runs after the dialog has closed.** `dialog.close()` restores focus
  to the opener; a command that moves focus itself (opens a dialog, focuses a field) must run
  after that, so the root queues it and runs it in a layout effect once `open` is false.
- **`showModal()` focuses the first focusable element, not React's `autoFocus`.** React
  polyfills `autoFocus` with a `focus()` during commit, while the `<dialog>` is still
  closed, so it does nothing. On a nested page the back button would come first; the field
  is refocused explicitly when pages change.
- **Loaded lists are cached by the loader's identity.** A loader written inline in a
  re-rendering command list is a new function each render and loads again; hoist it.
- **The highlighted option cannot carry a focus ring** (focus is in the field): the wash
  plus an accent bar marks it, and under forced colours the selection fill (the bar is
  then the same Highlight as the fill, so it is not the cue there).

Enforced by the vitest suites and `scripts/browser/commands-palette.js`,
`scripts/browser/overlays-context-menu.js`.
