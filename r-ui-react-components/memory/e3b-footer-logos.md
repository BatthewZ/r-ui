# Footer, LogoCloud marquee, the Carousel's scrollbar

- **Two forms in the markup, the container query picks one.** The Footer's columns are
  plain headed lists when the footer is wide and disclosures when it is narrow; both the
  heading text and the toggle button are rendered and `@max-md:` utilities show one. No
  measuring, no flash on load. The `nav` is named by `aria-labelledby` on the plain title,
  which still names it while `display: none` (a referenced node counts even when hidden),
  so the landmark keeps its name in both forms. jsdom shows both: unit tests assert the
  classes and ARIA, the browser check asserts which one is displayed.
- **A slot that wraps each element child counts elements, not what they render.** A demo
  component returning an array of links is ONE element to `elementChildren`, so every link
  landed in one list item. Pass arrays (or fragments, which are flattened) to such slots.
- **A marquee is a transform loop, not a scroller.** Two loops of the set, each loop at
  least the viewport wide, translated by -50% of the track; the copies are `aria-hidden`
  and `inert`. The viewport is `overflow: clip`, so there is no scrollbar and no scroll
  position to drift.
- **With no scroller, the browser cannot bring a focused child into view.** Keyboard
  focus on a logo link holds the row (`:focus-within`) and winds the CSS animation's
  `currentTime` until the logo is inside the content box. Only for `:focus-visible`: a
  pointer press focuses on mousedown, and moving the link then loses the click.
- **Never `pause()` / `play()` a CSS animation from script.** Either call detaches it from
  `animation-play-state` for good, so hover, focus and the toggle would stop working.
  Setting `currentTime` alone leaves the CSS in charge.
- **Hold on the content, not on the whole component.** A hover pause on the root also
  held the row while the pointer was on the toggle, so pressing "play" looked broken; the
  hover and focus holds are scoped to the logos' viewport.
- **A utility on a caller's element beats a group rule.** The demo's `block` on a logo
  link silently overrode the rule that makes linked logos a hit floor tall
  (`layer(components)` is under `utilities`). A rule a caller's element must keep is one
  the demo does not fight.
- **Headless Chromium hides every scrollbar,** so "the track reserves no gutter" passes
  with or without `scrollbar-width: none`. The check asserts the computed property, with a
  positive control (the demo frame, a content scroller, keeps its bar), and proves the
  track is still a scroller by wheel, shift-wheel and a CDP touch swipe.
