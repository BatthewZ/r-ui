# memory — what this package has learned

Short, dated entries an agent should know before changing things here. Each entry: what
happened, what it means, where it is enforced. Newest first. Lessons inherited from the
previous generation are summarised where they still apply.

## Inherited (still true)

1. **A stylesheet imported from JS escapes `@layer components`** and beats `className`.
   Only `src/styles.css` decides layering. Enforced: `verify:no-css-imports`.
2. **An alias declared on `:root` is substituted once and inherits as a fixed value**, so a
   subtree cannot move it. Blend/derive at the read (`@theme inline` values, use-site
   fallbacks), or re-declare at every boundary that must re-derive (`[data-density]`).
3. **Popover `auto` closes a nested panel on the click that opened it.** Floating panels use
   `popover="manual"`; dismissal belongs to `useDismiss`.
4. **The UA `[popover]` box leaks** (`overflow: auto`, `color: CanvasText`, `inset: 0`).
   `src/floating.css` takes it back off.
5. **A gate that measured nothing must fail.** Every gate here fails on zero inputs
   (zero pairs, zero themes, zero `@theme` names).
6. **jsdom has no layout, no CSS, and (today) no popover API.** Size, colour and paint are
   Playwright questions against the showcase.

## Group lessons

One file per component group, written as each group was built, plus one for the showcase
pages. Read the group's file before changing its components.

