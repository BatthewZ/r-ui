# HoverCard and Splitter (round four, e2c)

- **A hover card is a disclosure that renders in place.** Rendered right after its trigger,
  its links are the next Tab stops, so keyboard users reach interactive content with no focus
  trap and no key of its own; opening never moves focus. It is a `role="group"` named by the
  trigger, not a dialog: nothing about it is modal and it never takes focus on open.
- **Touch gets a button, not a long press.** A long press on a link is the platform's link
  menu; taking it over breaks "open in new tab". A separate toggle (a disclosure button with
  `aria-expanded`) opens the card for touch and for anyone else.
- **Route a press through floating-ui with its event.** Calling `context.onOpenChange(open,
  clickEvent)` marks the card click-opened, so `useHover` leaves it open when the pointer
  leaves. A toggle outside the reference and the floating element must be excluded from
  `useDismiss`'s outside press, or the press closes the card and the click reopens it.
- **Pointer closes arrive with a reason.** `useHover` closes with `"hover"` or
  `"safe-polygon"`; ignoring those while focus is inside the card keeps it from vanishing
  under the keyboard. The rest close as usual.
- **Focus handed back before the close commits cannot reopen the card.** Focus moves to the
  trigger while the card is still shown, so the trigger's focus handler sees it open and
  stands down. A separate "returned focus" flag was a duplicate: breaking it stayed green.
- **jsdom parses `:focus-visible` but never matches it.** A component that opens on keyboard
  focus only is untestable there unless the test emulates the selector per test (focused =
  focus-visible), as the popover stubs emulate `showPopover`; a press not opening it is a
  browser check.
- **A card inside a table cell inherits the cell's text rules.** A truncating cell's
  `white-space: nowrap` and a numeric cell's end alignment reach a panel rendered in place;
  the panel resets both.
- **A `div` panel in place cannot live in a `<p>`.** React warns (a console error, which the
  browser matrices fail on). Running text that holds a trigger is a `div`; a smoke test that
  renders the demos with `console.error` spied catches it.
- **Panes share by flex-grow from a zero basis.** The separators keep their own thickness and
  the panes divide the rest, so "the space the panes divide" is simply the sum of the panes'
  boxes: no subtracting guessed separator widths.
- **Stored sizes are a preference; drawn sizes are fitted.** Bounds (shares or token
  lengths) are applied when drawing, never written back on a resize, so a splitter that was
  narrow for a moment gets its proportions back. A gesture starts from what is drawn and
  writes that.
- **Token bounds are measured, and re-measured where density can move them.** A transient
  probe inside the root resolves each length (removed at once: a hidden box still counts
  toward scrollable overflow). A ResizeObserver watches the root and the separators, whose
  thickness is a density token, and every gesture measures again at its start.
- **Commit at the end of a gesture, read in a later event.** Key up and pointer up see the
  committed sizes; a gesture that is one event (a double click) commits what it computed.
- **A utility's pseudo-element cannot be adjusted from a group stylesheet.** `hit-area`'s
  insets live in the utilities layer, which beats `layer(components)` at any specificity. A
  separator flush with the splitter's edge (the pane beyond it collapsed) would push its hit
  area out of the splitter and widen what scrolls around it, so the root clips instead,
  halving the hit area on that one side, and the focus ring is inset, which no clip cuts.
- **A gutter's hit area must not sit over a scrollbar.** Centred, it reached
  (`--HIT-MIN` − the gutter) / 2 into the pane before, whose scrollbar lies against the
  separator. `hit-area` goes on a gutter-sized part shifted (a relative offset, since the
  utility makes it `relative`) to hang over the pane after only, and back over the pane
  before when the pane after is collapsed (the separator on the end edge, where the root
  clips).
