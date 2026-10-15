# Form state: lessons (round 2, b5)

- **A context cannot push props into a component that does not read it.** "Every control
  binds through `Field name`" needed each control to consume the binding: value-based
  controls swap `useControllableState` for `useFieldValue` (same contract plus the form,
  and the native `name` as a third item), native text controls spread
  `useFieldInputProps(props)`. A control whose caller passes `value` is left alone, name
  included, so a composite that controls its inner `Input` (a date picker with its own
  hidden input) never gets a duplicate native `name`.
- **One id per message slot clobbers.** Field kept one error id, so a second `Field.Error`
  (a control's own "not a date" beside the form's message) overwrote the first and
  unmounting one cleared both. Descriptions and errors are lists now; a control that
  renders its own message registers it with `useFieldMessage`, and the `aria-describedby`
  union is de-duplicated because such a control must also name it itself to work outside
  a Field.
- **Describe in the same commit the error appears.** Focus after a failed submit runs in an
  effect; a `Field.Error` registers its id in an effect too, so the control could be
  focused one render before it is described. A bare `Field.Error` in a bound Field
  registers as an "outlet" on mount, and the Field counts it the moment the form has a
  message. Microtask ordering hides the gap today; the test focuses from an effect of the
  very commit to prove it.
- **An aborted check must settle for whoever waits on it.** A validator that ignores its
  `AbortSignal` never resolves; a submit awaiting it (or a reset/unmount meanwhile) hung.
  Each pending check races an abort promise, and `reset` bumps a generation that a
  running submit checks before going on to `onSubmit`.
- **Standard Schema takes no signal**, so a stale async schema run is dropped by run
  number, not aborted. Field checks get a real `AbortSignal`, run only once the schema
  accepts the field, and are not re-asked for an unchanged value.
- **Errors keyed by index must follow rows by key.** Moving a row remaps schema, check and
  server errors, touched and "checked once" flags through the stable keys; in-flight checks
  under the array are aborted (their path changed meaning).
- **"First invalid" is DOM order**, not registration order: a field mounted later can sit
  higher. Sort with `compareDocumentPosition`, scroll to centre (sticky chrome) and focus
  with `preventScroll`.
- **Sticky sticks to the nearest scroller.** An ancestor with `overflow-x: auto` (the
  showcase's demo frame) is one, so a sticky `FormActions` there never sticks to the page.
  Measure it in a box that scrolls; consumers must not wrap long forms in an overflow box.