| File | Covers |
|---|---|
| [primitives-lessons.md](./primitives-lessons.md) | Looping animations under reduced motion, fills without an on-ink, hover by ink-at-alpha, the hit-area inset maths, boxed vs chrome-less controls, accessible names with new-tab hints, card headers that wrap by content (not a grid), control sides that follow the hit floor |
| [form-lessons.md](./form-lessons.md) | Read-only native checks, hit areas behind the control and stacked rows, scoping "is this interactive?", component rules vs utilities, labelling groups, native select quirks, horizontal-field alignment, state overrides against a root utility |
| [overlays-lessons.md](./overlays-lessons.md) | In place + top layer and density, Escape ownership, Tab out of menus, the popover API in jsdom, CSS scroll lock, shared statics, clipped focus rings, hiding anchored panels, toasts under a modal, a hit area that scrolls its modal sideways |
| [data-lessons.md](./data-lessons.md) | Auto vs fixed table layout, dropped columns, virtualizing on `--ROW-H` and re-measuring through a probe, clamping the window, unbroken words in every text slot, wrapping cells, on-ink for domain fills |
| [navigation-lessons.md](./navigation-lessons.md) | The AppShell as the one viewport reader, rail as the base mode, clipped rail labels, sticky bottom nav, badge spacing in names, focus after disabling, global class names, a rail that scrolls with fixed label bubbles, publishing a measured inset for fixed content |
| [layout-lessons.md](./layout-lessons.md) | Page width and column floors as contract tokens, Grid's container wrapper, content-box caps, UI inside prose, a `ch` measure set where the body size is |
| [pages-lessons.md](./pages-lessons.md) | The showcase pages as consumers: an AppShell given the window, one `<main>`, edge-to-edge bands inside a padded shell, the known-bug box and its regression loop, workarounds that name a missing API, paging the Overview by group, a Suspense fallback that scrolls by accident |
| [a2-preferences-router.md](./a2-preferences-router.md) | Preferences, the router config and the showcase shell: one serialised implementation for the pre-paint script and the hooks, client-created scripts never run, `<html>` as the store, memoising array options, scoping `isCurrent`, checks that find the wrong AppShell, shrinkable grid tracks |
| [a3-motion-lessons.md](./a3-motion-lessons.md) | Motion, disclosure and overlay exits: exits in CSS with script only waiting, `@starting-style` vs promoted panels, floating-ui's `open` through an exit, focus return, fade-only panels, counting frames in checks, `0fr`→`1fr` height, reveals that never hide what is on screen, staggering by cloning, view-transition choreographies kept until `finished`, plus-lighter and staged fades, non-inheriting pointer properties |
| [b1-charts.md](./b1-charts.md) | Charts: pure planning vs drawing, drawing at the real size through probes, measured label thinning, calendar-aligned time ticks, hostile input, colour pinned to the entity, the table as the accessible rendering, the readout cursor as one hook, forced colours for data |
| [b2-content-lessons.md](./b2-content-lessons.md) | CodeBlock, CopyButton, Markdown: what a dynamic import keeps in its chunk, flat highlighter runs, code colour under forced colours, UI islands in prose, nesting caps as width caps, re-announcing a repeated status, the copy fallback inside a modal, fuzzing a refactored parser against the old one, pinning both sides of a cap |
| [b3-selection-lessons.md](./b3-selection-lessons.md) | Combobox, MultiSelect, TagInput: memoised merged refs, container variants need literal sizes, diacritic-folded highlighting, virtualising an `aria-activedescendant` list, focus that never leaves the input, the APG Escape order, `required` without a visible value, chip-row pitch |
| [b4-dates.md](./b4-dates.md) | Calendar dates vs instants, months by used grid tracks (not a breakpoint), `auto` tracks and auto-fill min-content, shrink-to-fit popups vs size containment, keying paged views by position, a control's own error beside the Field's |
| [b5-form-state.md](./b5-form-state.md) | Form state: controls consume the binding, message slots as lists, describing in the commit the error appears, aborted checks that settle, stale schema runs, keyed array errors, DOM-order first invalid, sticky inside a scroller |
| [b6-forced-colors.md](./b6-forced-colors.md) | Forced colours across the existing components: computed styles are the forced values, gradients drop too, line roles used as fills, kept fills that lose their text, focus on a Highlight fill, the second cue for invalid |
| [c1-commands.md](./c1-commands.md) | CommandPalette and ContextMenu: one shared menu, a virtual anchor that follows its region, keyboard-made contextmenu events, long-press slop and swallowed release events, nested regions, running a command after the dialog closes, cached loaders |
| [c2-steps.md](./c2-steps.md) | Stepper and Wizard: validating a subset of the form, the lost click under a blur-time error, unmounted steps, focus on arrival, counting steps in a container query, states by edge under forced colours, horizontal labels under the marker with lines marker to marker, `break-words` in a grid track |
| [c3-timeline.md](./c3-timeline.md) | Timeline: instants vs calendar dates, connectors as borders, marks sized from `--ICON`, opt-in scrollers, opaque sticky bands, focus after "Show more", scoping a check's error capture |
| [c4-marketing.md](./c4-marketing.md) | Hero, MediaCard, Carousel: `overflow-wrap: anywhere` in content-sized tracks, `cqi` moving with a new container, stretched links and paint order, carousel geometry in reading order, peeking only when there is more, silent broken images, decorative layers that clip without scrolling |
| [c5-uploads.md](./c5-uploads.md) | FileUpload and OTPInput: one field under N boxes, selection as the editing model, refused changes, async results onto the latest value, focus across swapped buttons, file inputs that submit |
| [c6-colour.md](./c6-colour.md) | ColorPicker: editing in OKLCH inside sRGB, rounding chroma down, trusting the last edit, spectra as data, out-of-gamut pixels, hit areas on absolute thumbs, resolving a theme colour at render |
| [c7-print.md](./c7-print.md) | Printing components: adapting by rendered classes and attributes, every scroller is a print question, virtualised content, truncation without a tooltip, proving contrast on the painted result |
| [d1-overlay-focus-and-names.md](./d1-overlay-focus-and-names.md) | `autoFocus` inside a dialog opened from an effect, refs a child cannot read yet, a caller's id on a labelling part, document-level Escape for hover tooltips, moving focus before a node leaves, key-derived ids, links that never nest, the `100vw` scrollbar trap |
| [d2-form-dates-steps.md](./d2-form-dates-steps.md) | Keyboard reach equals what is drawn, key-derived descendant ids, focus targets a container query hides, null `relatedTarget` ambiguity, open/close side effects on the transition, widening callbacks to the value's type |
| [d3-focus-handoff-and-shared-vocab.md](./d3-focus-handoff-and-shared-vocab.md) | Focus handoffs that wait for the commit, derived roving tab stops with a fallback, stepping from the target during smooth scroll, source indexes in key callbacks, "rounds to zero" on the printed value, one tone vocabulary, one `labels` prop |
| [d4-gates-and-checks.md](./d4-gates-and-checks.md) | Gates that assert the line, exact allowances, widening unit lists, Node-only shipped gates, vacuity as failure; browser checks that pick themes by property, reset in the harness, count before `min`/`every`, positive controls; deleting a hook with no consumer |
| [e0-locale-otp-panels.md](./e0-locale-otp-panels.md) | The labels/locale provider: a registry components join by declaration merging, precedence tested through real components, one key per shared set; an invisible input's selection still paints; sticky inside a boxed scroller vs `ScrollPanel` |
| [e1a-sliders.md](./e1a-sliders.md) | Slider, RangeSlider, Rating: one frame for N thumbs, a commit measured against the gesture's start, stacked thumbs by slop, the active pointer in a ref, centring a label in both directions, hidden overlay parts, a rating as one slider |
| [e1b-feedback.md](./e1b-feedback.md) | ProgressBar/Ring, Banner, ErrorBoundary: progress vs measurement, flooring with an epsilon, loops under reduced motion, loops on `translate` alone, `:dir()` lowered to `:lang()` by the build, forced-colours parts in the group sheet, a remembered dismissal as an external store, `resetKeys`, focus after a failed retry |
| [e1c-time.md](./e1c-time.md) | TimeField, TimePicker, date-times: wall-clock vs instants and DST, segments as the source of what shows, refused times as `null`, editable segments for touch keyboards, ICU drift, typeahead by prefix, a band under forced colours, centring a promoted list |
| [e1d-datatable-features.md](./e1d-datatable-features.md) | DataTable features and the Timeline thread: washes on pinned cells, sticky vs `relative`, forced colours and transparent borders, a sticky layer order, controls in auto-layout cells, live regions mounted early, measured lengths into CSS, what a virtual window holds, measuring a thread from the drawn mark |
| [e1e-toolbar.md](./e1e-toolbar.md) | Toolbar and ToggleGroup: roving over children a caller writes, `inert` gaps, keys a control owns, a part rendered twice, menu items and portals, measuring what you hide, lifting the hit-area sibling rule |
| [e2a-filters.md](./e2a-filters.md) | FilterBar: controlled from the first render, "not applied" as an absent key, focus on the drawn form of a folded bar, a count shown at once and spoken when settled, one value shape bridging to DataTable, units once in a range, a borrowed look that became `Chip`, a field's look by a prop on the control |
| [e2b-tree-guards.md](./e2b-tree-guards.md) | TreeView and RequireAuth: one flat row list windowed or not, where focus is really lost, tri-state by inheritance, links and row actions inside a tree item, what a tree owns, gates that fail closed, narrow lint globals |
| [e2c-hovercard-splitter.md](./e2c-hovercard-splitter.md) | HoverCard and Splitter: a hover card as an in-place disclosure, touch toggles, floating-ui close reasons, `:focus-visible` in jsdom, cell text rules leaking into panels, flex shares from a zero basis, stored vs drawn sizes, re-measured token bounds, a gutter's hit area off the scrollbar |
| [e2d-form-inputs.md](./e2d-form-inputs.md) | Password, masked, currency and avatar inputs: reading a masked edit from texts and caret, literal deletions, selection across a type swap, toggles that keep their name, `blob:` sources, nested Fields, sizing a part a utility sized, the shared number draft, gate false positives fixed in the gate |
| [e2e-kanban.md](./e2e-kanban.md) | Kanban: one target for two inputs, a card that stays until it lands, a measured drop line, press-vs-drag thresholds, touch hold vs scroll, snap against edge scrolling, scrollers clipping both axes, `Omit` over a union name |
| [e3a-site-header.md](./e3a-site-header.md) | SiteHeader and NavigationMenu: disclosure navigation (never a menu), a press that pins a hover-opened panel, "a panel is open" read from the DOM, null `relatedTarget`, sticky in the nearest scroller, a published bar height, contrast against what paints behind, mega panels through the surface cap, a link icon on its label's first line |
| [e3b-footer-logos.md](./e3b-footer-logos.md) | Footer, LogoCloud, the Carousel's scrollbar: two forms picked by a container query, slots that count elements, a marquee as a transform loop, bringing focus into view without a scroller, never `pause()` a CSS animation, scoping holds, headless scrollbars |
| [e3c-pricing-testimonial.md](./e3c-pricing-testimonial.md) | Pricing, PricingTable, Testimonial: rows shared by subgrid, speaking a change where it is observed, list formatting by locale, sticky head vs sticky column stacking, a scroller as every sticky's frame, press-to-explain on a tooltip, `<cite>` as the work, the language's quotation marks |
| [e3d-features-cta.md](./e3d-features-cta.md) | FeatureGrid, FeatureRows, HowItWorks, CallToAction, EmailCapture: one numeric toggle for two layouts, borrowing a look means borrowing what sizes it, server errors and retry, failures through the form, a success status mounted early, stretched links on borderless items |
| [e3e-media.md](./e3e-media.md) | Image, Lightbox, MasonryGrid: sizes as unitless custom properties, a `<span>` root, already-loaded pictures, a placeholder under the fade, `preload()` memory, `asChild` links, focus home after a dialog, masonry by the grid's own tracks, print fallback |
| [e4a-motion-extras.md](./e4a-motion-extras.md) | Parallax, CountUp, ReadingProgress, Spotlight: a view-timeline subject that never moves, strength as a multiple of a contract distance, decorative by construction, a wash as the box's own background, timing read from tokens, a figure that speaks once, view timelines and the nearest scroller, proving a theme lever and its collapse |
| [e4b-marketing-page.md](./e4b-marketing-page.md) | The Marketing page from the library: a header under a host's sticky bar, scroll padding for every bar, a transparent header's hero padding, motion layers hold only decoration, pictures in prose, pinned-column surfaces, one locale switch, promoting a repeated heading group |
| [e4c-dashboard.md](./e4c-dashboard.md) | The Dashboard on round four: the URL as the view with defaults left out, adopting an anchor only when it changed, a frozen clock as `now`, progress vs measurement, a toolbar beside a title, a boundary per card, two kinds of table rows, what new table columns cost |
| [t1-browser-harness.md](./t1-browser-harness.md) | The browser-check harness: the whole-Overview load as the cost, sections opened alone, the View switched live, hash-only navigations keep the document, patches on a long-lived page, inserted code in page-side callbacks, session memory growth, parallel sessions, `use()` under jsdom; the slack a light page removes, frame-timed readouts, equal widths on both routes |
| [t3-sweeps-and-waits.md](./t3-sweeps-and-waits.md) | Live View switches vs fresh loads (mount-only faults, rotating fresh loads), a fake clock in a context of its own, waits that are timers in disguise, bounded condition waits, reduced motion's sub-ms durations, `fill` vs a frame-deferred caret, defining a target for the size floor, batched probes, axis-specific known findings, finding a panel wherever it ended up, one clipping card per floating component |
| [t4-converts.md](./t4-converts.md) | Moving a browser check into a unit test: a green break is a finding (the fault masked by a fallback, or a test too weak), two-item roving tests cannot prove direction, a jsdom MutationObserver sees a one-commit flash only through a non-discrete update, `dir` vs inline `direction` in jsdom, what stays in the browser, a group left with no component script; the gate after: headers that drift from their bodies, order claims on the first pair only, readouts matched by shape, merges proved by their summaries |
| [showcase-themes.md](./showcase-themes.md) | Trial themes as the showcase's own consumer files, an exemption paired with a replacement gate, deeper tinted ramps and domain marks, the warning trap on a deeper ramp, old-style default figures in data, faces that load only where painted, clipping chroma not lightness, findings a face or density moves, demos that draw every theme, durations that race demo timers, moving status away from the brand |
| [t5-preview-and-shards.md](./t5-preview-and-shards.md) | Browser checks on a development build under `vite preview` and in parallel sessions: building every run, React's warnings in a development build, source maps and chunk names for module claims, a limit on every wait, frame windows timed from the event, per-run folders, the dev server's cold compile, timing readouts across runs |

