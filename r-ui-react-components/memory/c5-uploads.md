# Uploads and one-time codes: lessons (round 3, c5)

- **A segmented code is one field, not N.** Six inputs give six names, break
  `autocomplete="one-time-code"` (iOS fills one input) and make a screen reader read
  "edit, 1 of 6" six times. One real `<input>` lies transparent over boxes that only
  draw its value; the box under the caret carries the ring. Its text is invisible
  and does not line up with the boxes, so a press is mapped to the nearest box by
  geometry, and the input needs `forced-color-adjust: none` or forced colours paint
  its hidden text over the boxes.
- **Select the filled box, collapse on the empty one.** Typing then replaces a box
  natively, Backspace on the first empty box deletes the previous character, and
  no custom editing model is needed. Refuse a disallowed key at keydown: let it
  through and it replaces the selected digit before the change filter drops it.
- **A refused change still needs a re-render.** React restores a controlled input's
  text after `onChange` when the state did not move, which throws the caret to the
  end; forcing a render puts the restore before the layout effect that places it.
- **aria-labelledby joins with a space**, so "label" + ", 6 digits" reads
  "label , 6 digits". Keep the punctuation in the second part: a screen reader
  pauses on it, and the accessible-name tests must expect the space.
- **Async results must add to the latest value, not the rendered one.** Two uploads
  finishing in one tick each read the same render's value through the form binding
  and the second overwrote the first. Keep the value in a ref written at the moment
  of the change (the same goes for the pending list).
- **A status change that swaps buttons must keep focus in the row.** Cancel becomes
  Retry and Remove; the focused button is gone and focus falls to `<body>`. Remember
  that focus was inside and refocus the row's first button after the swap.
- **A refused pick must not stay in the file input.** With a native `name`, the
  input's `files` are what a form submits; reset them to the value (via
  `DataTransfer`) on every pick, not only when the value changes.
- **run-code has no `Buffer`.** `setInputFiles` wants one; take the class from a
  Playwright result that is one (`(await page.request.get(url)).body()`).
