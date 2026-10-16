# Locale provider, an invisible input's selection, scroll panels

- **A registry that components join beats a list that imports them.** The provider's
  `labels` type has to know every component's label set, but `util` may import no group
  (`verify:group-deps` counts type-only imports too). Each component adds its key to
  `LabelsRegistry` by declaration merging next to its `DEFAULT_X_LABELS`, so util never
  names a component and a new component touches no shared file. The emitted `.d.ts` keeps
  the `declare module` block, so consumers see the full map.
- **Precedence and nesting are tested through real components, not the merge function.**
  Swapping provider and instance order, or replacing instead of merging an inner provider's
  set, must turn the tests red; both were broken once on purpose. The type contract lives
  in `@ts-expect-error` lines that `tsc` checks: loosening `LocaleLabels` to a record
  makes every one of them an "unused directive" error.
- **One label key per shared set.** Components that share words (the charts, the
  preference controls) share one key; a set that extends another (`DatePickerLabels`
  extends `CalendarLabels`) is read under its own key only, because the picker passes its
  merged labels down and an instance's labels beat the provider's.
- **A transparent input over painted boxes still paints its selection.** `color:
  transparent` and `-webkit-text-fill-color: transparent` do not reach `::selection`; the
  contract's global `::selection` sets `color`, so a selected character showed through
  (the masked OTP's extra dot). An input kept live but invisible makes its `::selection`
  transparent too, and hides autofill paint. jsdom loads no CSS: the proof is a browser
  screenshot of the row compared with the same row at input opacity 0 (focus and
  selection survive opacity, not `visibility: hidden`), with an inked-text positive control.
- **Sticky inside a boxed scroller puts the scrollbar beside the footer.** A bounded box
  with actions scrolls a body and keeps the actions outside the scroller
  (`ScrollPanel`); sticky is for the page's own scroll and a table's head. In the Overview
  every demo frame is a scroll container (`overflow-x: auto`), so a sticky element inside a
  demo never engages: a sticky claim there is about computed style, not geometry.