## 2026-10-20 — integration gate F (bottom-nav inset, hero backdrop, view-transition runs, token gaps, rating colour)

- **A colour compared as a string fails on a blend.** Under forced colours the rating fill is
  the pair's `color-mix()` of two CanvasTexts and serialises as `oklch(0 0 none)`, while a
  CanvasText probe reads `rgb(0, 0, 0)`: the same paint. Compare painted pixels (a 1×1
  canvas), and keep a break that makes the colours really differ.
- **A gap that becomes a token moves the checks that pinned its old number.** Turning
  ContextMenu's 2px into `--R-SIZE-6` failed the context-menu check, which hard-coded 2;
  a check reads the token where the panel reads it and asserts the panel follows it.
- **The same probe, written a third time.** The floating hook's new token resolver, the
  DataTable's column bounds and the Splitter's pane limits each appended a hidden span to
  turn a CSS length into px. One shared resolver now, with one test hook
  (`data-length-probe`).
- **A browser check reads its script when it runs.** An edit to a check during a run made
  its retry pass on the new text and report the first failure as flaky; edit between
  runs.

## 2026-10-19 — integration gate E4 (motion extras, the Marketing and Dashboard pages)

- **A page's workaround is a library finding, again.** The two page builders worked around
  seven gaps (a picture pushed down by prose, a sticky header with no offset, a pinned column
  on the wrong surface, presets on the device's clock, a filter with no placeholder, URL
  helpers that wrote defaults, a toolbar squeezed to nothing). Each is fixed at the source
  with a test or a browser assertion that goes red without it, and each workaround is gone.
