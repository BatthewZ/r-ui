# Times of day: lessons (2026-10-16, round four, e1c)

- **A time of day is wall-clock text, a date-time is a local instant.** A `TimeField`
  value is `HH:mm` (24-hour, no date, no zone), like `<input type="time">`. A
  `DateRangePicker withTime` end is a `Date` at a local wall-clock time, so it is also a
  real instant and durations from it are elapsed time. DST is decided, not left to
  chance: a skipped time moves forward by the gap (what `setHours` does), a repeated one
  is the earlier instant, and the date-time wire carries the UTC offset so the two
  01:30s of a fall-back night stay distinct. There is no `timeZone` prop; another zone is
  the caller's conversion at the edges.
- **Segments are the source of what shows; the value follows them.** Re-seed the
  segments only when the value moves from outside (parent, form, reset). Record the value
  the field itself just sent, or its own `null` for a half-typed time wipes the half it
  typed. A controlled parent that refuses a change still snaps the segments back.
- **A segmented field commits per keystroke, so a refused time is `null`, not the old
  value.** A text date field keeps a refused draft beside the old value until blur; a
  segment field has no draft, and keeping the old value would submit a time the field no
  longer shows. Out of range and incomplete both send `null` and say why.
- **Editable segments for touch keyboards, every edit intercepted.** `contentEditable`
  with `inputMode="numeric"` opens the number pad; hardware keys arrive as `keydown`, a
  virtual keyboard's as `beforeinput` (keydown says "Unidentified"). Prevent both, so
  the DOM text is only ever what React rendered. IME composition is not cancelable: a
  composing keyboard is the known gap.
- **ICU varies by version.** The space before AM/PM is a space or a narrow no-break space
  depending on the ICU build; match `\s` in tests. `hour: "numeric"` with an explicit
  `h23` drops the leading zero in some locales ("0:00" in de-DE); a 24-hour list uses
  `"2-digit"` so it reads as its field does.
- **Digit typeahead over times is ambiguous by prefix.** "13" prefixes both 1:30 and
  13:00 as text. Read the digits as an hour first, then an hour and the start of its
  minutes.
- **No numeric z-index means no pseudo-element fill under text.** A focused segment's
  band is a gradient background image sized to the text line; under forced colours an
  image is dropped, so the rule opts out (`forced-color-adjust: none`) and paints the
  band in `Highlight`.
- **Centring a list in a promoted panel on open is one pass.** A layout effect that sets
  the list's `scrollTop` already lands in Chromium after the top-layer promotion; a second
  pass on the next frame was added blind and proved redundant at the gate (either alone
  passed the browser check, neither failed it), so it went. Option `offsetTop` is only
  the list's own when the list is the options' offset parent (`position: relative`).
- **A set that extends another hides the base key from its parts.** A `TimePicker` passes
  its merged labels to its `TimeField`, so a provider's `TimeField` labels do not reach a
  picker's field; translate it under `TimePicker`.
- **Time-zone tests can set `process.env.TZ` per file** (Vitest's forked workers pick it
  up at once). Prove it took (a known offset) before trusting the assertions, and restore
  by deleting the key: assigning `undefined` sets the zone to the string "undefined".
