# showcase pages — lessons

Learned building the Dashboard, Marketing and Stress pages, which compose the library the way
an app would. They are consumers: what they had to work around is a library finding first.

## An AppShell inside another page

- **The shell is a page frame, and it reads the VIEWPORT.** Nested inside the showcase's own
  sidebar and padding, it answered a viewport it only had a fraction of and showed two
  navigations at once. The Dashboard decided to give it the window instead: a fixed layer under
  the showcase's top bar that is its own scroller, with `--r-navigation-shell-viewport` set to
  that layer's height. The shell's sidebar links back to the other pages. A shell in a region
  narrower than the viewport still picks its form from the viewport, so give it the window.
- **One `<main>` per document.** The host page already owned the main landmark, so the
  embedded shell renders `AppShell.Main as="div"`; the skip link still targets it.

## Edge-to-edge bands inside a padded shell

- `Section variant="band"` assumes it spans the page edge to edge. Inside a shell that pads its
  `<main>`, the Marketing page cancels exactly that padding with negative margins on its root
  (`-mx-r2 md:-mx-r1 -my-r1`, mirroring the shell's own steps) so the bands run full width.
  The negative margins must track the host's padding tokens; there is no library primitive for
  "break out of my container", and none was added.
- The page root is the size container (`@container`), so every `cqi`-fluid token (display
  type, section rhythm, gutter) sizes to the page column, not the window.

## A library bug found by a page

- **Keep the repro live, contained and counted.** The Stress page's `KnownBug` box holds a
  minimal repro inside its own scroll box (so the page stays measurable) with a dashed error
  edge and a "Library bug (reported)" label. `stress-matrix.js` lists the ids in `KNOWN_BUGS`
  and asserts each still overflows; a fix turns the check red until the case moves out of the
  box into the normal panel, where the matrix's spill check guards it as a regression case.
  Four such cases (card actions, card description, list term, KPI value) went through that
  loop; the list is empty again.
- **A page's workaround names a missing API.** `stroke-fg-primary` on a total Sparkline became
  `series="total"`; `w-auto whitespace-normal` on pricing cells became `wrap`; a gate renamed
  around (`ERROR_CLASSES`) was a gate bug. Fix the library or the gate, then delete the
  workaround.
