# EventCalendar time grid: moving and resizing (round f2)

- **Step from the target, not from the event.** Keyboard moves compose (a day right, then a
  slot down, then the end longer). Placing the event at its current target (`placeEvents`'s
  rules applied to a range) and handing that to the shared move and resize helpers keeps one
  source of the editing math, instead of a second copy that adds offsets to ranges.
- **Hold a dragged block where it was pressed, in minutes from its real start.** The offset
  is measured from the event's start, which for a block that continues from the day before
  lies on another day (a negative minute on the pressed day); snapped down to whole slots it
  keeps the block from jumping, and a start that lands before midnight moves to the day
  before. Geometry (which day, which slot) comes from the laid-out columns and hour lines
  only; the arithmetic is pure and unit-tested.
- **One edit state for both inputs, mirrored in a ref.** The drag's window listeners and the
  key handlers run between renders, so they read a ref written in the same call as the state.
  Only the draft and the faded source render from it; the source never moves until the app
  re-renders it, so focus stays on the block during a keyboard grab.
- **Kind is a rule, not a gesture, for the keys.** A pointer drag knows whether it is a move
  or a resize from what was pressed. The keyboard can do both in one grab, so its kind is read
  off the target at the drop: a resize when only the end moved.
- **An event stays its kind.** A resize that would make a block a day long would turn it into
  an all-day bar on the app's next render; such targets are refused (the draft stays where it
  was), by pointer and by keys.
- **A grip is the floor deep, at most half the event.** At coarse input a block drawn one
  `--ROW-H` tall cannot hold a `--HIT-MIN` grip and a pressable body; half each keeps both.
  The percentage resolves against the event's padding box (the grip's containing block, and
  the event's overflow clip), so "two floors tall" means inside its edge.
- **A grip's press needs no stopPropagation.** The press engine takes one press at a time, so
  the body's handler, reached by bubbling after the grip's, is ignored.
- **Space on a button activates on keyup in some engines.** Preventing the keydown is what
  jsdom and user-event honour; the keyup is prevented too after a grab or a Space drop, and the
  browser check counts clicks on the block, since a unit test cannot see the difference.
- **A drag's release swallows the next click for a tick.** Synchronous unit tests that drag
  and then click in the next test see the click eaten; let a tick pass between them.
