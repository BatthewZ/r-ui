# Navigation: lessons (2026-10-15)

- **The AppShell is the one component that reads the viewport, and it reads the consumer's
  breakpoints.** Its stylesheet writes `@media (width >= --theme(--breakpoint-lg))`: Tailwind
  resolves the consumer's own breakpoint at build time, so a retuned breakpoint moves the shell
  with no raw length in the component (the raw-length gate scans media preludes too). The media
  blocks only move grid areas and pick the sidebar's form; no token is redeclared inside them.
- **Write the mode that needs the fewest conditions as the base.** The rail is reached three ways
  (medium viewport; wide + collapsed; phone without a BottomNav), the full sidebar and the bottom
  nav one way each. A media query cannot see an attribute, so "rail" as an override would be the
  same rules in three blocks. Rail is the base; full (`wide :not([data-collapsed])`) and bottom
  (`narrow :has(> .r-shell-bottomnav)`) override it. No JS mode detection, so no second copy of
  the breakpoints in TypeScript.
- **A rail label that must stay the link's name is clipped, never `visibility: hidden` or
  `display: none`.** `clip-path: inset(50%)` + `opacity: 0` keeps it in the accessibility tree;
  hover and `:focus-visible` lift the clip and it shows as a bubble beside the icon. That only
  works while the rail is not a scroll container (`overflow: visible`), or the bubble is clipped.
  Section titles CAN be `display: none` in the rail: `aria-labelledby` reads hidden elements.
- **Sticky, not fixed, for a bottom nav.** A sticky last grid row pins to the bottom of whatever
  scrolls the shell, needs no `padding-bottom` hack to keep the last content clear, and works
  inside an embedding scroller (`--r-shell-viewport`). Fixed would escape every demo frame.
- **A bolder current label overflows a narrow bottom-nav column.** "Overview" fit at medium and
  truncated at semibold in a 65px column. Weight changes are fine in a sidebar row (wrapping
  room), not in fixed-width tabs; ink and the marker carry "you are here" there.
- **A badge inside a link needs a real text space before it.** Accessible-name computation joins
  flex children without a separator ("Incidents4"); a `" "` text node between label and badge
  reads "Incidents 4" and renders nothing visible in a flex row.
- **Disabling the button that was just pressed drops focus to `<body>`.** Pagination's previous /
  next at an end hand focus to the opposite arrow inside the click handler, before the re-render
  disables them.
- **Class names are global across groups.** Primitives already owned `.r-hit`; a second
  `.r-hit` here would have been a silent rule merge. Every defined class is `r-<group>-…`
  now, and `verify:class-prefix` fails on anything else.
- **State as a `data-*` attribute plus an attribute selector** keeps a class list free of
  conditions. (It was first reached for to dodge a `verify:utilities-exist` false positive on
  `position === "end" && "…"`; the gate no longer follows comparisons, but the pattern stands.)
