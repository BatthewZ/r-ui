# Tailwind v4 behaviour this package depends on

- **`--namespace-*: initial` removes more than the scale you meant.** Clearing `--ease-*` also
  drops `--default-transition-timing-function`, which `transition` utilities read; the package
  redefines the `--default-*` keys it needs after the reset. The reset must load before every
  other `@theme` block or it clears them too.
- **The reset is the enforcement.** With the palette, type, radius, shadow, weight, leading,
  tracking and easing scales cleared, `bg-blue-500` or `text-sm` generate nothing at all. A
  silent no-op is a debugging trap, so the compile check asserts both directions: every
  `@theme` name yields its utility, and the replaced defaults yield nothing.
- **Namespaces decide what a token generates.** `--spacing-*` feeds padding, margin, gap,
  inset, width, height and size; `--transition-duration-*` feeds `duration-*`; `--ease-*` feeds
  `ease-*`; `--container-*` feeds `max-w-*`. A token in no namespace generates nothing,
  whatever its name suggests. Verify in compiled output, never from a doc's utility list.
- **`--text-*` sub-keys** (`--line-height`, `--letter-spacing`, `--font-weight`) make one
  `text-*` utility carry a whole type role, and `leading-*` / `font-*` utilities still override.
- **`font-*` is shared by families and weights.** Family names (`ui`, `mono`, `display`) and
  weight names (`normal`, `medium`, `semibold`) must never collide. Weight names stay the
  familiar ones so a reflexive `font-normal` is not a silent no-op.
- **The scanner only sees literal class names.** Classes assembled in script
  (`bg-status-${s}`) generate nothing unless listed with `@source inline(...)`; brace expansion
  works there.
- **`@scope` passes through the CLI unchanged**, which is what lets a prose region stop at a
  `.not-prose` boundary without specificity games.
