# Timeline: lessons (2026-10-15, round 3, c3)

- **An event time is an instant, except a bare `YYYY-MM-DD`.** The Timeline reads that one as
  a local calendar date (`setFullYear`, local getters), keeps `datetime="YYYY-MM-DD"` and counts
  it in calendar days ("yesterday", never "21 hours ago"). Everything else is an instant whose
  `datetime` is `toISOString()`, which is correct for an instant and wrong for a date. Days for
  grouping are local days from local getters. The time tests set `process.env.TZ` to a zone
  west of Greenwich at module top, before any local `Date` is built; set in `beforeAll` it
  comes too late for module-level fixtures.
- **A connector drawn as a background vanishes under forced colours.** The line is a real
  element in the rail's flex column with a `border-inline-start`, so it is painted in a system
  colour, follows RTL with the inline-start track, and needs no offset arithmetic against the
  mark. A stateless dot is a border too, for the same reason; a toned disc carries a
  transparent border so forced colours draw its edge.
- **A decorative mark is sized from `--ICON` and the `r` scale, never `--CONTROL-H`.** The hit
  floor raises `--CONTROL-H` on coarse input; a mark is not a target and should not grow there.
  The body's first line is offset by half of (mark − title line height), both density tokens,
  so the mark centres on the title at either density.
- **`overflow: auto` makes a scroll container even when nothing overflows**, which captures
  every sticky descendant. A component that may or may not be its own scroller makes it an
  opt-in (`scrollable`), and then also a named, focusable region.
- **A sticky header needs an opaque band**; the Timeline's day header is `bg-surface-0` (the
  card surface), overridable through `classNames.day` when it sits on another surface.
- **"Show more" that reveals the last page removes itself**, dropping focus to `<body>`. Move
  focus to the first new event (made focusable with `tabIndex=-1` only while it is the target),
  and only when focus was in the timeline or lost, so a remote load that lands later does not
  steal focus from somewhere else.
- **A browser check on the Overview sees every section's console errors.** Scope a component
  check's error capture to its own component; `overview-matrix` owns the rest.