- **Every new motion check failed first, all for real reasons or harness ones worth
  keeping:** a view timeline bound to the demo frame (it scrolls sideways), a prose margin
  the inserted bar caused, a 1px `sr-only` counted as a scroller, a serialised gradient
  without `at`, and CDP's ignored pointer media. Run a check before trusting its silence.
- **A reduced-motion transition is still a transition.** The contract collapses durations
  to near zero, not zero, and React renders a scroll's state in a later task: a check that
  counts two frames reads the start of the slide. Wait for the element's animations to
  finish.
- **A break that stays green after a fix found the check's blind spot.** Once the hidden
  header slid fully past the host's bar, the "paints under the bar" assertion could no
  longer fail; it now half-slides the header itself to create the overlap it guards.

## 2026-10-19 — integration gate E3 (marketing and media)

- **A size container cannot be a subgrid.** `@container` applies layout containment, and a
  contained grid lays out on its own, so Pricing's cards (a `Card`, a container) ignored
  `grid-rows-subgrid` and only lined up while their parts happened to be equal. The check
  now makes one card's description longer before comparing rows; the card passes
  `@container-normal`.
- **A grid that pins items to columns must read its tracks with the items unpinned.** An
  item placed in a column the narrowed grid no longer has creates an implicit track, which
  `grid-template-columns` reports, so MasonryGrid kept five columns at 352px. It drops
  `data-placed` before reading.
