# Charts (batch B, b1)

How `LineChart`, `BarChart` and `Heatmap` were built, and what to keep when changing them.

- **Two halves: arithmetic and drawing.** Everything a chart decides (the model, scales,
  nice ticks, time ticks, label thinning, bar geometry, heat bins, the table) is pure and
  lives in `chart-model.ts`, `chart-scale.ts` and `chart-plan.ts`; the components only map a
  plan to SVG and wire the pointer and keys. That is what lets the hostile-input cases and
  the caps be unit-tested without a layout engine. Keep new logic on the pure side.
- **Draw at the real size, not in a stretched viewBox.** A ResizeObserver on the plot (sized
  by `h-chart`) and on a hidden probe (`h-bar rounded-sm`) gives the box, `--BAR-THICK` and
  `--RADIUS-SM` in px, so a density switch, a theme's own `--CHART-H` or a container change
  redraws, and strokes, text and hit areas are never scaled. Reading a domain token through
  a probe works whatever unit it was declared in. Without ResizeObserver (server, jsdom) the
  plan uses a fixed fallback box.
- **Label widths come from a canvas in the browser and an estimate elsewhere.** The planner
  takes a `measure` function; the estimate (0.62 em a character) is deliberately generous so
  it never under-spaces. A late web font changes widths and no size, so the box re-measures
  on `document.fonts` `loadingdone`.
- **Thinning is fit-checked after clamping.** Edge labels are pulled inside the plot, which
  closes the last gap; a stride that fits on paper can still collide. Every candidate set is
  placed and checked, and a stride that divides the count (every 6th of 24 hours) wins over
  a slightly denser one, because it reads as a rhythm.
- **Time ticks are calendar-aligned, not evenly spaced in ms.** A ladder (1/5/15/30 s and
  min, 1/3/6/12 h, 1/2 days, weeks from Monday, 1/3/6 months, then 1/2/5×10ⁿ years), each
  rung dividing the next unit; the finest rung whose labels fit wins. Labels are two-level:
  a sub-day tick on midnight names the day, a month tick in January names the year. Local
  time by default (`timeZone="UTC"` for tests and servers). A bar chart's time axis is a
  band axis: only bands that start a boundary are labelled.
- **Hostile input: slice before reading, halve before dividing.** Every collection is cut to
  its cap before a value is read (bounded work), `1e308 - -1e308` is Infinity so spans are
  halved, compact notation runs out at 1e15 ("1000T") so the axis goes scientific, a
  caller's `format` is guarded (throws or returns nonsense, the default is used), duplicate
  names are numbered (a table with two identical headers is ambiguous). A hostile-data
  section and a test over every plan's numbers (path strings included) keep it honest.
- **Colour follows the entity.** `slot` pins a series' colour and shape; unpinned series take
  the free slots. A dashboard filter that drops three regions must not repaint the fourth.
  Past eight series nothing cycles: the rest are tabulated and a visible note says so.
- **The table is the accessible rendering, always built.** Visually hidden beside a drawing,
  in its place when nothing can be drawn and on "Show as table". The SVG and the legend are
  `aria-hidden`; the figure is named by `label` and described by a summary. The tooltip is
  `aria-hidden` too; a polite status speaks the same row, only for the keyboard and a tap,
  never a passing pointer.
- **The readout cursor is one hook.** `usePlotCursor` owns what every chart
  shares: hover follows the pointer, a tap inspects and a press outside clears it, keys
  move it, Escape clears it, keyboard focus starts it. A chart supplies only what differs:
  `pick` (the row or cell under the pointer), `keyTarget` and `start`. Line and bar reach it
  through `useAxisCursor`, Heatmap through its grid cursor. Heatmap once carried its own copy
  of the handlers; a new chart or gesture goes through the hook, so a touch or Escape fix
  lands in every chart at once.
- **Forced colours.** Series groups and keys opt out (`forced-color-adjust: none`), so the
  data keeps its colour and every series still has its own shape; gridlines and axes are
  strokes in tokens that become system colours; the tooltip is the contract's `bg-fg-primary`
  bubble, and series keys inside it sit on a surface chip (the inks are validated against
  surfaces, not the inverse fill). A component rule loses to a utility on the same element
  (layers), so a cursor outline on a heat cell is an `outline`, which no utility there sets.
- **A browser check that counts elements can pass on a broken chart.** The Dashboard check
  first counted heat cells and stayed green when a day of data was cut (missing cells are
  still cells); it now counts painted ones. Count what a reader sees, then break it.
- **A measuring hook watches an element, not a ref object.** The plot unmounts while its
  table shows, and that state lives in a child, so the chart that owns the hook never
  re-renders: an effect keyed on stable ref objects kept observing the removed plot
  (0 × 0) and drew nothing on the way back. Callback refs that set state make every new
  element a new subscription.
