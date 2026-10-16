# PasswordInput, MaskedInput, CurrencyInput, AvatarUpload, AvatarGroup (round four, e2d)

- **Read a masked edit from the two texts and the caret, never from a remembered selection.**
  The text after the caret is the unchanged tail, so the edited range of the old text ends
  that far from its end; it starts where the texts first differ, no later than the caret.
  A selection remembered on keydown/select was stale under user-event's paste (and mobile
  keyboards and IMEs report it no better), and turned a paste into a one-character delete.
  Where the reading is ambiguous (a "5" typed beside a "5"), every reading gives one value.
- **A deletion of literals alone deletes the slot beside them**, by the input event's
  `inputType` (Backward/Forward). Delete leaves the caret where it was; every other edit puts
  it on the next slot to fill, so typing steps past the literals.
- **jsdom keeps a selection across an input's `type` swap; some browsers do not.** A test of
  "show password keeps the caret" passes with the restore removed unless the harness models
  the reset: patch the instance's `type` setter (React writes the property, not the
  attribute) to throw the caret to the end, and assert the patch saw the swap.
- **A toggle keeps its name; `aria-pressed` carries the state.** "Hide password, pressed"
  reads as a contradiction (APG). The icon changes, the name does not.
- **Avatar refuses `blob:` sources, rightly, for a caller's URL.** Object URLs a control
  mints itself (a picked file, a crop) render in its own `<img>`; a caller's URL goes
  through Avatar (and `safeUrl`). A data URL of a bitmap passes, so a demo server can
  return one.
- **A nested, unnamed `Field` isolates an inner control.** The crop's zoom `Slider` would
  otherwise take the outer Field's id and label (and collide with the Choose button). It is
  also how the zoom gets a visible label.
- **A group rule cannot size a part a utility already sized.** Avatar is `size-control`;
  `.r-form-…{ inline-size }` loses in `@layer components`. The group rule sets a custom
  property and the part takes `size-(--r-form-avatar-size)`, which `cn` merges over.
- **Number fields share one draft model** (`number-draft`): a draft while focused, committed
  on blur or Enter, unreadable text reverts, empty is `null`. NumberInput and CurrencyInput
  both run on it with `parseLocaleNumber`; money has no steppers and is a textbox, not a
  spinbutton. Minor units round after the currency's precision (`0.29 × 100` is 28.999…).
- **Primitives cannot open a popup** (overlays sits above them). AvatarGroup's "+n" is a
  plain count spoken with the names, and `renderOverflow` hands a caller the chip's classes
  to build a Popover trigger of their own.
- **A gate's false positive is fixed in the gate, never by bending data.** A password word
  list holding "shadow" failed `verify:no-raw-tailwind` as a bare utility, and the word was
  dropped to pass, weakening the estimator. The gate now judges a bare word as a class only
  in a class context, and the word is back.