- **A wrapped flex row stretches its lines.** HowItWorks' shorter steps shared the row's
  spare height between marker and text, so titles started lower beside a two-line title.
  `align-content: flex-start`, and the check asserts titles on one line.
- **A box that stands in for an `<img>` is not compressible.** `Image`'s file width is also
  its min-content width, so in an `auto` track it widened the track to 1600px; an `<img>`
  would have shrunk. Pass `w-full` (documented on Image).
- **Small imported assets are data URIs, in dev too.** The gallery art was inlined, so a
  "replay" query appended to it broke every picture, and a network hold matched only the
  modules. Demo assets that a check must hold back import with `?no-inline`; a query is
  appended with `&` when the address already has one.
- **"Nothing running" is measured two frames on.** A reduced-motion transition or animation
  (0.01ms) still starts on the frame its style changes and ends on the next, so a check one
  frame after the change flaked (Image's fade, Lightbox's entrance). Two frames is still an
  eighth of a full fade, so the check keeps its teeth.
- **A transparent colour test must not match black.** `/, 0\)$/` read `rgb(0, 0, 0)` as
  transparent and failed every forced-colours ring; test the alpha of `rgba()` only.
- **Logos are pictures.** Inline SVG wordmarks inherit `direction` (their text ran
  backwards over the mark in RTL) and the theme's face (it overflowed the viewBox): give
  them `direction="ltr"` and a `textLength`. Image logos drawn for a light page invert on
  a dark scheme (`invert(var(--SCHEME-DARK))`), or dark ink vanishes.
- **A group sheet that writes `:root` publishes the group's own hook only**
  (`--r-marketing-site-header-h`); `verify:class-prefix` now fails anything else declared
  by a rule with no class of its own.
- **Equal things get equal treatment across a family of sections**: list links in a footer
  do not underline at rest (like nav rows), and an end group that wraps under narrow
  content starts at the start edge, not the end.

## 2026-10-16 — integration gate E2 (filters, TreeView, RequireAuth, HoverCard, Splitter, inputs, Kanban)

- **A visually hidden span is placed by its nearest positioned ancestor.** Kanban's `sr-only`
  column counts had none inside the board's scroller, so they sat at the page's edge and
  scrolled the whole Overview sideways by 500px at 375. Give a scroller's items (or the
  scroller) a containing block.
- **A coarse hit area is part of what a scroller scrolls.** A slider's end thumb hung 14px
  past the slider and scrolled FilterBar's drawer sideways. Inset the part so its hit area
  stays inside the component, rather than relying on every container's padding; and a
  check of "nothing spills" measures drawn boxes (a Range or element rects), not
  `scrollWidth`, on a box that is not itself a scroller.
- **Chromium resets an input's selection on the style update after a `type` swap**, which
  undoes a restore made in the same commit. Flush (`offsetWidth`) before restoring. jsdom
  kept the selection; the browser check caught it on its first run.
- **Auto table layout reads a cell's `width` as a wish.** A resized column in a table
  already at its width took the space from a truncating neighbour (to 24px) instead of
  growing the table; `min-width` is what auto layout honours, and a resizable column's
  automatic width keeps its min.
