# SiteHeader and NavigationMenu (round four, e3a)

- **Site navigation is disclosure navigation, not a menu.** Every destination is a link, so
  the APG disclosure pattern applies: buttons with `aria-expanded`/`aria-controls`, the panel
  rendered right after its button so Tab walks into it, Escape back to the button, focus
  leaving the item closes it. `role="menu"` would promise arrow-only navigation and hide the
  links' nature. Arrow keys are a shortcut layered on top, never the only path.
- **A press on a hover-opened panel pins it; it does not toggle it shut.** The pointer rests
  on the button (the panel opens) and then the press lands: a plain toggle closes what the
  reader just watched open. user-event reproduces the race on its own (it hovers before it
  clicks), which is how the one-panel-at-a-time test caught it.
- **Pin on focus INTO the panel, not on focus in the item.** A mouse-down focuses the
  button before the click runs; pinning there turned every hover-then-click into a close.
- **Read "a panel is open" from the DOM when something else must hold for it.** A header
  that tracked its menu through `onOpenChange` missed a panel open from `defaultOpen` or a
  controlled `open` (neither calls the callback); `[data-nav-panel]:not([inert])` inside the
  header sees every cause.
- **A null `relatedTarget` on blur is not "focus left".** A press on unfocusable text inside a
  panel moves focus to `<body>`; closing on that would close the panel under the pointer.
  Close only when focus lands somewhere known outside the item; presses outside have their
  own listener.
- **Sticky sticks in the nearest scroll container, and `overflow-x: auto` makes one.** The
  showcase's demo frame scrolls sideways, so its computed `overflow-y` is `auto` too and a
  sticky header in it never sticks. Hide-on-scroll listens to that same ancestor (the one
  sticky uses); a demo that shows sticking gives the header a scroller of its own.
- **A transparent header overlaps by its own height, published as a variable.** It takes no
  room (a negative margin of `--r-marketing-site-header-h`) and the content under it clears
  that variable. The variable is declared on `:root` and re-declared at every density
  boundary, so it re-derives where a compact subtree reads it.
- **Contrast of a transparent bar is measured against what paints behind it, not its
  ancestors.** The hero under it is a sibling; walking the link's ancestors finds the
  scroller's canvas. Hit-test beneath the header for the backdrop, then stack the link's own
  backgrounds only up to the header.
- **A mega panel spans its anchor through the shared cap's lever.** `setPositionReference`
  lines it up under the bar and `--r-overlays-measure` (the bar's measured width) lets the
  surface cap allow that width while still keeping it off the viewport's edges.
- **A container fold near the demo's width is a flaky harness.** At 1280 the Overview's demo
  is about 907px against a 56rem (896px) fold; the checks run at 1440 so a scrollbar or a
  padding change cannot flip the form under them.
- **Row labels are class contexts for the raw-length gate.** "(22rem)" in a showcase label
  failed `verify:no-raw-tailwind`; name the token instead.
