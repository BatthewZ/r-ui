# Kanban on the shared press-to-drag hook (round f2)

- **One drag engine.** Threshold, long press, capture, edge scrolling, Escape, the swallowed
  click and the board-long `touchmove` listener live in the shared hook; a component that
  drags only turns pointer positions into a target and commits. Lifting it removed about
  150 net lines from the Kanban and no behaviour.
- **"The page" is what scrolls around the whole draggable area, found from its root.**
  Found from the pressed element instead, it was the area's own scroller (a card's list, a
  time grid), which then scrolled as if it were the page, twice per frame when it was also
  listed, while the real page never did. The hook now looks from its `rootRef` element. The
  Kanban takes the press on its scroller (delegated: the card is found from the event's
  target and travels in the payload), which also keeps pointer capture off the cards.
- **What the hook cannot know, the payload carries.** The card to copy for the preview and
  its grab offset come from the payload and `onStart`'s press origin, not from the element
  the hook captured.
- **Refuse in `onStart`, not only at the press.** A keyboard pick-up can begin while a mouse
  press waits under its threshold (the hook exposes no pending state); `onStart` refuses
  when a drag already exists, so the pointer never overwrites it.
- **Retargeting during edge scrolling is provable in jsdom** with fake timers (they drive
  `requestAnimationFrame`), an accessor for `scrollTop` and card boxes that read it.
