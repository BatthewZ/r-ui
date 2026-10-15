# Overlays: lessons (2026-10-15)

- **In place + top layer is what makes density reach a floating panel.** A menu written
  inside `[data-density="compact"]` reads the compact `--ROW-H` because it is a DOM
  descendant; the top layer is what lets it escape that card's `overflow: hidden`. Measured
  in a browser: items 30px inside the compact card vs 40px at the page, menu box extending
  past the card's bottom edge, and `elementFromPoint` landing on the last item. In jsdom the
  provable half is inheritance: jsdom inherits custom properties (`getPropertyValue("--ROW-H")`
  at the item follows a fixture stylesheet) but never resolves `var()` inside a used value,
  so assert the custom property, not `minHeight`. The test goes red when the panel is
  portalled; keep it that way.
- **Escape belongs to the innermost surface, and `preventDefault()` is the handshake.**
  Handle Escape on the element (not with a `document` listener) and `preventDefault()` it;
  an outer surface ignores a prevented Escape. In Chromium the same `preventDefault()` on
  the keydown stops an enclosing modal `<dialog>` from firing `cancel`, so a menu or tooltip
  inside a dialog closes alone (measured). `composeEventHandlers` already skips the
  component half when the caller prevented, so a check inside the handler is redundant
  there; a re-break test must defeat both.
- **A trigger that closes its panel on Escape must only do so while open.** Otherwise a
  closed trigger swallows the Escape meant for the dialog around it.
- **Tab out of a menu: refocus the trigger and let the browser move on.** Chromium moves
  from the element focused at the time the default action runs, so closing + refocusing
  the trigger in keydown lands Tab on the next control (measured). user-event computes
  Tab from the original target instead, so that half is a browser check, not a jsdom one.
- **`showPopover` absent is the shipped fallback, and jsdom is that engine.** jsdom also
  hides any `[popover]` (it never matches `:popover-open`), so stub `showPopover` per test
  and query promoted panels with `{ hidden: true }` or by selector. Add the `popover`
  attribute from script only when the API exists (the toast region does), or the panel is
  invisible on engines without it.
- **Scroll lock can be CSS: `:root:has(.overlays-modal:modal) { overflow: hidden }`.** No
  counting for stacked modals, nothing to restore. Do not add `scrollbar-gutter: stable`:
  the scrim and an edge drawer are fixed boxes, so the kept gutter shows as an unscrimmed
  strip down the side.
- **`Object.assign` on a shared root function shares the statics.** Dialog and Drawer each
  need their own root component before assigning `.Content`, or one overwrites the other.
- **A focus ring inside a scroll container is clipped on every side.** The dialog Body
  carries `p-r5` cancelled by `-m-r5`, so an input's offset ring survives at the top too.
- **Fixed top-layer panels follow their anchor on scroll, and `shift()` pins them to the
  viewport edge once the anchor leaves.** `useFloating` runs `hide()` last and marks the panel
  `data-reference-hidden`; CSS hides it (still mounted, so state and focus bookkeeping
  survive) and it returns anchored. In jsdom every rect is 0×0 at the origin, which `hide()`
  reads as hidden, so the hiding is CSS (absent in jsdom) rather than an inline style that
  would hide every panel from Testing Library.
- **A toast raised while a modal dialog is open is inert** (visible, not clickable, not
  announced): everything outside the modal is, top layer or not. Re-promoting the region
  on arrival fixes paint order only.
