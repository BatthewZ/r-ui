# Focus handoffs, derived tab stops, shared vocabularies

- **A focus handoff to a control the same action enables must wait for the commit.** Focusing
  an element that is still `disabled` (or still a hrefless `<a>`) does nothing, so "reach the
  end, focus the opposite arrow" silently fails whenever that arrow was itself disabled before
  the move: two pages, or link mode, where the owner commits the URL's page later. Record the
  intent with the target value, apply it in a layout effect once that value renders, and drop
  it if the owner moved somewhere else.
- **A roving tab stop derived from a value needs a fallback.** When the value names a
  disabled item, or none at all, no item holds `tabIndex=0` and the widget cannot be reached
  by Tab. Derive the fallback (first enabled item) after render, from the DOM the items
  actually produced.
- **Keyboard stepping during a smooth scroll must start from the target, not the measured
  position.** The measured slide lags until the scroll settles, so two quick presses land on
  the same slide. Keep the last chosen target until `scrollend`, or until the measurement
  agrees.
- **A key callback's `index` must be the source index.** Handing `getRowKey` the sorted
  position makes an index-keyed selection point at a different row after every sort.
- **"Rounds to zero" is decided on the printed value.** Compare the formatted delta with the
  formatted zero rather than the raw number: whatever the formatter, a change the reader sees
  as 0 gets no arrow, no hue and no verdict.
- **One vocabulary, one table.** Tone words, tone inks and tone backgrounds each live once in
  the shared tone module; components join tables rather than re-listing tones, and only a
  component-specific exception (a neutral title in primary ink) stays local.
- **Translatable strings come in one `labels` prop with exported defaults.** A map-valued
  label (the tone words) merges key by key, so a caller can override or silence one tone
  without restating the rest. A per-instance accessible name goes through the caller's own
  `aria-label`, which the component spreads after its default.
