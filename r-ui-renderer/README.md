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
  credentials. A document cannot reach any of them on its own; it may recolour its own view,
  and only with a palette that meets the design system's contrast floors.

It is not a way to render every library component (app chrome, uploads and host-level
providers are [out, with reasons](./VIEWSPEC.md#not-addressable)), and documents cannot pick a
theme by name. The format is version 2; version-1 documents of the earlier `response-ui-renderer` do
not render.

**[Try it in the playground](https://batthewz.github.io/r-ui/playground/)**: edit a document
and watch it render, replay it as a stream, and read the validator's issues. It is built from
the latest release.

> Status: pre-release (0.1.0). See [CHANGELOG.md](./CHANGELOG.md).

## Install

```sh
bun add @batthewz/r-ui-renderer @batthewz/r-ui-react-components @batthewz/r-ui-css react react-dom @floating-ui/react lucide-react
bun add -d vite @vitejs/plugin-react tailwindcss @tailwindcss/vite
```

The first line is the runtime: the component library, React and lucide are peer dependencies,
and the library's own peers come with it. The second is the build: Vite with React and
Tailwind v4; skip what your app already has. `zod` is an optional peer, needed only for
`/zod`.

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

A document is one JSON object: `version`, `title`, optional `density`, `theme`, `state`,
`data` and `forms`, and a `root` node, written last so it can stream. A node is a string, a component
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

If you hold a stream, pass it as `source`: a `Response`, or a `ReadableStream` or async
iterable of strings or UTF-8 bytes. The view reads it to the end.

```tsx
// src/GeneratedView.tsx
import { ViewRenderer } from "@batthewz/r-ui-renderer";
import { icons } from "@batthewz/r-ui-renderer/icons";

/** `response` is your generation endpoint's reply, streaming the document. */
export function GeneratedView({ response }: { response: Response }) {
  return <ViewRenderer source={response} icons={icons} streamingFallback="skeleton" />;
}
```

To read the stream yourself (to show progress beside the view, say), `useViewSpecStream(source)`
returns its `StreamSnapshot`, which the view takes as `snapshot`.

Either way, the view re-renders at most once per animation frame, nodes already shown never
remount as siblings arrive, a surrounding ```` ```json ```` fence is ignored, and actions and
form submits do nothing until the document is complete. A stream that ends early keeps what it
showed and reports `stream-incomplete`. VIEWSPEC.md tells the model the key order that streams
best ("Streaming order"). A key written out of order still renders: the object shows late, or
shows without it and remounts once when it closes, and ends as the whole document renders.
A `Markdown` node's text is parsed whole on every frame it grows, so a very long one streams
at a cost that grows with its length.

**A new document starts fresh.** State, data, forms, open dialogs and reported issues belong
to one document. A new `spec` object, `text` that starts over instead of growing, a new
`source`, or snapshots from a new parser each start the view afresh. So keep a `spec`
object's identity while it is the same document, and the same `source` object for the life
of its stream.

The parser alone, with no React, is `@batthewz/r-ui-renderer/stream`
(`createViewSpecParser().push(chunk)`, `parsePartialViewSpec(text)`, and `PENDING` /
`isPending` for the values still arriving).

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
means it conforms but something in it will be dropped, refused or will not work. Some
warnings leave a diagnostic where the document asked for something (a component that does
not exist, a missing icon, a sensitive component the host does not allow); their codes are
`BLOCKING_CODES`, and `renderable` is true only when there is no error and none of those.

Pass `origin`, and the same `policy` you give the view (see [The host's policy](#the-hosts-policy)),
so the validator judges URLs and sensitive inputs as your page will. The other options of
`ValidateOptions`: `strict` (any warning makes `ok` false), `contracts` and `components` (see
[Custom components](#custom-components)), `iconNames` (your icon set's names) and `classes`
(your class vocabulary, or `false`).

### Generate, validate, regenerate

`formatIssuesForModel` turns the issues into feedback a model can act on: errors first, one
line each, with the JSON Pointer and the fix. Loop until the document is `renderable`, not
just `ok`: a document that names a component that does not exist conforms, but shows a
diagnostic in its place.

```ts
// server/generate-view.ts
import { formatIssuesForModel, validateViewSpec, type ViewSpec } from "@batthewz/r-ui-renderer/spec";

export interface Turn {
  readonly role: "user" | "assistant";
  readonly content: string;
}

/** Asks `model` for a view until one renders as written, feeding each attempt's issues back. */
export async function generateView(
  model: (turns: readonly Turn[]) => Promise<string>,
  request: string,
  attempts = 3,
): Promise<ViewSpec> {
  const turns: Turn[] = [{ role: "user", content: request }];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const text = await model(turns);
    const result = validateViewSpec(text, { origin: "https://app.example.com" });
    if (result.ok && result.renderable) return result.spec;
    turns.push({ role: "assistant", content: text }, { role: "user", content: formatIssuesForModel(result.issues) });
  }
  throw new Error(`No renderable view after ${attempts} attempts.`);
}
```

To regenerate on every warning, pass `strict: true` and loop until `ok`.

### An HTTP endpoint

`createValidationHandler` is a fetch-style `(Request) => Promise<Response>`. It takes
`validateViewSpec`'s options (`origin`, `policy`, `strict`, …) and `maxBytes`. POST a
document as the body; the reply is a `ValidationResponseBody`, `{ ok, renderable, issues,
feedback, spec }`, with `spec` (the parsed document, its code fence stripped) only when `ok`.
The status is 200 either way, 405 for another method, and 413 past `maxBytes` (1 MiB by default):

```ts
// server/validate.ts
import { createValidationHandler } from "@batthewz/r-ui-renderer/spec";

export const validate = createValidationHandler({ origin: "https://app.example.com" });
```

It mounts in any server that speaks `Request` and `Response`. Give it the whole route, since
it answers other methods itself: `Bun.serve({ routes: { "/validate": validate } })`, or a
framework route's handler.

### The command line

`r-ui-validate` takes a file, `--raw` text or standard input:

```sh
npx r-ui-validate view.json                         # a file
my-generator | npx r-ui-validate --format model     # stdin; feedback for the model
npx r-ui-validate view.json --strict --format json  # CI: warnings fail too, machine output
npx r-ui-validate view.json --origin https://app.example.com --allow-origin https://cdn.example.com
```

A document with a missing title and a misspelt component:

```console
$ npx r-ui-validate --raw '{"version":2,"root":{"component":"Stak","children":["Hi"]}}'
error  (document)  missing-key: Missing `title`.
warning  /root/component  unknown-component: No component is registered as `Stak`.
    "Stack"
1 error(s), 1 warning(s)
```

`--format json` prints the endpoint's `ValidationResponseBody`; `--format model` prints
`formatIssuesForModel`'s feedback.

| Exit | Means |
| --- | --- |
| 0 | valid (warnings are printed but pass, unless `--strict`) |
| 1 | not valid, or warnings under `--strict` |
| 2 | usage or input error: a bad flag, an unreadable file, no document or an empty one |
| 3 | `r-ui-validate` itself failed; the document was not judged |

The flags mirror what the host gives the view: `--origin <url>` is the page's origin,
`--allow-origin <url>` (repeatable) another origin its policy allows requests and images
from, `--allow-sensitive` its `allowSensitive: true`, `--no-theme-overrides` its
`themeOverrides: false`, `--icons <file|list>` its icon names,
and `--contracts <file>` its own components (see [Custom components](#custom-components)).
It runs on Node 22 or later, and on bun. Working in this package's repository,
`bun run validate --raw '…'` runs it from source.

## Prompt a model with the reference

The model needs to know the format and the components. `renderViewSpecReference` returns
VIEWSPEC.md as a string, ready for a system prompt, and `include` narrows it to the components
a task needs (a part brings its root, and a root brings its parts). `./examples` holds whole
documents a model can learn from, as the text it should write:

```ts
// server/prompt.ts
import { exampleText } from "@batthewz/r-ui-renderer/examples";
import { renderViewSpecReference } from "@batthewz/r-ui-renderer/reference";

export const reference = renderViewSpecReference({
  include: ["Stack", "Grid", "Card", "StatCard", "DataTable", "StatusLabel", "LineChart", "Badge", "Heading", "Text", "Icon"],
});

/** One worked example for a few-shot prompt. */
export const example = exampleText("ops-dashboard");
```

The whole reference is about 96 KB. The scope above is about 55 KB: the prose, the class
vocabulary, the icon names and the not-addressable table stay whole, because a model writes
better documents when it knows the rules and what it cannot use. `propLimit` cuts each
component's prop list, at a cost: a hidden prop is one the model then invents.
`describeProps` adds each prop's one-line description, which is worth it for a narrow scope.
A host with its own components passes `contracts` (see [Custom components](#custom-components)),
and `iconNames` for its own icon set. To place the generated tables in prose of your own,
`renderReferenceRegions` returns each region alone, and `scopeContracts` narrows a contract
set as `include` does.

`EXAMPLES` holds every document by name (`PRODUCT_EXAMPLES`, pages a real product could ship,
and `COVERAGE_EXAMPLES`, which together name every addressable component). `exampleSpec(name)`
returns one parsed and validated, `exampleText(name)` as JSON text, and `isExampleName`
narrows a string to an `ExampleName`. `./examples` has no React in it.

To constrain a model's structured output instead, `@batthewz/r-ui-renderer/schema.json` is the
format as JSON Schema, and `@batthewz/r-ui-renderer/zod` exports it as `viewSpecSchema`. Both
agree with `validateViewSpec` on what is an error; the warnings exist only in the validator.

## The host's policy and adapters

A document can ask for data, a request, a page change, a toast, images and sensitive inputs,
but only the host decides what it may reach (the `policy`) and carries out what it asks
(the `adapters`). **Nothing is requested without `fetch`**, and nothing navigates without
`navigate`:

```tsx
// src/HostedView.tsx
import { useToast } from "@batthewz/r-ui-react-components";
import { type HostPolicy, type RendererAdapters, ViewRenderer, type ViewSpec } from "@batthewz/r-ui-renderer";
import { icons } from "@batthewz/r-ui-renderer/icons";
import { useMemo } from "react";

const CDN = "https://cdn.example.com";

/** What a document may reach, beyond the page's own origin. */
const policy: HostPolicy = {
  allowImageUrl: (url) => url.origin === location.origin || url.origin === CDN,
  markdownImages: [`${CDN}/docs/`],
};

/** Mount it under the library's `<ToastProvider>`: `useToast` throws outside one. */
export function HostedView({ spec, go }: { spec: ViewSpec; go: (to: string) => void }) {
  const { toast } = useToast();
  const adapters = useMemo<RendererAdapters>(
    () => ({
      fetch: (url, init) => fetch(url, { ...init, credentials: "same-origin" }),
      navigate: (to) => go(to),
      toast,
    }),
    [go, toast],
  );
  return <ViewRenderer spec={spec} adapters={adapters} policy={policy} icons={icons} />;
}
```

### The host's policy

| `HostPolicy` member | Decides | When absent |
| --- | --- | --- |
| `allowUrl(url)` | where requests (`api` bindings, `apiCall`) and `navigate` may go | the page's own origin only |
| `allowImageUrl(url)` | every image a document makes the browser load, at any depth | the page's origin, or a `data:` raster image |
| `markdownImages` | the URL prefixes Markdown may show images from | none: Markdown shows the alt text |
| `allowSensitive` | `PasswordInput`, `OTPInput`, and any control a value makes ask for a password, a one-time code or card details: `true`, or a list of component names | `false` |
| `themeOverrides` | a document's `theme`: `false` ignores it, a list of colour roles (`["--C-ACCENT", "--C-ACCENT-HOVER"]`) lets only those through, along with its `scheme` | `true`: every colour role |

Every URL is resolved first and judged on the result, so `//evil.example` and
`/\evil.example` are other origins, not paths. Links the document renders are judged by
scheme only (any origin), and go through the library's `RouterProvider` when you mount one
above the view.

The same object goes to the validator, so its warnings say what the view will do:
`validateViewSpec(text, { origin, policy })` and `createValidationHandler({ origin, policy })`.
The CLI spells it as flags (`--allow-origin`, `--allow-sensitive`, `--no-theme-overrides`). A policy is compared
member by member, so an inline object is fine.

### Adapters

| `RendererAdapters` member | Serves | When absent |
| --- | --- | --- |
| `fetch(url, init)` | `api` data bindings and the `apiCall` action, with the URL resolved and allowed | nothing is sent; `missing-adapter` |
| `resolveSource(request, signal)` | `source` data bindings: named data your app supplies (`SourceRequest`) | `missing-adapter` |
| `navigate(to, { replace })` | the `navigate` action, with `to` as an absolute URL that `allowUrl` has passed | nothing navigates; `missing-adapter` |
| `toast(request)` | the `showToast` action (`ToastRequest`; `useToast().toast` fits as is) | `missing-adapter`; the actions after it still run |

To let a document navigate the page itself, pass `navigate: (to) => location.assign(to)`. A
client-side router takes what follows the origin: `url.pathname + url.search + url.hash` of
`new URL(to)`.

## Theme, density and locale

The host owns all three. A view wears the page's theme (`<html data-theme="…">`, as the CSS
package describes), and `data-theme` or `data-input` on a node is dropped.

A document may recolour its own view with `theme`: a `scheme` and any of the CSS package's
colour roles (`--C-CANVAS`, `--C-TEXT-PRIMARY`, `--C-ACCENT`, …), as colours in a strict
grammar. The roles land as custom properties on the view root, so the view and its popovers,
menus, tooltips and dialogs (which render inside it) take them, and nothing outside the view
changes. A themed view paints its own canvas and text colour; one without a theme stays
transparent. Print and forced colours set the document's roles aside, as they do any theme's.

Before anything paints, the view measures its final palette (your theme's roles with the
document's over them) against the same contrast floors your themes meet. If one floor the
document's roles take part in falls short, **none of the theme applies**: the view keeps your
theme, and each shortfall is reported as a `theme-contrast` warning in `onIssue` and the
view's issue list, naming both roles and the ratio:

```json
{
  "code": "theme-contrast",
  "path": "/theme/tokens/--C-TEXT-MUTED",
  "severity": "warning",
  "message": "Below the contrast contract: `--C-TEXT-MUTED` on `--C-SURFACE-2` is 3.21:1 (the floor is 4.5:1). The whole theme is refused; the host's theme stands."
}
```

The view measures again when anything on `<html>` changes (switching your theme), so a theme
that held under one host theme is refused under one where it no longer does. A refusal holds
for the rest of that document, as its report (delivered once) says, even if you switch back. The validator
checks the floors whose roles the document sets on both sides; it cannot know your palette.

To keep every view in your theme, set `themeOverrides: false` in the policy (the CLI's
`--no-theme-overrides`): the document's `theme` is ignored, with a `theme-disabled` warning.
A list of roles narrows it instead.

Density is the one axis a document may suggest. Your `density` prop wins over the document's
root `"density"`. A node's own `"data-density"` still sets the density of its subtree either
way, as it does anywhere in the library:

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
| requests another origin, navigates to one, or loads an image from one (a tracking pixel) | nothing sent, followed or loaded, unless the policy's `allowUrl` / `allowImageUrl` allows it | `refused-url` |
| asks for data or calls an API when the host gave no `fetch` | nothing sent | `missing-adapter` |
| sets `dangerouslySetInnerHTML`, `srcDoc`, `style`, `formAction`, `ping`, `ref`, `key`, a namespaced name (`xlink:href`) or an `on…` string | the prop dropped | `forbidden-prop` |
| writes `__proto__`, `constructor` or `prototype` as a prop, a path segment or a name | the prop dropped; the path or name is an error; nothing on a prototype is ever read | `forbidden-prop`, `invalid-ref`, `invalid-name` |
| writes a DOM `id`, an `aria-*` id reference or a form control's `name` | dropped; Fields wire their own ids, so two views never collide | `forbidden-prop` |
| sets a theme name (`data-theme` on a node, or a string as `theme`) | the attribute dropped; the string is an error | `forbidden-prop`, `invalid-type` |
| sets a `theme` role outside the colour roles, or a colour outside the grammar (`var()`, `url()`, `calc()`, a colour name) | an error; the view refuses the whole theme | `unknown-key`, `invalid-value` |
| sets a `theme` palette below the contrast contract (light text on a light surface) | the whole theme refused before it paints; the host's theme stands | `theme-contrast` |
| chooses an element (`as`, a heading level) outside the component's list | the prop dropped | `invalid-prop-value` |
| asks for `PasswordInput` or `OTPInput`, or gives a control a password `type` or a password, one-time-code or card `autoComplete` | a diagnostic, unless the policy's `allowSensitive` allows it | `sensitive-component` |
| nests nodes past 50 deep, or chains handlers past 5 | a diagnostic; the excess is not rendered or run | `limit-exceeded` |
| nests arrays and objects past 256 levels | the whole document refused, never walked recursively | `too-deep` |
| names a component that does not exist, or one that throws | a diagnostic in place | `unknown-component`, `render-error` |
| is malformed, truncated or cut off mid-stream | the parse error with its line and column; a stream keeps what it showed | `invalid-json`, `stream-incomplete` |

Request endpoints, methods and `into` targets are read as written, never from fetched data,
so data a request returns cannot decide where the next one goes.

### Finding what went wrong

Every diagnostic is a DOM element with the class `r-renderer-diagnostic`, a severity class,
`data-code` and `data-path`. Issues with no place to show (a failed request) sit in a hidden
list inside the view, so each one is queryable exactly once. `RENDERER_CLASSES` names every
class the renderer puts on its own elements: the view root, the diagnostics, the pending
placeholder and the built-ins.

```tsx
<ViewRenderer spec={spec} icons={icons} diagnostics="hidden" onIssue={(issue) => log(issue)} onValidation={(result) => log(result)} />
```

- `diagnostics="hidden"` keeps every diagnostic in the DOM but out of sight, for a page your
  users see. `"show"` is the default.
- `onIssue` receives every `Issue` found while rendering and running.
- `onValidation` receives `validateViewSpec`'s `ValidationResult` once per completed
  document, judged as the view sees it: its registry, contracts, icons, origin and policy.
  The validator loads only when you pass it. It runs again when `registry` or `contracts`
  is a new object, so keep those as module constants or memoise them.
- In a test, `findDiagnostics(container)` lists them all as `FoundDiagnostic`s, hidden ones
  included.

## Entry points

| Import | Exports | React |
| --- | --- | --- |
| `@batthewz/r-ui-renderer` | `ViewRenderer`, `useViewSpecStream`, `defaultRegistry`, `extendRegistry`, `defaultContracts`, `extendContracts`, `findDiagnostics`, `RENDERER_CLASSES`, everything in `/stream`, and the format's types | yes (`"use client"`) |
| `@batthewz/r-ui-renderer/spec` | `validateViewSpec`, `formatIssuesForModel`, `createValidationHandler`, `defaultContracts`, `extendContracts`, `contractFor`, `NOT_ADDRESSABLE`, `stripCodeFence`, the policy and the format (below) | no |
| `@batthewz/r-ui-renderer/stream` | `createViewSpecParser`, `parsePartialViewSpec`, `PENDING`, `isPending`, `stripCodeFence` | no |
| `@batthewz/r-ui-renderer/reference` | `renderViewSpecReference`, `renderReferenceRegions`, `scopeContracts` | no |
| `@batthewz/r-ui-renderer/examples` | `EXAMPLES`, `PRODUCT_EXAMPLES`, `COVERAGE_EXAMPLES`, `exampleSpec`, `exampleText`, `isExampleName` | no |
| `@batthewz/r-ui-renderer/icons` | `icons`, the curated lucide set | lucide |
| `@batthewz/r-ui-renderer/zod` | `viewSpecSchema` | no (needs `zod`) |
| `@batthewz/r-ui-renderer/schema.json` | the format as JSON Schema | no |
| `@batthewz/r-ui-renderer/styles` | the renderer's CSS and the class vocabulary | |
| `r-ui-validate` | the CLI | no |

`/spec` also exports what the renderer and the validator both read, for a host or a prompt
builder that needs the same facts:

- the policy: `LIMITS`, `FORBIDDEN_PROPS`, `isForbiddenProp`, `URL_PROPS`, `IMAGE_URL_PROPS`,
  `ID_REFERENCE_PROPS`, `DATA_ATTRIBUTE_PATTERN`, `DROPPED_DATA_ATTRIBUTES`, `safeUrl`,
  `resolveUrl`, `defaultAllowUrl`, `defaultAllowImageUrl`;
- the vocabularies: `CLASS_VOCABULARY`, `ICON_NAMES`;
- the format's closed sets: `FORMAT_VERSION`, `DOCUMENT_KEYS`, `COMPONENT_NODE_KEYS`,
  `EACH_NODE_KEYS`, `COND_NODE_KEYS`, `NAME_PATTERN`, `FORBIDDEN_SEGMENTS`, `REF_ROOTS`,
  `DENSITIES`, `COMPARISON_OPERATORS`, `HANDLER_KEY_PATTERN`, `ACTION_NAMES`,
  `LITERAL_PAYLOAD_KEYS`, `HTTP_METHODS`, `TOAST_TONES`, `BINDING_TYPES`, `BINDING_STATUSES`,
  `FIELD_TYPES`, `VALIDATION_TRIGGERS`, `RULE_NAMES`, `FORMAT_STYLES`, `TEXT_ELEMENTS`,
  `TEXT_SIZES`, `TEXT_TONES`, `TEXT_WEIGHTS`, `HEADING_LEVELS`, `HEADING_SIZES`,
  `DATE_KINDS`, `EVENT_VALUE_KINDS`, `CHILD_INSPECTIONS`, `THEME_SCHEMES`, `THEME_KEYS`, and
  `THEME_TOKENS` (each colour role a `theme` may set, with what it paints);
- the issues: `ISSUE_CODE_INFO`, `ISSUE_CODES`, `RUNTIME_ISSUE_CODES`, `BLOCKING_CODES`.

The types that go with them (`ViewSpec`, `ViewNode`, `ThemeSpec`, `ThemeScheme`, `ThemeToken`,
`Issue`, `IssueCode`, `HostPolicy`, `ComponentContract`, `ComponentContracts` and the rest of
the format) come from `/spec`, and
as types from the package root too. The root adds `ViewRendererProps`, `RendererAdapters`,
`ComponentRegistry` and `IconSet`.

## License

MIT
