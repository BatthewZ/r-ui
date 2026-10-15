# Memory index: @batthewz/r-ui-css

Durable lessons for anyone changing this package. Principles only: no tasks, no line numbers.

| Note | What it covers |
| --- | --- |
| [cascade.md](./cascade.md) | Where a custom property resolves, and the rules that follow: re-declaring derived tokens at density boundaries, aliases at the read, `rem` and `:root`, `@property`, preferences that must beat themes. |
| [tailwind.md](./tailwind.md) | Tailwind v4 behaviour this package depends on: namespace resets and what they also remove, which namespaces generate which utilities, the scanner's blind spot, `@scope` passing through. |
| [contrast.md](./contrast.md) | Measuring and tuning colour pairs: the maths, gamut, the accent and warning traps, dark themes, partial themes. |
| [examples.md](./examples.md) | Why example themes have no privileges and how the package keeps it that way mechanically. |
| [contract-questions.md](./contract-questions.md) | Tokens and utilities proposed for the contract, the three-criteria verdict on each, and why the rejected ones stay out. |
| [type-roles.md](./type-roles.md) | Putting a face on `text-*` sizes with same-name `@utility` companions, the sort order that lets explicit utilities win, optional roles at the read, where fonts load. |
| [forced-colors.md](./forced-colors.md) | What Chromium repaints, keeps and backplates under forced colors, and why meaning-bearing fills opt out and remap their ink. |
| [lines-and-layers.md](./lines-and-layers.md) | `--BORDER-WIDTH` through `--default-border-width`, whole-pixel borders, and the stacking scale as structure. |
| [c7-print.md](./c7-print.md) | Printing: why print must be `!important` and themes never, dropped backgrounds and fills that carry their own ink, transitions caught at their screen value, flat shadows, emulated print vs a real PDF, previewing the shipped print rules. |
