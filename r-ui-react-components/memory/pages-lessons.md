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
- **A page of every section outgrew its use; page by the reader's unit.** One Overview of
  125 demos loaded every chunk and sent readers back to the top for its contents. Paged a
  group to a page, the index and sidebar come from the glob's paths alone (no section
  loads), a group's page loads only its own chunks, and `#/overview/<section id>` still
  lands on the section, so no deep link changed. The sweeps that measure every section
  together keep a hidden `#/all` route rather than walking every group page per view.
- **A first visit's Suspense fallback resets the scroll by itself.** A group page that
  "starts at the top" passed until a check revisited a loaded group: no fallback, no
  shrink, and the old scroll stayed. Scroll on purpose, and make the check visit the
  target first so the fallback cannot do the work.
- **A scroll spy needs two rules the observer cannot give.** `useActiveSection` marks the
  first section in a band under the header; at the page's end, short last sections never
  reach that band, so the last one on screen takes the mark there. And a long contents
  rail that scrolls must move itself (never the page) to keep the mark in view. A check
  proves each only where it can fail: a tall window so the last section sits below the
  band, a short one so the marked entry starts below the rail's fold.
- **A glide to a section must hold the spy.** A smooth scroll passes every section between,
  and the spy marked each in turn (eight flickers to one press). Pin the pressed section
  until `scrollend` (a timer where it is missing), glide only on a press within the page
  (a link opened from elsewhere jumps), and jump under reduced motion; read the motion
  preference through a ref, or a change to it scrolls the page again.
