# Changelog

All notable changes to `@batthewz/r-ui-renderer`. The ViewSpec format, the public API and
the `r-ui-validate` interface are versioned contracts: a change that can break a document, a
host or a script is recorded here, and before 1.0 it bumps the minor.

## 0.1.3

### Added

- `EventCalendar` picking: a document may set `selection` (and `defaultSelection`) as a range of ISO dates or date-times with `allDay`, and `onSelectionChange` reports a pick as `{ start, end, allDay }` of ISO date-times (an all-day pick as local midnights, which `selection` reads back as those days), or `null` when it is cleared. `slotMinutes` sets the time grid's slots.
- `EventCalendar` editing: `onEventChange` reports an event moved or resized as `{ event, kind, start, end, allDay }`, the times as ISO date-times; an event's `editable: false` keeps it put. The calendar never changes `events`: a document updates its own.
- `EventCalendar`'s `onEventDelete`: Delete or Backspace on a focused event reports it (its times as ISO date-times); the calendar removes nothing, so a document removes the event from its own state, or refuses.
- `renderSelection`, `renderEventDetails` and `Popover`'s `anchor` take code or something on screen and are not a document's: a document answers a pick with `onSelectionChange` and an opened event with `onEventClick` (an action, a dialog).

### Changed

- The peer `@batthewz/r-ui-react-components` is `^0.1.4`, the first release with picking and editing, and the contracts are re-derived from that build.

## 0.1.2

### Added

- `EventCalendar`: a document may show events by month, week, day or agenda. `date` and
  `defaultDate` are ISO dates and `now` an ISO date-time; an event's `start` and `end` stay
  text, an instant or a `YYYY-MM-DD` all-day date, which the library reads itself. An event's
  `href` passes the same scheme allowlist as `Link`'s, and a refused one is dropped with
  `refused-url`. `onDateChange` reports the day as `YYYY-MM-DD`, `onViewChange` the view and
  `onEventClick` the pressed event. The dates coverage document uses it.

### Changed

- The peer `@batthewz/r-ui-react-components` is `^0.1.3`, the first release with
  `EventCalendar`, and the contracts are re-derived from that build.

## 0.1.1

### Added

- `Button` takes `href`: a document may make a button a link with the button's look. The href
  passes the same scheme allowlist as `Link`'s; a refused one is dropped with `refused-url`.
  The peer `@batthewz/r-ui-react-components` is `^0.1.1`, the first release with it.

### Security

- The optional `zod` peer is now `^4.6.6`: earlier 4.x releases can exhaust memory validating
  an oversized collection (GHSA-mrhx-c7xc-m3w5), and `viewSpecSchema` validates untrusted
  documents. A host on an older zod 4 takes a compatible patch; no document, API or script
  changes.

## 0.1.0

First release. ViewSpec format version 2; version-1 documents of `response-ui-renderer` do
not render, and nothing of that package's API is kept for compatibility.

### Rendering

- `ViewRenderer` renders a document given whole (`spec`), as a growing string (`text` +
  `complete`), from a stream it reads itself (`source`: a `Response`, a `ReadableStream` or
  an async iterable of text or bytes), or from snapshots (`snapshot`, from
  `useViewSpecStream` or a parser).
- A new document starts fresh: a new `spec` object, text that starts over, a new `source` or
  a new parser resets state, data, forms, dialogs and issues.
- The view root carries the density: the host's `density` prop, else the document's root
  `density`. A node's own `data-density` still scopes its subtree.
- It builds the library's elements directly, with no wrapper between a parent and its
  children, so compound parents that read, count or clone their children work. `$each`
  renders keyed siblings; `$cond`, `$ref`, `$format`, `$concat` and `$node` resolve in place.
- Built-in `Text`, `Heading` and `Icon` nodes, styled with tokens only in the components
  layer, so a document's `className` wins.
- Declarative `forms` compiled to the library's `useForm`, with rules, `validateOn`,
  `onSubmit` / `onInvalid`, server field errors and initial values read from data.
- Actions: `setState`, `submitForm`, `resetForm`, `navigate`, `showToast`, `apiCall`,
  `openDialog`, `closeDialog`. Data bindings: `static`, `api`, `source`.
- Degrades instead of throwing: a bad node renders a diagnostic in place, and every issue is
  a DOM element (`RENDERER_CLASSES`, `findDiagnostics`) and an `onIssue` call.
  `diagnostics="hidden"` keeps them in the DOM, out of sight. `onValidation` validates each
  completed document as the view sees it, loading the validator only when given.
- The view root contains layout and paint, so a document's `fixed` positioning stays inside
  the view; dialogs and floating panels render on the top layer, unclipped.
- Custom components through `extendRegistry` and `extendContracts`.

### Theme overrides

