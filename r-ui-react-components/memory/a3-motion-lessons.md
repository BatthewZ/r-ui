# Motion, disclosure and overlay exits: lessons (2026-10-15, round 2)

- **An exit is CSS; script only waits for it.** A closed popover or dialog is
  `display: none`, so it vanishes unless `transition-behavior: allow-discrete` covers
  `display` (and `overlay`, which keeps it in the top layer). The component keeps the node
  mounted and unmounts when `getAnimations()` reports the exit finished. Read the list right
  after the change that starts the exit: `getAnimations()` flushes style, so the new
  transitions are already in it. No timers, so a theme's slower tokens need no matching
  number; an empty list (reduced motion's 0.01ms, an engine without `allow-discrete`, jsdom)
  closes at once, which is also the fallback.
- **`@starting-style` never fires for a floating panel.** floating-ui lays the panel out in
  place (it measures it) before `useFloating` adds `popover` and calls `showPopover()`, so the
  panel already has a style when it opens. Measured: no entrance at all. Key an entrance
  animation on `:popover-open` instead; it starts whenever its name first applies. A
  `<dialog>` goes from `display: none` to open, so a starting style works there.
- **Keep floating-ui's `open` true through the exit** (it keeps the panel promoted and
  positioned), and keep the component's own `open` for everything the user sees. Anything
  that reads floating-ui's `open` to decide a toggle (`useClick`) then closes instead of
  reopening when pressed mid-exit: toggle from your own state.
- **`FloatingFocusManager disabled={!open}` returns focus at once.** Its return-focus runs in
  a cleanup that also fires on disabling, so focus is home before the panel has faded. Make
  the leaving panel `inert`.
- **Movement in an entrance changes geometry for its duration.** A `scale` from 0.96 made
  menu items measure 0.96 × 44px in a check that measured straight after opening. Floating
  panels fade only: their box is final from the first frame, and so is where a press lands.
- **A programmatic `.click()` commits a frame or more later.** Browser checks count frames
  from the state flip (the panel leaving `:popover-open`, `aria-expanded` changing), and
  look for *some* frame between 0 and 1 rather than one fixed sample, which a slower theme
  would move. To photograph a 120ms exit, slow every animation with the DevTools protocol
  (`Animation.setPlaybackRate`) rather than editing tokens.
- **Height without measuring: a one-row grid from `0fr` to `1fr`.** The clip inside needs
  `min-block-size: 0`. `overflow: clip` with `overflow-clip-margin` (the focus ring's reach)
  keeps a flush control's ring whole. `visibility` transitions specially: hidden only at the
  end of a close and visible from the start of an open, so it hides collapsed content without
  cutting the animation; `inert` takes it out of the tab order and the accessibility tree
  (jsdom models neither, so tests assert the attribute and a browser check the effect).
- **A reveal must never be what makes content visible.** Render it shown (server, no script,
  no `IntersectionObserver`, reduced motion) and hide only what is out of view at mount, in a
  layout effect, so nothing on screen blinks out on hydration. An element-share threshold is
  unreachable for an element taller than the view divided by the threshold: also accept that
  share of the viewport, and ask the observer for steps so it re-measures as it scrolls.
- **Stagger by cloning, not wrapping.** Wrappers break `ul > li` and grid tracks. To stagger a
  component's grid (Grid renders its own element), wrap `Stagger as="ul"` in a small component
  and pass that as the Grid's `as`.
- **`useEffectEvent` needs React 19.2**; the peer range is 19.0, so latest-callback refs it is.
- **Do not name a generic `div`.** `aria-labelledby` on an accordion root without a role is
  prohibited; the topic heading before it already does the job.
- **A view transition's own styles must outlive `updateCallbackDone`.** The library hook
  settles once the update applied; a choreography keyed on a kind (a direction, a press
  point) needs its marker until `finished`, and a newer transition owns the marker after
  it. Give each demo's elements a `view-transition-name` only while its own kind runs,
  or one demo's elements are swept into (and animated by) another's transition.
- **Stopping the page's cross-fade needs `mix-blend-mode: normal`.** Old and new snapshots
  blend with `plus-lighter`; with their animations off, two opaque pages add up and wash
  out. And `:not()` cannot take a pseudo-element: `::view-transition-old(*):not(...)`
  is an invalid selector and the whole rule drops; reset the root by name instead.
- **Stage the fades of a roll or slide.** Old gone by halfway, new from halfway: a plain
  cross-fade shows both mid-flight. Inspect a transition by pausing its animations at a
  fraction and screenshotting, never by scrolling while it is paused (the snapshots are
  pinned to the viewport).
