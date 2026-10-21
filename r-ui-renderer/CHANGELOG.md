# Changelog

All notable changes to `@batthewz/r-ui-renderer`. The ViewSpec format, the public API and
the `r-ui-validate` interface are versioned contracts: a change that can break a document, a
host or a script is recorded here, and before 1.0 it bumps the minor.

## 0.1.0 (unreleased)

First release. ViewSpec format version 2; version-1 documents of `response-ui-renderer` do
not render, and nothing of that package's API is kept for compatibility.

### Rendering

- `ViewRenderer` renders a document given whole (`spec`), as a growing string (`text` +
  `complete`), or from `useViewSpecStream` (a `Response`, a `ReadableStream` or an async
  iterable of text or bytes). The view root carries the density: the host's `density` prop,
  else the document's.
- It builds the library's elements directly, with no wrapper between a parent and its
  children, so compound parents that read, count or clone their children work. `$each`
  renders keyed siblings; `$cond`, `$ref`, `$format`, `$concat` and `$node` resolve in place.
- Built-in `Text`, `Heading` and `Icon` nodes, styled with tokens only.
- Declarative `forms` compiled to the library's `useForm`, with rules, `validateOn`,
  `onSubmit` / `onInvalid`, server field errors and initial values read from data.
- Actions: `setState`, `submitForm`, `resetForm`, `navigate`, `showToast`, `apiCall`,
  `openDialog`, `closeDialog`. Data bindings: `static`, `api`, `source`.
- Degrades instead of throwing: a bad node renders a diagnostic in place, and every issue is
  a DOM element (`DIAGNOSTIC_CLASSES`, `findDiagnostics`) and an `onIssue` call.
- Custom components through `extendRegistry` and `extendContracts`.

### Streaming

- A component node renders once its name and props have closed; no half-written prop
  reaches a component. Nodes already shown never remount. Renders coalesce to one per
  animation frame. Actions and submits are inert until the document is complete. A stream
  that ends early keeps its render and reports `stream-incomplete`.
- `./stream`: the React-free incremental parser (`createViewSpecParser`,
  `parsePartialViewSpec`, `PENDING`, `stripCodeFence`), also re-exported from the root.

### Validation

- `./spec`, free of React and the component library: the format's types, `validateViewSpec`
  (raw text or a parsed value; JSON errors with line and column; errors for conformance,
  warnings for what the renderer will drop or refuse), `formatIssuesForModel`,
  `createValidationHandler`, `listComponentNames`, `extendContracts`, the URL and prop policy.
- The `r-ui-validate` bin: a file, `--raw` or standard input; `--format text|json|model`,
  `--contracts`, `--origin`, `--strict`; exit 0 valid, 1 not valid, 2 usage or input error,
  3 internal error.
- `./zod` (`viewSpecSchema`; zod is an optional peer) and `./schema.json`, built from the
  validator's schema source and agreeing with it on errors.

### Reference, icons, styles

- `VIEWSPEC.md`, the model-facing reference, generated from the library's declarations and
  hand-written prose; `./reference` renders it, whole or scoped (`include`, `propLimit`,
  `describeProps`, a host's `contracts`).
- `./icons`: a curated lucide set, keyed by the names the validator knows.
- `./styles`: the renderer's CSS and the class vocabulary a document may use, compiled by
  the host's Tailwind v4 build.

### Host control and hardening

- No default network: `api` bindings and `apiCall` need the host's `fetch`, and requests
  stay same-origin unless `allowUrl` allows more. Images pass `allowImageUrl` (same origin
  or a `data:` raster image by default). Navigation, toasts and named sources are adapters.
- Documents cannot set a theme, DOM ids, id references or form-control names. Sensitive
  inputs (`PasswordInput`, `OTPInput`) need `allowSensitive`.
- URL schemes are allowlisted on resolved values in every URL prop, at any depth; HTML
  injection props, `style` and prototype keys are dropped; element-choosing props are
  closed sets; nesting and handler chains are capped.
- Library components that do not fit a document are listed as not addressable, each with a
  reason and an alternative.
