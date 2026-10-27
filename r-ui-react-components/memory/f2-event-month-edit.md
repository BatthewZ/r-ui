# EventCalendar month view: picking and moving (round f2)

- **Find the day under the pointer by the cells' boxes, not by hit testing.** A multi-day
  bar is a DOM child of its first day's cell, so `elementFromPoint(...).closest(cell)` over
  a bar names its first day, not the day under the pointer; the dragged chip itself is
  under the pointer too. Walking the cells' rects (inside one, else the nearest) is right
  over chips, past the grid's edges and in RTL, and jsdom can drive it with mocked rects.
- **A moved bar keeps the day it was pressed on under the pointer.** Record the press's
  offset in days from the event's first day when the drag starts, and land the first day
  that many days before the day under the pointer. Without it a long bar jumps so its
  first day meets the pointer.
- **A band that must sit under a row's content: a negative layer inside an isolated row.**
  A positioned draft paints over non-positioned content (day numbers, a focused cell's
  ring) however early it is in the DOM. With the week `isolation: isolate` and the band one
  layer below (`calc(var(--LAYER-RAISED) * -1)`), it paints above the week's background and
  under everything in it, without escaping the week.
- **A range over weeks reads as one when its bands open where it continues.** One band per
  week row, squared and without the inline border where the range goes on into the week
  before or after, as the multi-day bars do.
- **The engine's swallowed click outlives the drop by a tick.** In jsdom a test that drops
  without a following click leaves the window listener for the next test's first click;
  let a macrotask pass in `afterEach`. Tests share `window`.
- **Escape that has nothing to do is not the component's.** Clearing a picked range that is
  already `null` is deduplicated by the shell's controllable state, so a spy cannot see a
  second clear; what a user can observe is whether the Escape was taken (`defaultPrevented`)
  or left for an enclosing dialog. Prevent it only when something was dropped or cleared.
- **A focus hand-back the panel already does is a duplicate.** The day panel's focus
  manager returns focus to the grid's tab stop when it closes, so a "New event" that closes
  the panel needs no focus code of its own; an explicit refocus stayed green when removed.