- **A row's padding plus a control-height action outgrows `--ROW-H`.** A tree row with a
  `size-control` delete button was 44px, not 40; the actions take the row's block padding
  (negative margin), as the windowed rows (no padding) already did.
- **The accessibility tree is checkable without a library.** `locator.ariaSnapshot()` gives
  roles and computed names: a tree's items named by their labels alone, a gate's fallback
  as a status or a named link. Breaking `aria-labelledby` turned the names into "src Rename
  src Delete src".
- **Unregistered tokens read back as written.** `getPropertyValue("--HIT-MIN")` is
  `1.5rem`, not 24; a check resolves a length with a probe sized by the token.

## 2026-10-16 — integration gate E1 (sliders, feedback, times, DataTable features, toolbar)

- **A size container has no width in a flex row.** `Field` (and `Pagination`, `FormActions`)
  is an `@container` root, so its intrinsic width is zero: the TimeField and TimePicker
  demos put Fields in `flex flex-wrap` rows and every field collapsed to its border, at
  every width, and DataTable's footer pager vanished the same way. Units that hold one get
  a track; AGENTS.md says so.
- **A hidden box still scrolls.** Toolbar units parked for "More" stayed laid out at full
  width from the inline start and widened every narrow toolbar's scroll width, as did their
  coarse hit areas once moved to the end. They now hang from the inline end (overflow
  toward the start is unreachable) with their paint contained.
- **Two mechanisms, again.** The slider fill's forced-colours rule restated what the
  contract's `--C-ACCENT: Highlight` already guaranteed, and the TimePicker centred its list
  in a layout effect and again on the next frame; breaking either one alone left its check
  green. One of each went.
- **A word in a content-sized track widens everything in it.** A Banner's unbroken German
  word sized an `auto` grid column for every banner in the stack, and its `sr-only` span,
  absolutely placed outside the demo's scroller, made the page scroll. `overflow-wrap:
  anywhere` in the text column.
- **A blur-time message moves the button under the pointer** in any form, not only the
  Wizard: a TimeField's "incomplete" note shifted the demo's Submit and the press was lost.
  Demos put their actions in `FormActions`.
- **A gate's cross-file match must be by binding.** `verify:utilities-exist` upgraded a
  class-named table when any file used any variable of that name as classes, so a local
  `classes` string in ToggleGroup turned the BarChart demo's error categories into dead
  classes. It now follows imports (aliases included).
- **A pixel comparison needs a subject that held still.** The masked-OTP check compared two
  clipped screenshots and failed one fresh run in three by 1048 pixels: a demo above it
  finished and shifted the page between the shots. The pair is now taken over a box that
  did not move (retaken if it did); a real paint bug differs on every try.
- **A borrowed class is a dependency.** dates writes form's `r-form-frame` by name; the
  group graph now counts `r-<group>-` strings as edges, so a cycle through borrowed looks
  fails like one through imports.

## 2026-10-16 — integration gate D (verification fixes)

- **Headless Chromium hides scrollbars** (`--hide-scrollbars`), so `clientWidth` equals the
  viewport and a `100vw` cap looks as good as `100%`. A check about the scrollbar asserts
  the promoted panel's computed cap (`min(…, 100% - …)`), which keeps its percentage, and
  the geometry it can see.
- **Two gaps for one edge drift apart.** The surface cap left `2 × --R-SIZE-2` while
  `shift()` kept a fixed 8px, so a capped panel sat 8px from one edge and 16px from the
  other. The positioning reads the same token, inside the panel (density follows).
- **An em is the element's own.** The prose list indents `1.25em` of the list (UI size);
  a task box sized and hung in the item's prose em overhung it. When a box must fit an
  indent, let one element own both lengths in one em.
- **A focus-on-open check needs a target the default would not pick.** `autoFocus` on a
  dialog's first focusable passes whether or not it works; aim it at a later control and
  assert the harness (the first focusable is something else).
- **A break caught by the harness is not a break of the claim.** Selecting sparklines by
  the class under test (`h-spark`) made the break fail as "0 found"; select by role or
  structure, then break the measured property.
- **A demo row added to make a claim testable is a change to every matrix.** A wrapper
  `div` around a scrolling tab list, inside a flex Row, kept the list from shrinking and
  spilled at 375; the overview matrix caught it. A wrapper in a Row is `min-w-0`, and the
  matrices run again after any demo change.

## 2026-10-16 — bug sweep (whole package, every group)

- **A generated IDREF target is written after the caller's spread.** A caller's `id` on a
  title or trigger otherwise unhooks the `aria-labelledby` that points at it; a caller's own
  `aria-labelledby` on the labelled element, by contrast, wins over the generated one.
- **Removing a focused node fires no blur.** State set on focus and cleared on blur (a
  pause, a "focus inside" flag) needs a re-check when the focused part unmounts.
- **Async results carry the key they were asked under.** A debounced query keyed only by its
  text leaks one page's results into the next; a submit that awaited a check must re-check
  if the value moved meanwhile (the change aborted the answer it waited for).
- **"Internal" is what a URL parser says, not a prefix test.** `/\host`, `///host` and
  ` //host` are other hosts to a browser. Classify by resolving (`isExternalHref`), once.
