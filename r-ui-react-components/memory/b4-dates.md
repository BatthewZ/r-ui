# Dates: lessons (2026-10-15, round 2, b4)

- **A calendar date is not an instant.** Values are `Date`s at local midnight, read only
  through local getters; the wire format is `YYYY-MM-DD` built from those getters.
  `toISOString()` moves a local midnight to the previous day west of Greenwich, and
  `new Date(y, m, d)` reads a year below 100 as 19yy (use `setFullYear`). A preset may
  still return instants ("Last 24 hours"); its id travels with the value so a dashboard can
  re-resolve it.
- **"Months side by side when the container is wide" cannot be a breakpoint.** A month is
  seven `--CONTROL-H` cells, so the width it needs moves with density and input; a
  `@container (width >= …)` threshold is a fixed length. The months are a
  `repeat(auto-fill, 7 × --CONTROL-H)` grid capped at `months` tracks, and the component
  reads the used track count (`getComputedStyle(...).gridTemplateColumns`) and renders that
  many months. jsdom returns the specified value, which falls back to all months.
- **An `auto` grid track grows to an item's min-content, and auto-fill's min-content is
  every track at its max size.** A calendar inside a plain `grid` (implicit `auto` column)
  forced it to all months side by side and spilled the popup at 375. The calendar root is
  `min-inline-size: 0`; layouts that hold one still give it `minmax(0, 1fr)`.
- **A shrink-to-fit popup cannot be a size container** (inline-size containment sizes it as
  if empty). The range popup gets a definite width from tokens (preset column +
  `months × 7 × --CONTROL-H`, capped at the viewport) so its content can query it.
- **Key paged views by position, not by content.** Months keyed by month number remounted
  the "next month" button on every press and dropped focus to `<body>`.
- **A control-produced error and a Field's single error slot collide.** `Field.Error`
  registers one id; a second registrant replaces it and unregistering clears the slot under
  the first. The pickers render their own message in the Field error's look and add its id
  to `aria-describedby` themselves.
- **Popover's initial focus runs after mount**, so a test (or a script) that focuses a day
  right after opening is overtaken by the move to the first tabbable. Wait for it first.
- **`Intl.DateTimeFormat#formatRange` pads its dash with thin spaces**; match ranges with
  `\s` in tests.
