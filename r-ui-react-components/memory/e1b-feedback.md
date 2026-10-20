# Feedback: progress, banners, error boundaries

- **Progress is not a measurement.** `ProgressBar` / `ProgressRing` are `progressbar`: work
  toward done, which only grows and finishes. `Meter` is `meter`: a value inside a range
  (CPU, quota) that moves both ways and is never done. Pick by the question the reader asks
  ("how long?" vs "how much?"), not by the look.
- **A percentage of unfinished work is floored, with an epsilon.** Rounding shows "100%"
  beside a bar that is not full; flooring a float shows 28% for 29 (0.29 × 100 is
  28.999…). Floor `share × 100 + 1e-9`. The visible value and `aria-valuetext` are built
  from one string, so they cannot disagree.
- **A loop may ride the duration tokens only if reduced motion stops it first.** The tokens
  collapse to 0.01ms there, which turns an infinite animation into a strobe; the sweep sets
  `animation: none` under the media query itself and becomes a still, striped (masked)
  fill.
- **An infinite loop animates `translate` (or `opacity`) only.** The sweep once animated
  `inset-inline-start`: layout and paint on the main thread every frame, for as long as
  anything loads. `translate` percentages are the element's own size, so size the travel in
  its widths, and mirror it with the contract's `--MOTION-INLINE-SIGN`. The browser check
  asserts the keyframes animate `translate` alone and the path in both directions.
- **A part that forced colours must restyle is painted by the group's CSS, not a utility.**
  The group sheet sits under `@layer utilities`, so a forced-colours rule cannot beat a
  `stroke-…` utility on the same element: the ring's track stroke lives in the stylesheet.
- **A remembered dismissal is an external store.** Read it with `useSyncExternalStore`
  (server snapshot "not dismissed", so hydration never mismatches; the `storage` event makes
  other tabs follow), and guard every call: reaching `localStorage` can itself throw.
- **`resetKeys` clear only an error that was already showing.** Keys that change in the
  very update that throws would reset at once, throw again and land on the same fallback:
  the DOM is identical either way, so the test counts `onReset` and `onError` calls.
- **A fallback that comes back after a failed retry is a new element.** The focused retry
  button unmounts with the old fallback; the boundary marks the retry and the next
  fallback focuses its own button on mount (through context, so a class component needs no
  ref into the fallback's DOM).
- **The raw-value gate reads words.** A showcase description saying "rounded down" failed
  `verify:no-raw-tailwind` as a bare `rounded`; prose in strings is scanned like classes.
- **`:dir()` does not survive the build.** Tailwind's Lightning CSS targets browsers older
  than `:dir()` and lowers it to a `:lang()` list of RTL languages, so it matches on `lang`,
  not on `dir`: a bare `dir="rtl"` container misses it, and an LTR island inside `lang="ar"`
  hits it. Flip by an inherited custom property set on `[dir]` (the contract's
  `--MOTION-INLINE-SIGN`), and check RTL under a `dir` with no RTL `lang`.