- **Hostile input is also long input.** `endsWith`/`replace` on a growing string inside a
  loop, or a lazy regex rescanning to the end at each unclosed opener, is quadratic; the
  Markdown parser hung on 100k-character inputs until each was made one pass.
- **A gate parses `.ts` as TS.** Forcing TSX turns a generic arrow into JSX and hides every
  string after it; a scanner's scope is `src/**` minus what is raw on purpose, not
  `components/` alone.
- **A `.test.tsx` under `showcase/sections/` is discovered as a section.** Showcase demo
  tests live in `showcase/shell/`.

## 2026-10-15 — integration gate C (round three: commands, steps, timeline, marketing, uploads, colour, print)

- **Groups that each borrow from the other make a cycle no single agent sees.** The palette
  (overlays) took form's Input while ColorPicker (form) took overlays' Popover.
  `verify:group-deps` now fails on any cycle between groups; a component that needs two
  groups gets a group above both, and shared logic moves to `util`.
- **A popup tested at "below the card" flips above it** when the harness scrolls the card
  to the bottom of the viewport. Probe the part outside the clip in either direction.
- **Under forced colours a translucent wash keeps its alpha.** Chromium repaints an 8% ink
  wash as Canvas at 8%, which "differs from a plain row" and passed a check with the real
  highlight removed. Compare against the resolved system colour (a probe painted
  `Highlight` with `forced-color-adjust: none`).
- **Two mechanisms for one guarantee make both untestable.** Each break alone changed
  nothing. Keep the one that carries the guarantee and test it.
- **Geometry is read after an entry animation, not during it.** A hit-test while a popup
  scaled in was flaky; wait until the popup's own animations finish (scoped to it: a page
  always has a spinner running somewhere).
- **A group rule cannot beat a utility on the same element.** MediaCard's hover edge was a
  component rule against a resting `border-border` utility and never painted; its check
  went red the first time it ran.

## 2026-10-15 — integration gate B (round two: charts, content, selection, dates, form state, forced colours)

- **A bundler splits only what it can see.** Each grammar is its own chunk because each is a
  static `import("highlight.js/lib/languages/<name>")` in a table; a computed specifier would
  bundle every grammar. And a dev server's pre-bundled dependency is not the production
  chunk: Vite's dev copy of lowlight drags in its whole grammar set, so the browser check
  counts the grammar requests the loader itself initiates.
- **A spill lands in the nearest scroller.** `sweep-overview` measured only the demo frame,
  so content spilling inside an inner `overflow: auto` box never reached it. It now checks
  every scroll container in a demo; a scroller designed to scroll says so with
  `data-sc-scrolls` (on itself or a wrapper inside the demo), never the whole demo.
- **`outline: none` is not off under forced colours.** The contract forces
  `outline-style: solid` on `:focus-visible` to rescue rings drawn as shadows, which revives a
  reset outline at its default width: a second ring inside the frame. Reset with
  `outline: 0 none`. `sweep-forced-colors.js` counts rings.
- **Code-split pages need a ready signal, not longer timeouts.** Every browser check waits
  for `<html data-showcase-ready="<page>">` (set once the page and everything it suspends on
  committed) through one prelude the runner injects, instead of each script guessing a
  first-load timeout for its own element.
- **A container query cannot read a custom property.** The contract's container sizes are
  literals equal to the column levers' defaults (a check holds them equal); the box
  utilities still follow a theme through a `:root` alias.

## 2026-10-15 — integration gate A (round two: CSS levers, plumbing, motion)

