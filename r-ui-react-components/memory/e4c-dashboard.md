# The Dashboard adopts round four (e4c)

Learned moving the Dashboard page onto FilterBar, Toolbar, the DataTable features, progress,
Banner, HoverCard and per-card ErrorBoundaries. The page is a consumer: its workarounds are
library findings first.

- **The URL is the view, and the default view is the empty URL.** Writing the default into the
  hash on load rewrites every link to the page. The URL helpers take `defaults`: a filter at
  its default is left out, a missing parameter reads as its default, and where "no filter"
  differs from the default (no time filter means all retained data, the default is seven
  days) the absence is written empty (`time=`).
- **`replaceState` does not tell the router.** The page's anchor prop goes stale the moment the
  page writes the hash, so "the anchor changed" cannot mean "adopt it". Keep the last string
  written (or read) and adopt an anchor only when it differs from that: a pasted link or back
  button, never the page's own echo.
- **A frozen clock is a `now`, not a set of presets.** The date pickers resolved presets
  against the device's clock, so with `max` at the data's "now" every preset was disabled. A
  specimen (or a replay) passes its instant as `now` to the FilterBar (and `DateRangePicker`)
  and the same to `searchParamsToFilters`; the presets stay ordinary functions of `now`.
- **Progress or measurement, by the question.** A rollout and an export are work toward done
  (ProgressBar segmented by canary stage, a ProgressRing in a compact row, a determinate bar
  with Cancel); an error budget is how much is left of something that moves both ways, so it
  stays a Meter even though it "burns down".
- **A toolbar beside a title.** The title is sized by its content and shrinks (truncates); the
  toolbar grows into the rest. An overflowing `Toolbar` now keeps its own floor (its pinned
  units and "More", measured), so a growing sibling can no longer squeeze it to zero.
- **A boundary per card keeps the card's place.** The fallback takes the card's id and grid
  placement, so the navigation still scrolls to it and the grid does not reflow; the view (the
  filters and environment) is the reset key, so changing what is shown retries a failed card.
- **A table with detail rows has two kinds of `tbody tr`.** Checks that measure or count rows
  select `tr[data-table-row]`; a context menu deciding what a right-click acts on finds the row's
  own marker (`[data-service]`) and lets detail rows keep the browser's menu.
- **One search, not two.** The header's search and the services search were the same filter;
  in the FilterBar it shows in the chips, the count and the URL. A header search box would be a
  second control on one value.
- **New table features cost the name column first.** Expand, select and actions columns in a
  card-wide table left the truncating columns no free width, and the Service name read
  "chec…". The row's name gets a width of its own, and the widest detail columns (an inline
  meter, a percentage the status already implies) take the lowest priority so they step out
  first.
