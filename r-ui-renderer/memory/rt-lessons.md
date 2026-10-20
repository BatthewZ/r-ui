# Runtime and forms: lessons

- **The library owns form state.** A form def compiles to a synchronous Standard Schema and
  default values; the library's `useForm` does everything else (binding, touched, focus,
  server errors, submitting). Anything the renderer keeps about a form beyond its handle is a
  second source of truth.
- **Form hosts are siblings of the document, never its parents.** Each `useForm` lives in a
  host component that renders nothing and publishes its handle. Nesting hosts around the
  document would move the document one level deeper whenever a form mounts late (one waiting
  on data), remounting every component in it.
- **Handlers read an external store, not React state.** The second action of a list must see
  what the first one wrote; a React state update is not visible until the next render.
- **A Date never meets `JSON.stringify`.** `Date#toJSON` is UTC: a local-midnight calendar day
  becomes the previous day east of Greenwich. Local midnight goes out as `YYYY-MM-DD`, anything
  else as ISO with its offset. Normalise deeply: a component can report a record of ranges.
- **A request's identity is the request.** Key a binding's effect on its resolved URL, method
  and body, not on the render's objects: an unrelated re-render must not refetch, a changed
  `state` value must abort the old request and start a new one.
- **Literal payload keys decide what the view does** (where a request goes, which state path
  is written, which handlers chain). Resolving them would let fetched data choose.
- **A failed submit must fail inside the store.** Rethrowing from `onSubmit` lands in the
  library's uncaught-error path and leaves `submitFailed` false; set the server's field errors,
  or a form-level (`""`) error when the failure names no field.
- **Time zones are testable in jsdom.** Assign `process.env.TZ` per test and restore it; prove
  the zone took effect with a positive control (`Date#toJSON` shifting the day) before trusting
  a "keeps the day" assertion.