- **A contract lever reaches only what reads it.** The CSS package added `--BORDER-WIDTH`
  and the layer scale; every utility border followed, but component stylesheets still wrote
  `1px solid` and raw `z-index: 1/2/10`, so a 2px theme had two line weights on one screen
  and the shell's order could not be joined by a consumer's sticky chrome. Both are now
  gated in `verify:no-raw-tailwind`. When the contract grows a lever, grep the components'
  CSS for the literal it replaces.
- **Forced colors for domain tokens follow the contract's rules, with one split.** Status,
  trend and chart chrome map to system colours; series and sequential steps keep theirs
  (the colour is the data) and their fills opt out of repainting. `verify:domain-pairs`
  makes every new pair choose.
- **A gate that reads `:root` must skip `:root` inside an at-rule.** The forced-colors block
  is a second `:root`; the contrast and palette gates would have read `CanvasText` as a
  theme value.
- **A fixed overlay page must leave the host's navigation reachable.** The Dashboard's frame
  covered the showcase's bottom nav on phones; it now measures the bar and stops above it,
  and `dashboard-layout.js` asserts it.

## 2026-10-15 — integration gate 3 (after the parallel page build)

- **Pages are the real consumers, and their workarounds are findings.** Three page agents found
  a card header that starves its title, text slots that never break a word, a KPI value that
  spills, a row height that missed stylesheet changes, a nested `<main>`, a Sparkline and a
  table cell with no API for what the page needed, and a gate false positive. Each was fixed at
  the source with a test that goes red without it, and the page's workaround was removed. See
  [pages-lessons.md](./pages-lessons.md).
- **Watch the value, not a list of causes.** `useRowHeight` observed attributes and a media
  query, and missed a stylesheet edit; a probe sized by the token itself sees every cause.

## 2026-10-15 — integration gate 2 (after the parallel group build)

- **Parallel groups duplicate whatever is shared but unowned.** Three hit-area rules, two tone
  vocabularies (glyph + mark per tone), two loading-bar styles (one missing the reduced-motion
  stop), five hover washes and two segmented-control focus rings. The single sources now:
  the contract's `hit-area`, `util/tone`, `Skeleton`, the 8% primary-ink wash. Before writing
  a helper, look one group over.
- **A demo is a consumer and should look like one.** Overlay demos hand-rolled `<input>`s with a
  hairline border beside the form group's 3:1 field border; a data demo used the showcase
  shell's own segmented control. Demos import the real components.
- **A gate's false positive gets fixed in the gate.** Two groups bent their code around
  `verify:utilities-exist` following comparisons to a parameter default. The extractor now
  skips anything that can only be a boolean, with a fixture that goes red if it regresses.
- **Shared hooks are fixed at the source.** DataTable clamped `useVirtualRows`' window locally;
  the clamp is in the hook now and the workaround is gone.
- **One broken demo must not blank the page.** Each Overview section renders behind its own
  error boundary, and `browser:check` fails on a tripped one, on any console error and on any
  horizontal overflow, page or demo, across every axis.

## 2026-10-15 — integration gate

- **A replaced Tailwind default is not an error, it is nothing.** The CSS package clears
  Tailwind's colour, text-size, radius, shadow, weight, leading, tracking and easing scales,
  so `font-bold` or `rounded` compile to no rule and the element silently loses the style.
  Review and `verify:no-raw-tailwind` (a deny-list) cannot see that; only asking Tailwind's
  own design system can. Enforced: `verify:utilities-exist`. A class built as `bg-${x}` is
  invisible to the scanner for the same reason and is reported too.
- A plain marker class with no rule anywhere (a leftover `sc-view`) is also dead weight;
  the same gate catches it where it is written directly in `className`.

## 2026-10-15 — scaffold

- Floating model changed from the previous generation: panels are never portalled (not
  even into a `<dialog>`); they render in place and are always promoted to the top layer,
  so they inherit density from where they are written. `FloatingPortal` is not re-exported.
- Tailwind emits each domain colour utility twice: a fallback without `color-mix()` (the
  LIGHT half) and the real blend inside `@supports (color: color-mix(in lab, red, red))`.
  Grepping the built CSS for `bg-series-1{` finds the fallback first; the blend is there.
  Browsers without `color-mix()` (pre-2023) get light series steps in a dark theme.
- The series palette is the dataviz method's validated reference palette (worst adjacent
  ΔE: normal 19.6 light / 19.3 dark; CVD 9.1 / 8.4). Re-step within a hue; never re-order.
- `@batthewz/r-ui-css`'s `exports` does not expose `package.json`; the gates find it at
  `node_modules/@batthewz/r-ui-css` (workspace link), see `scripts/lib/themes.mjs`.