- A document's optional `theme` (`{ "scheme"?: "light" | "dark", "tokens"?: { "--C-…": colour } }`,
  written after `density`) recolours its own view: the CSS package's 39 colour roles,
  listed by a deriver from its theme template (`THEME_TOKENS`, `derive:theme`), as hex or
  `rgb()`, `hsl()`, `oklch()`, `oklab()`, `lab()` or `lch()` with numbers; alpha only on the
  roles the template writes translucent. Any other name or value is an error.
- The roles land as custom properties on the view root, with `color-scheme` and
  `--SCHEME-DARK` for `scheme`; a themed root paints its own canvas and ink
  (`RENDERER_CLASSES.themed`). Floating panels render inside the view and take them. Print
  and forced colours set them aside; more contrast applies to them.
- Before anything paints, the view measures its final palette against the CSS package's
  contrast check (99 pairs and the scheme row, derived from the check itself): a shortfall
  in any pair a document's role takes part in refuses the whole theme and reports
  `theme-contrast`. A change on `<html>` measures again; a refusal holds for the rest of the
  document. A pair that cannot be measured fails. The validator checks the pairs the
  document sets on both sides, as a warning.
- `HostPolicy.themeOverrides`: `false` ignores the theme (`theme-disabled`), a list of roles
  narrows it; the CLI's `--no-theme-overrides`.

### Streaming

- A component node renders once its name and props have closed; no half-written prop
  reaches a component. Nodes already shown never remount as siblings arrive; a key written
  out of order shows late, or remounts its object once when it closes. Renders coalesce to
  one per animation frame. Actions and submits are inert until the document is complete. A
  stream that ends early keeps its render and reports `stream-incomplete`.
- `./stream`: the React-free incremental parser (`createViewSpecParser`,
  `parsePartialViewSpec`, `PENDING`, `isPending`, `stripCodeFence`), also re-exported from
  the root.

### Validation

- `./spec`, free of React and the component library: the format's types and constants,
  `validateViewSpec` (raw text or a parsed value; JSON errors with line and column; errors
  for conformance, warnings for what the renderer will drop or refuse; `ok`, and
  `renderable` when no error and no `BLOCKING_CODES` warning; options `origin`, `policy`,
  `strict`, `contracts`, `components`, `iconNames`, `classes`), `formatIssuesForModel`,
  `createValidationHandler` (replies `{ ok, renderable, issues, feedback, spec? }`),
  `extendContracts`, `contractFor`, and the URL and prop policy.
- The `r-ui-validate` bin: a file, `--raw` or standard input; `--format text|json|model`
  (`json` is the handler's body), `--contracts`, `--icons`, `--origin`, `--allow-origin`,
  `--allow-sensitive`, `--no-theme-overrides`, `--strict`; exit 0 valid, 1 not valid, 2 usage or input error (an
  empty document included), 3 internal error. Runs on Node 22 or later (no Node 20: that line
  is end-of-life and unpatched) and on bun.
- `./zod` (`viewSpecSchema`; zod is an optional peer) and `./schema.json`, built from the
  validator's schema source and agreeing with it on errors.

### Reference, examples, icons, styles

- `VIEWSPEC.md`, the model-facing reference, generated from the library's declarations and
  hand-written prose; `./reference` renders it, whole or scoped (`include`, `propLimit`,
  `describeProps`, a host's `contracts` and `iconNames`), or region by region
  (`renderReferenceRegions`).
- `./examples`, React-free: the corpus of whole documents for few-shot prompts (`EXAMPLES`,
  `exampleSpec`, `exampleText`).
- `./icons`: a curated lucide set, keyed by the names the validator knows.
- `./styles`: the renderer's CSS and the class vocabulary a document may use, compiled by
  the host's Tailwind v4 build.

### Host control and hardening

- One `policy` object (`HostPolicy`: `allowUrl`, `allowImageUrl`, `markdownImages`,
  `allowSensitive`, `themeOverrides`) decides what a document may reach, read alike by `ViewRenderer`,
  `validateViewSpec`, the handler and the CLI's flags. Adapters (`fetch`, `navigate`,
  `toast`, `resolveSource`) carry out effects and have no defaults.
- No default network: `api` bindings and `apiCall` need the host's `fetch`, and requests
  stay same-origin unless `allowUrl` allows more. `navigate` needs the host's `navigate`,
  which receives an absolute URL that `allowUrl` has passed. Images pass `allowImageUrl`
  (same origin or a `data:` raster image by default); Markdown images load only from the
  prefixes in `markdownImages`.
- Documents cannot name a theme, or set DOM ids, id references or form-control names. Sensitive
  inputs (`PasswordInput`, `OTPInput`, and controls a password `type` or a password,
  one-time-code or card `autoComplete` makes ask for a secret) need `allowSensitive`.
- URL schemes are allowlisted on resolved values in every URL prop, at any depth; HTML
  injection props, `style`, `ping`, namespaced names and prototype keys are dropped;
  element-choosing props are closed sets; nesting, handler chains and JSON depth are
  capped; a `pattern` rule that could backtrack without end is refused.
- Library components that do not fit a document are listed as not addressable, each with a
  reason and an alternative.
