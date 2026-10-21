# @batthewz/r-ui-renderer

Let a model describe a screen as JSON, and show it as real
[`@batthewz/r-ui-react-components`](https://www.npmjs.com/package/@batthewz/r-ui-react-components)
while it is still being written. Check the same JSON on your server, without React, and hand
the issues back to the model to fix.

- **`<ViewRenderer>`** renders a ViewSpec document: dashboards, reports, settings forms,
  marketing pages. Data bindings, forms, dialogs and actions included.
- **Streaming.** Feed it a growing string or a `Response`, and nodes appear as they close.
  No half-written prop (a cut-off URL, an unfinished action) ever reaches a component, and
  nothing runs until the document is complete.
- **A validator with no React in it** (`/spec`), a fetch-style server handler and an
  `r-ui-validate` CLI. Issues carry a JSON Pointer and a suggestion, and come formatted for a
  model's next attempt.
- **A model reference** ([VIEWSPEC.md](./VIEWSPEC.md)) generated from the library's own
  types, which you can scope to the components a prompt needs.
- **The host stays in charge** of the theme, the locale, the network, navigation, images and
  credentials. A document cannot reach any of them on its own.

It is not a way to render every library component (app chrome, uploads and host-level
providers are [out, with reasons](./VIEWSPEC.md#not-addressable)), and documents cannot pick a
theme. The format is version 2; version-1 documents of the earlier `response-ui-renderer` do
not render.

> Status: pre-release (0.1.0). See [CHANGELOG.md](./CHANGELOG.md).

## Install

```sh
bun add @batthewz/r-ui-renderer @batthewz/r-ui-react-components @batthewz/r-ui-css react react-dom @floating-ui/react lucide-react
bun add -d tailwindcss @tailwindcss/vite
```

The component library, React and lucide are peer dependencies (the library's own peers are
listed above with it). `zod` is an optional peer, needed only for `/zod`.

Tailwind v4 must be in your build, because a document's classes are compiled by your
stylesheet, not the renderer's. With Vite:

```ts
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [react(), tailwindcss()] });
```

In your CSS entry, import the token contract, then the library's styles, then the
renderer's:

```css
@import "@batthewz/r-ui-css";
@import "@batthewz/r-ui-react-components/styles";
@import "@batthewz/r-ui-renderer/styles";
```

You need no `@source` line for either package. Each stylesheet registers its own shipped
sources, and the renderer's also registers every class a document may write, so they exist
before any document arrives. A class outside that vocabulary would style nothing, and the
validator warns about it (`unknown-class`).

## Render your first document

Save this as `src/service-health.json`:

```json src/service-health.json
{
  "version": 2,
  "title": "Service health",
  "data": {
    "summary": { "type": "static", "value": { "uptime": 0.9993, "incidents": 2 } },
    "services": {
      "type": "static",
      "value": [
        { "id": "api", "name": "Public API", "status": "Healthy", "tone": "success" },
        { "id": "jobs", "name": "Batch jobs", "status": "Degraded", "tone": "warning" }
      ]
    }
  },
  "root": {
    "component": "Stack",
    "props": { "gap": "r4" },
    "children": [
      { "component": "Heading", "props": { "level": 1 }, "children": ["Service health"] },
      {
        "component": "Grid",
        "props": { "columns": { "base": 1, "@md": 2 }, "gap": "r4" },
        "children": [
          {
            "component": "StatCard",
            "props": {
              "label": "Uptime",
              "value": { "$format": { "value": { "$ref": "data.summary.uptime" }, "style": "percent", "maximumFractionDigits": 2 } }
            }
          },
          { "component": "StatCard", "props": { "label": "Open incidents", "value": { "$ref": "data.summary.incidents" } } }
        ]
      },
      {
        "component": "DescriptionList",
        "props": { "variant": "divided" },
        "children": [
          {
            "$each": "data.services",
            "as": "service",
            "key": "id",
            "node": {
              "component": "DescriptionList.Item",
              "props": { "term": { "$ref": "service.name" } },
              "children": [
                { "component": "StatusLabel", "props": { "tone": { "$ref": "service.tone" } }, "children": [{ "$ref": "service.status" }] }
              ]
            }
          }
        ]
      }
    ]
  }
}
```

And render it:

```tsx
// src/ServiceHealth.tsx
import { ViewRenderer, type ViewSpec } from "@batthewz/r-ui-renderer";
import { icons } from "@batthewz/r-ui-renderer/icons";

import serviceHealth from "./service-health.json";

// A JSON import's inferred type is wider than ViewSpec; the renderer checks the document itself.
const spec = serviceHealth as unknown as ViewSpec;

export function ServiceHealth() {
  return <ViewRenderer spec={spec} icons={icons} />;
}
```

You should see a "Service health" heading, stat cards for uptime (99.93%) and open
incidents, and each service with its status. The view takes the page's theme and density
like any other library component.

`icons` is the curated lucide set the validator knows by name. Pass your own map instead,
or extend it (`{ ...icons, "my-glyph": MyGlyph }`). Without it, every icon renders a
missing-icon marker.

## The format in brief

A document is one JSON object: `version`, `title`, optional `density`, `state`, `data` and
`forms`, and a `root` node, written last so it can stream. A node is a string, a component
(`{ "component", "props", "children" }`, parts by dot path: `"Card.Header"`), or a marker:

| Marker | Does |
| --- | --- |
| `{ "$ref": "data.summary.uptime" }` | reads a value: `data`, `status`, `state`, `forms`, `event`, or a `$each` alias |
| `{ "$format": { "value": …, "style": "currency", "currency": "EUR" } }` | formats it in the host's locale |
| `{ "$each": "data.rows", "as": "row", "key": "id", "node": … }` | renders `node` per element, as siblings |
| `{ "$cond": { "ref": "state.tab", "eq": "billing" }, "then": …, "else": … }` | picks a branch |

Props also take `$concat` (one string from parts), `$node` (a node where a component takes
one) and handlers (`"onClick": { "action": "openDialog", "payload": { "dialogId": "edit" } }`).
Forms compile to the library's `useForm`; actions set state, submit and reset forms, navigate,
raise toasts, call APIs and open dialogs.

[VIEWSPEC.md](./VIEWSPEC.md) is the full model: every rule, every component's props and parts,
every issue code. It is written for the model as much as for you.

## Streaming

A model writes a document front to back. Give the renderer what has arrived so far, and it
shows each node once the node's name and props have closed. A text child streams character
by character. A node still arriving shows nothing, or a Skeleton with
`streamingFallback="skeleton"`.

If you already hold the text as it grows (a chat message, an SDK's accumulated output), pass
it as `text` and set `complete` at the end. Only the new part is parsed each time:

```tsx
// src/StreamedAnswer.tsx
import { ViewRenderer } from "@batthewz/r-ui-renderer";
import { icons } from "@batthewz/r-ui-renderer/icons";

/** `text` is everything that has arrived so far; `done` once the model has finished. */
export function StreamedAnswer({ text, done }: { text: string; done: boolean }) {
  return <ViewRenderer text={text} complete={done} icons={icons} streamingFallback="skeleton" />;
}
```

If you hold a stream, `useViewSpecStream` reads it: a `Response`, or a `ReadableStream` or
async iterable of strings or bytes. Keep the same object for the life of the stream; a new
one starts over.

```tsx
// src/GeneratedView.tsx
import { useViewSpecStream, ViewRenderer } from "@batthewz/r-ui-renderer";
import { icons } from "@batthewz/r-ui-renderer/icons";

/** `response` is your generation endpoint's reply, streaming the document. */
export function GeneratedView({ response }: { response: Response }) {
  const snapshot = useViewSpecStream(response);
  return <ViewRenderer stream={snapshot} icons={icons} streamingFallback="skeleton" />;
}
```

Either way, the view re-renders at most once per animation frame, nodes already shown never
remount as siblings arrive, a surrounding ```` ```json ```` fence is ignored, and actions and
form submits do nothing until the document is complete. A stream that ends early keeps what it
showed and reports `stream-incomplete`. VIEWSPEC.md tells the model the key order that streams
best ("Streaming order"); an object written out of order still renders, but only once it closes.

The parser alone, with no React, is `@batthewz/r-ui-renderer/stream`
(`createViewSpecParser().push(chunk)`, `parsePartialViewSpec(text)`).

## Validate on a server

`@batthewz/r-ui-renderer/spec` imports nothing from React or the component library, so it
runs in a server, a worker or a build step. `validateViewSpec` takes the model's raw text (a
code fence is stripped, a parse error comes back with its line and column) or a parsed value:

```ts
// server/check.ts
import { validateViewSpec, type ViewSpec } from "@batthewz/r-ui-renderer/spec";

/** The document, or undefined when it does not conform. */
export function check(modelOutput: string): ViewSpec | undefined {
  const result = validateViewSpec(modelOutput, { origin: "https://app.example.com" });
  return result.ok ? result.spec : undefined;
}
```

An **error** means the document does not conform; `ok` is false only then. A **warning**
means it conforms but something in it will be dropped, refused or will not work. Pass
`origin` so the validator can judge request and image URLs as your page will.

### Generate, validate, regenerate

`formatIssuesForModel` turns the issues into feedback a model can act on: errors first, one
line each, with the JSON Pointer and the fix.

```ts
// server/generate-view.ts
import { formatIssuesForModel, validateViewSpec, type ViewSpec } from "@batthewz/r-ui-renderer/spec";

export interface Turn {
  readonly role: "user" | "assistant";
  readonly content: string;
}

/** Asks `model` for a view until one validates, feeding each attempt's issues back. */
export async function generateView(
  model: (turns: readonly Turn[]) => Promise<string>,
  request: string,
  attempts = 3,
): Promise<ViewSpec> {
  const turns: Turn[] = [{ role: "user", content: request }];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const text = await model(turns);
    const result = validateViewSpec(text, { origin: "https://app.example.com" });
    if (result.ok) return result.spec;
    turns.push({ role: "assistant", content: text }, { role: "user", content: formatIssuesForModel(result.issues) });
  }
  throw new Error(`No valid view after ${attempts} attempts.`);
}
```

To regenerate on warnings too, loop until `result.issues.length === 0`.

### An HTTP endpoint

`createValidationHandler` is a fetch-style `(Request) => Promise<Response>`. POST a document
as the body; the reply is `{ ok, issues, feedback }` with status 200 either way (405 for
another method, 413 past `maxBytes`, 1 MiB by default):

```ts
// server/validate.ts
import { createValidationHandler } from "@batthewz/r-ui-renderer/spec";

export const validate = createValidationHandler({ origin: "https://app.example.com" });
```

It mounts in any server that speaks `Request` and `Response`, such as
`Bun.serve({ routes: { "/validate": { POST: validate } } })` or a framework route's `POST`.

### The command line

`r-ui-validate` takes a file, `--raw` text or standard input:

```sh
npx r-ui-validate view.json                         # a file
my-generator | npx r-ui-validate --format model     # stdin; feedback for the model
npx r-ui-validate view.json --strict --format json  # CI: warnings fail too, machine output
```

A document with a missing title and a misspelt component:

```console
$ npx r-ui-validate --raw '{"version":2,"root":{"component":"Stak","children":["Hi"]}}'
error  (document)  missing-key: Missing `title`.
warning  /root/component  unknown-component: No component is registered as `Stak`.
    "Stack"
1 error(s), 1 warning(s)
```

| Exit | Means |
| --- | --- |
| 0 | valid (warnings are printed but pass, unless `--strict`) |
| 1 | not valid, or warnings under `--strict` |
| 2 | usage or input error: a bad flag, an unreadable file, no document |
| 3 | `r-ui-validate` itself failed; the document was not judged |

Other options: `--origin <url>` (as above) and `--contracts <file>` (your own components; see
[Custom components](#custom-components)). It runs on Node 20 or later, and on bun.

## Prompt a model with the reference

The model needs to know the format and the components. `renderViewSpecReference` returns
VIEWSPEC.md as a string, ready for a system prompt, and `include` narrows it to the components
a task needs (a part brings its root, and a root brings its parts):

```ts
// server/prompt.ts
import { renderViewSpecReference } from "@batthewz/r-ui-renderer/reference";

export const reference = renderViewSpecReference({
  include: ["Stack", "Grid", "Card", "StatCard", "DataTable", "StatusLabel", "LineChart", "Badge", "Heading", "Text", "Icon"],
});
```

The whole reference is about 86 KB. The scope above is about 45 KB: the prose, the class
vocabulary, the icon names and the not-addressable table stay whole, because a model writes
better documents when it knows the rules and what it cannot use. `propLimit` cuts each
component's prop list, at a cost: a hidden prop is one the model then invents.
`describeProps` adds each prop's one-line description, which is worth it for a narrow scope.

To constrain a model's structured output instead, `@batthewz/r-ui-renderer/schema.json` is the
format as JSON Schema, and `@batthewz/r-ui-renderer/zod` exports it as `viewSpecSchema`. Both
agree with `validateViewSpec` on what is an error; the warnings exist only in the validator.

## Adapters: the network, navigation, toasts and images

A document can ask for data, a request, a page change or a toast, but only the host can
carry them out. Each is an adapter, and **nothing is requested without `fetch`**:

```tsx
// src/HostedView.tsx
import { useToast } from "@batthewz/r-ui-react-components";
import { type RendererAdapters, ViewRenderer, type ViewSpec } from "@batthewz/r-ui-renderer";
import { icons } from "@batthewz/r-ui-renderer/icons";
import { useMemo } from "react";

const CDN = "https://cdn.example.com";

export function HostedView({ spec, go }: { spec: ViewSpec; go: (to: string) => void }) {
  const { toast } = useToast();
  const adapters = useMemo<RendererAdapters>(
    () => ({
      fetch: (url, init) => fetch(url, { ...init, credentials: "same-origin" }),
      navigate: (to) => go(to),
      toast,
      allowImageUrl: (url) => url.origin === location.origin || url.origin === CDN,
    }),
    [go, toast],
  );
  return <ViewRenderer spec={spec} adapters={adapters} icons={icons} />;
}
```

| Adapter | Serves | Without it |
| --- | --- | --- |
| `fetch(url, init)` | `api` data bindings and the `apiCall` action | nothing is sent; `missing-adapter` |
| `resolveSource(request, signal)` | `source` data bindings: named data your app supplies | `missing-adapter` |
| `navigate(to, { replace })` | the `navigate` action | same-origin URLs load the page; others are refused |
| `toast(request)` | the `showToast` action (`useToast().toast` fits as is, under a `ToastProvider`) | `missing-adapter`; the actions after it still run |
| `allowUrl(url)` | which origins `fetch` may reach | same origin as the page |
| `allowImageUrl(url)` | every image a document makes the browser load, at any depth | same origin, or a `data:` raster image |

Every URL is resolved first and judged on the result, so `//evil.example` and
`/\evil.example` are other origins, not paths. Links the document renders go through the
library's `RouterProvider` when you mount one above the view. Markdown images load only from
the URL prefixes in `markdownImageAllowlist` (none by default). `PasswordInput` and
`OTPInput` render only with `allowSensitive` (`true`, or a list of names).

## Theme, density and locale

The host owns all three. A document has no `theme` key, and `data-theme` or `data-input` on a
node is dropped, so a view always wears the page's theme (`<html data-theme="…">`, as the CSS
package describes).

Density is the one axis a document may suggest. `"density": "compact"` applies to the whole
view, and `"data-density"` on any node applies to that subtree. Your `density` prop wins over
the document's:

```tsx
<ViewRenderer spec={spec} icons={icons} density="comfortable" />
```

Numbers and dates format in the locale of the library's `LocaleProvider` above the view.

## Custom components

A component of your own goes in the registry (what renders) and in the contracts (what the
validator, the reference and the renderer know about it). Keep the contracts in a module with
no React, so the server can share it:

```ts
// shared/contracts.ts
import { defaultContracts, extendContracts } from "@batthewz/r-ui-renderer/spec";

export const contracts = extendContracts(defaultContracts, {
  RegionMap: {
    category: "Maps",
    note: "One region's data centres.",
    props: [{ name: "region", type: '"eu" | "us" | "apac"', required: true }],
    propEnums: { region: ["eu", "us", "apac"] },
  },
});
```

```tsx
// src/registry.tsx
import { Card } from "@batthewz/r-ui-react-components";
import { defaultRegistry, extendRegistry } from "@batthewz/r-ui-renderer";

function RegionMap({ region }: { region: "eu" | "us" | "apac" }) {
  return (
    <Card>
      <Card.Body>Data centres in {region}</Card.Body>
    </Card>
  );
}

export const registry = extendRegistry(defaultRegistry, { RegionMap });
```

Then pass both to the renderer, the contracts to the validator and the reference, and the
same contracts as JSON to the CLI's `--contracts`:

```tsx
<ViewRenderer spec={spec} registry={registry} contracts={contracts} icons={icons} />
validateViewSpec(text, { contracts });
renderViewSpecReference({ contracts, include: ["Stack", "RegionMap"] });
```

`extendContracts` lays each field over the base, so it also refines a library component's
contract. A name you register with no contract at all goes in the validator's `components`
option: known, but unchecked.

## What documents cannot use

Some library components are deliberately not addressable: the app frame (`AppShell`,
`SiteHeader`, `Footer`), host preferences (`ThemeSwitcher`, `DensitySwitcher`,
`LocaleProvider`), uploads that need a host handler, and a few that only work when code
wraps them. A document that names one gets `not-addressable` with the alternative.
[VIEWSPEC.md lists each one and why](./VIEWSPEC.md#not-addressable).

## Hardening

A document is untrusted input. The renderer degrades instead of failing: a bad node renders a
small diagnostic in its place, and the rest of the view carries on. The validator reports the
same thing before you render.

| A document that… | Gets | Issue |
| --- | --- | --- |
| puts `javascript:`, `vbscript:` or a non-image `data:` URL in any URL prop, at any depth, in any casing, or builds one with `$concat` | the prop dropped | `refused-url` |
| requests another origin, or loads an image from one (a tracking pixel) | nothing sent or loaded, unless `allowUrl` / `allowImageUrl` allows it | `refused-url` |
| asks for data or calls an API when the host gave no `fetch` | nothing sent | `missing-adapter` |
| sets `dangerouslySetInnerHTML`, `srcDoc`, `style`, `formAction`, `ref`, `key` or an `on…` string | the prop dropped | `forbidden-prop` |
| writes `__proto__`, `constructor` or `prototype` as a prop, a path segment or a name | the prop dropped; the path or name is an error; nothing on a prototype is ever read | `forbidden-prop`, `invalid-ref`, `invalid-name` |
| writes a DOM `id`, an `aria-*` id reference or a form control's `name` | dropped; Fields wire their own ids, so two views never collide | `forbidden-prop` |
| sets a theme (`theme`, `data-theme`) | an error for the key, the attribute dropped | `unknown-key`, `forbidden-prop` |
| chooses an element (`as`, a heading level) outside the component's list | the prop dropped | `invalid-prop-value` |
| asks for `PasswordInput` or `OTPInput` | a diagnostic, unless the host allows it | `sensitive-component` |
| nests nodes past 50 deep, or chains handlers past 5 | a diagnostic; the excess is not rendered or run | `limit-exceeded` |
| names a component that does not exist, or one that throws | a diagnostic in place | `unknown-component`, `render-error` |
| is malformed, truncated or cut off mid-stream | the parse error with its line and column; a stream keeps what it showed | `invalid-json`, `stream-incomplete` |

Request endpoints, methods and `into` targets are read as written, never from fetched data,
so data a request returns cannot decide where the next one goes.

### Finding what went wrong

Every diagnostic is a DOM element with the class `r-renderer-diagnostic`, a severity class,
`data-code` and `data-path`. Issues with no place to show (a failed request) sit in a hidden
list inside the view, so each one is queryable exactly once:

```tsx
<ViewRenderer spec={spec} icons={icons} onIssue={(issue) => log(issue)} onValidation={(result) => log(result)} />
```

`onIssue` receives every issue found while rendering and running. `onValidation` receives
`validateViewSpec`'s result once, when the document is complete. In a test,
`findDiagnostics(container)` lists them.

## Entry points

| Import | What | React |
| --- | --- | --- |
| `@batthewz/r-ui-renderer` | `ViewRenderer`, `useViewSpecStream`, `extendRegistry`, `defaultRegistry`, `extendContracts`, `defaultContracts`, `findDiagnostics`, the parser and the format's types | yes (`"use client"`) |
| `@batthewz/r-ui-renderer/spec` | `validateViewSpec`, `formatIssuesForModel`, `createValidationHandler`, `extendContracts`, `listComponentNames`, the URL policy, the format's types | no |
| `@batthewz/r-ui-renderer/stream` | `createViewSpecParser`, `parsePartialViewSpec`, `PENDING`, `stripCodeFence` | no |
| `@batthewz/r-ui-renderer/reference` | `renderViewSpecReference`, `renderReferenceRegions`, `scopeContracts` | no |
| `@batthewz/r-ui-renderer/icons` | `icons`, the curated lucide set | lucide |
| `@batthewz/r-ui-renderer/zod` | `viewSpecSchema` | no (needs `zod`) |
| `@batthewz/r-ui-renderer/schema.json` | the format as JSON Schema | no |
| `@batthewz/r-ui-renderer/styles` | the renderer's CSS and the class vocabulary | |
| `r-ui-validate` | the CLI | no |

## License

MIT
