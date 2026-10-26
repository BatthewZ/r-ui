# EventCalendar agenda (round F1)

- **The agenda is where the full detail lives.** Every other view shows a summary and puts
  the rest in the name; the agenda row shows it all (time, title, status glyph and word,
  category · location, description) and its name says it again with the day, so a row
  reached by Tab is complete without the list's label.
- **A multi-day event is listed on each of its days inside the period, with its whole
  range**, never a per-day slice: the middle day of a migration still reads
  "Oct 15, 11:00 PM – Oct 16, 2:30 AM". Days outside the period are not listed, so an
  event across the month boundary appears only on the month's own days.
- **Day order needs a case where it differs from start order.** Placed events are already
  sorted by start, and an all-day event starts at midnight, so a test whose all-day event
  begins the day it is listed passes with the day sort deleted. A timed event that began the
  day before (over midnight) next to an all-day one is the case that goes red.
- **Switch a row's layout with container variants on explicit grid positions.** A group
  stylesheet cannot write a container query against a token, so the narrow layout (time
  above the title, the stripe down both) and the wide one (time | stripe | body, the time
  column a token wide so every row aligns) are `col-start`/`row-span` utilities switched by
  `@md:`. The stylesheet keeps only what utilities cannot say.
- **A slot-less mark's fill is repainted away under forced colours.** The series fills opt
  out of repainting; the secondary-ink fill of an event with no slot does not. A transparent
  border on the mark is what forced colours draw instead.
- **A view that cannot see `loading` will say "nothing scheduled" while events load.** The
  empty state belongs to "loaded and empty" only; a view needs the loading flag to withhold
  it.
- **Paging by month steps from the clamped day.** 31 Jan back… forward lands on 28 Feb, and
  the next step is 28 Mar, not 31 Mar: the controlled date is what was clamped. Write
  paging tests as the sequence of reported dates.
- **`toHaveTextContent` normalises whitespace in the element, not in the expected string.**
  `Intl` ranges carry thin spaces, so compare `textContent` exactly or match with `\s`.
