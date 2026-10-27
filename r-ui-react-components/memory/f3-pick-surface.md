# A surface for a picked range (round f3)

- **Give the app an anchor, not a panel.** What follows a pick (a popover at it, a drawer, a
  dialog, an inline form) is the app's to choose. The calendar hands over the range, a
  virtual anchor where it is drawn and a `clear`, and renders whatever the app returns
  inside itself, so it takes the calendar's density. A popover that can sit beside an
  anchor that is not its trigger is the one piece the overlays group had to add.
- **A virtual anchor is measured when read, and scrolls with its context element.** Its
  box is the drawn piece's current box, so the panel follows the time grid's own scrolling
  once `contextElement` is that piece (floating-ui listens to the context element's
  scrolling ancestors). Without it the panel stayed put while the grid scrolled; the
  browser check moves the grid and measures the panel.
- **Watch what a child view draws when the parent does not render.** A view hides the
  picked range while a new pick is under way, re-rendering only itself; an effect in the
  calendar never ran. A `MutationObserver` filtered to the pieces' marker attribute, kept
  only while `renderSelection` is given, is the honest signal of "the range is on screen".
- **A side placement needs somewhere to go on a phone.** Beside a narrow pick at 375 neither
  side had room, flipping could not help, and `shift` moves a side-placed panel only along
  its side, so it hung past the viewport. Falling back to the perpendicular axis (below,
  then above) keeps every floating panel on screen.
- **A demo's own surface changes what other checks can press.** The panel opens on every
  pick and takes focus: a check that pressed an event right after a pick hit the panel
  instead, and one that counted "any dialog" counted it as the day panel. Pick where the
  panel cannot cover what comes next, and find each surface by its own class.
- **The same holds for an opened event, and its anchor is the element pressed.** An event is
  drawn in several places at once (a chip, a day panel's row, a block on each day it
  spans), so the anchor is the element that was activated, passed up with the event, and
  when that goes another drawing of the event that is actually drawn: a narrow month keeps
  its chips in the DOM undisplayed, and a 0 × 0 box at the page's corner is not a place.
- **Generic over the app's type, sound at one boundary.** The calendar keeps the app's
  objects untouched, so handing them back as the app's own type is one cast at the
  calendar's edge, not a type threaded through every view; a type-level test holds each
  callback's type.
- **A guarantee a browser cannot isolate belongs to the unit tests.** "Paging closes the
  details" stayed green in the browser with the rule removed: pressing the pager is a press
  outside the popover, which closes it anyway. The unit test, with a plain surface and no
  light dismiss, is where that rule can fail.
- **Delete is the app's, and so is when focus moves.** The calendar hands over the event and
  removes nothing; it remembers where the deleted event sat among those the keys reach and
  moves focus there only once the event has left `events` and focus fell to the page with it.
  An app that confirms first, or refuses, keeps focus where it was.
- **user-event never sends a held key's repeats as repeats.** `{Delete>2/}` fires two
  keydowns with `repeat: false`; a test of "not on a held key" sends `repeat: true` itself.
