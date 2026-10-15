# Line weight and stacking

- **`--default-border-width` drives the bare border family.** In Tailwind v4 it feeds `border`,
  every `border-*` side and `divide-x`/`divide-y`; numeric widths (`border-2`) ignore it. Mapping
  it to `--BORDER-WIDTH` is the whole mechanism.
- **Border widths are whole CSS pixels in Chromium**, at any device pixel ratio: 1.5px computes
  and lays out as 1px even at DPR 2. Document and use 1px or 2px.
- **Line weight never moves control heights**: preflight's `box-sizing: border-box` keeps
  `h-control` and `h-row` exact; measured at 2px.
- **Stacking tokens are structure.** The theme-rule check forbids them in themes, the same way
  axis-derived tokens are forbidden: a brand has no business reordering sticky chrome.
- **Overlays need no z-index.** The top layer (`<dialog>`, `popover`) sits above every in-flow
  layer; the scale exists only for sticky and fixed chrome.
- **Why the layer scale is contract, not component config**: standalone-meaningful (any page
  with a sticky header and a skip link needs the order), cross-cutting (tables, shells, nav and
  skip links all read it) and domain-neutral (names say where a thing sits, not what it is).
