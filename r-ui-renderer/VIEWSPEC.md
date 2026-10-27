# ViewSpec reference

Format version 2. A ViewSpec is one JSON object describing a view built from `@batthewz/r-ui-react-components`, rendered by `@batthewz/r-ui-renderer`. Write JSON only: no comments, no trailing commas. A surrounding Markdown code fence is tolerated.

The prose is hand-written. Regions between `<!-- GENERATED:… -->` markers are generated from the library and the renderer's contracts; do not edit them by hand.

## Document

```jsonc
{
  "version": 2,                          // REQUIRED. Always 2.
  "title": "Service health",             // REQUIRED. 1–200 characters.
  "description": "…",                    // optional
  "density": "compact",                  // optional: "comfortable" | "compact"
  "theme": { "scheme": "dark", "tokens": {…} }, // optional: this view's colours (see Theme)
  "state": { "page": 1 },                // optional: seeds `state.…`
  "data": { "services": DataBinding },   // optional
  "forms": { "contact": FormDef },       // optional
  "root": ViewNode                       // REQUIRED, and written LAST
}
```

No other keys (an editor's `"$schema"` is allowed and ignored). There is no `locale` and no theme name: the host owns the locale and the theme, and `theme` only recolours this view.

**Names** (data bindings, state keys, forms, form fields, `$each` aliases, dialog ids) match `^[A-Za-z_][A-Za-z0-9_]*$`. `__proto__`, `constructor` and `prototype` are never names or path segments. `data`, `status`, `state`, `forms` and `event` are reserved: no alias may use them.

## Streaming order

The renderer can draw a document while it arrives, so write keys in this order:

- top level: `version`, `title`, `description`, `density`, `theme`, `state`, `data`, `forms`, then `root` **last**;
- component node: `component`, `props`, `children`;
- `$each`: `$each`, `as`, `key`, `node`;
- `$cond`: `$cond`, `then`, `else`.

What shows, and when:

- A component node appears once its `component` name is complete and its `props` object has closed (a node written without `props` appears when its `children` begin); its children then stream in, and a text child may appear character by character. No half-written prop ever reaches a component.
- A `$each` appears once `$each`, `as` and (when written) `key` have closed; a `$cond` once its condition has closed. Their `node`, `then` and `else` then stream like any node. A `$ref` or `$format` node appears once it has closed.
- Out-of-order keys still render, and the validator warns (`key-order`). A key that arrives before its object could show (`children` before `component`) holds the whole object back until it closes. A key that arrives after it has shown (`props` after `children`, `key` after `node`) cannot reach what is already mounted: the object shows without it, then remounts once when the key closes, losing anything a user did to it meanwhile, and ends as the whole document renders. A `$node` inside props holds back that whole prop until it closes.
- `theme`, `state`, `data` and `forms` take effect when their objects close (a half-written palette never shows); until its binding has closed, `status.<name>` is `"loading"`.
- Nothing runs until the whole document has arrived: actions do nothing, and a form's submit does nothing at all (no validation, no state change).
- A node still arriving shows nothing, or a Skeleton when the host asks for one. A stream that ends early keeps what it showed and reports `stream-incomplete`.

## Nodes

A `ViewNode` is one of:

| Shape | Renders |
| --- | --- |
| `"Hello"` | the text, as written |
| `{ "component": "Card", "props": {…}, "children": [ViewNode, …] }` | a component |
| `{ "$ref": "data.user.name" }` | the value, as text |
| `{ "$format": { "value": …, "style": "currency", … } }` | the value, formatted (see Formatting) |
| `{ "$each": "data.rows", "as": "row", "key": "id", "node": ViewNode }` | `node` once per element |
| `{ "$cond": Condition, "then": ViewNode, "else": ViewNode }` | one branch (`else` optional) |

- `component` names a registered component or a compound part by dot path: `"Card.Header"`, `"Tabs.Panel"`. A part belongs inside its parent.
- `children` is always an array. `props` and `children` are optional.
- A `$ref` or `$format` node renders strings and numbers; `null`, `false` and a missing value render nothing; anything else (`true`, an object, an array) renders nothing and reports `not-renderable`. Numbers render as written; use `$format` for locale formatting.
- Nothing else is a node: no numbers, `null` or bare objects in `children`.

## Values in props

A prop holds JSON, or one of these markers. A marker is an object whose **only** key is the marker's; anything with other keys beside it is data.

```jsonc
{ "$ref": "data.user.name" }                                 // the value at a path
{ "$format": { "value": { "$ref": "row.cost" }, "style": "currency", "currency": "EUR" } }  // formatted text
{ "$concat": ["mailto:", { "$ref": "person.email" }] }       // one string built from parts
{ "$node": { "component": "Badge", "children": ["New"] } }   // a node where a component takes one
{ "action": "showToast", "payload": { "title": "Saved" } }   // a handler (on…  props only)
```

- **Markers resolve anywhere** inside props, at any depth, including inside arrays and objects.
- **`$concat`** joins its parts into one string, with nothing between them. A part is text, a number, a boolean, or a `$ref` or `$format` marker that resolves to one of those; when a part resolves to anything else (missing, `null`, an object), the whole value is missing and the prop is left out. It works in props and in action payloads, never as a node. URL and image rules judge the joined string, so `"java"` and `"script:…"` joined are refused like the literal.
- **Handlers** are values under keys spelled `on` + capital (`onClick`, `onValueChange`, `onSelect`), at any depth. A handler is one action (`{ "action", "payload" }` and no other key) or a non-empty array of them. Under an `on…` key, an object with an `action` key, alone or in an array, must be a valid handler (an error otherwise); anything else there is dropped (`forbidden-prop`). An action object under any other key is ordinary data.
- **Text or a node.** A prop the component takes as a React node accepts a string directly (`"header": "Revenue"`) or a `$node`.
- **Row templates.** Some props take a template that the component calls per row (a DataTable column's `cell`, `rowActions`, `renderDetail`, `bulkActions`). Write them as `$node`; the names in scope are listed per component (`row`, `rowIndex`, `value`, `selectedKeys`).
- **Icons.** A prop the component takes as an icon accepts an icon name string (`"icon": "check"`). Unknown names render a missing-icon diagnostic.
- **Dates.** A prop the component takes as a `Date` accepts ISO text: `"2026-11-02"` is that calendar date, local; `"2026-11-02T09:30:00Z"` (or with an offset) is that instant; without an offset it is local time. Impossible dates (`"2026-02-30"`) are refused. A date range is `{ "start": "…", "end": "…" }`.
- **Sets.** A prop the component takes as a `Set` accepts an array.
- **Formatters.** A prop the component takes as a formatting function (`format`, `formatTick`, `formatDelta`) accepts a FormatSpec.
- **Refs.** A prop the component takes as a React ref (`initialFocus`) takes only what it accepts besides a ref (a number), or nothing; anything else is dropped.

## References

A `$ref` path is `root.segment.segment…`. Segments are separated by `.`; an array element is its position (`data.rows.0.name`); `length` reads an array's or a string's length. A missing step resolves to nothing, never an error, and nothing on a prototype is ever reached.

| Root | Reads |
| --- | --- |
| `data.<name>` | a data binding's value (nothing until it has loaded) |
| `status.<name>` | a data binding's status: `"loading"`, `"ready"` or `"error"` |
| `state.<key>` | runtime state, seeded by `state` and written by `setState` |
| `forms.<form>.values.<field>` | a field's current value |
| `forms.<form>.errors.<field>` | a field's shown error message, if any |
| `forms.<form>.submitting` / `.dirty` / `.submitCount` / `.submitFailed` | the form's state |
| `event.value`, `event.args.<n>` | inside a handler only: what the component reported (see Actions) |
| an `$each` alias, `<alias>Index` | inside `node`: the element and its position |
| `row`, `rowIndex`, `value`, `selectedKeys` | inside a row template, as listed per component |

There is no shorthand: a path always starts with one of these roots. An inner `$each` may reuse an outer alias; the inner one wins inside it.

## Conditions

```jsonc
"$cond": "data.rows"                                  // truthy?
"$cond": { "not": "state.collapsed" }
"$cond": { "ref": "state.tab", "eq": "billing" }
"$cond": { "ref": "row.status", "in": ["failed", "degraded"] }
"$cond": { "ref": "data.summary.errors", "gt": 0 }
```

- A path alone is **truthy** unless its value is missing, `null`, `false`, `0`, `NaN`, `""` or an **empty array**. An empty object is truthy.
- A comparison has `ref` and exactly one operator: `eq`, `ne` (strict equality, deep for arrays and objects), `gt`, `lt` (both numbers, or both strings compared as text, which orders ISO dates correctly; anything else is false), `in` (the value is an element of the array). The operand may be a `{ "$ref": … }`.
- `not` takes any condition. There is no `and`/`or`: nest `$cond` nodes.

## Lists (`$each`)

`$each` names an array; `node` renders once per element with `<as>` and `<as>Index` in scope. A value that is not an array renders nothing and reports `not-renderable`; an empty array renders nothing (pair it with a `$cond` on the same path for an empty state).

**Keys.** `key` is a path inside the element (`"id"`, `"meta.slug"`) whose value identifies it, so an element keeps its state when the list re-orders. Without `key`, or when a key is missing or repeated, the position is used and a repeated key reports `duplicate-key`. The elements render as siblings in the parent: `$each` adds no element of its own, so a parent that counts or reads its children sees each one.

## Actions

```jsonc
"onClick": { "action": "openDialog", "payload": { "dialogId": "editService" } }
"onClick": [
  { "action": "setState", "payload": { "path": "state.selected", "value": { "$ref": "row.id" } } },
  { "action": "openDialog", "payload": { "dialogId": "details" } }
]
```

A list runs in order, each action awaited; one that fails stops the rest. A `submitForm` on an invalid form fails quietly: the form shows its errors and the rest of the list does not run. An `apiCall` without the host's `fetch` reports `missing-adapter` and fails; a `showToast` without the host's toast reports `missing-adapter` and the list carries on. Payload values resolve `$ref`, `$format`, `$concat` and `event` at the moment the handler runs, except the **literal** keys in the table, which are read as written so that fetched data never decides what the view does or where a request goes.

| Action | Payload | Effect |
| --- | --- | --- |
| `setState` | **`path`**, `value`, **`replace`** | writes `value` at `path` (`"state.filters.region"`); missing objects on the way are created. When the current and the new value are both plain objects they merge shallowly; otherwise the value is replaced. `"replace": true` replaces a plain object too, so a key the new value lacks is gone (store a component's whole record value this way). Set a key to `null` to clear it. |
| `submitForm` | **`form`** | validates the form, then runs its `onSubmit` |
| `resetForm` | **`form`** | back to the initial values (re-reading any that `$ref` data), errors cleared |
| `navigate` | `to`, **`replace`** | through the host's navigation, which may not exist (`missing-adapter`); `to` must pass the URL rules (Safety) and is relative or same-origin unless the host allows more |
| `showToast` | `title`, `description`, **`tone`** | a toast through the host; `tone`: `neutral`, `success`, `warning`, `error`, `info`, `serious`, `stale` |
| `apiCall` | **`endpoint`**, **`method`**, `query`, `body`, **`into`**, **`onSuccess`**, **`onError`** | a request through the host's `fetch` (see Network) |
| `openDialog` / `closeDialog` | **`dialogId`** | opens or closes the dialog component whose `dialogId` prop matches |

**`apiCall`.** `method` is `GET` (default), `POST`, `PUT`, `PATCH` or `DELETE`. `query` becomes the query string (see Network for its values); `body` is sent as JSON (not with `GET` or `DELETE`). The response is parsed as JSON when it says so, else as text. `into` (`"state.result"`) stores it, replacing what was there (no merge). `onSuccess` runs with `event.value` = the response; `onError` with `event.value` = `{ "status": number | null, "message": string, "body": … }`, and then the call fails (a form waiting on it stays unsubmitted). A failure with no `onError` reports `action-failed`; with one, the handler is the report. When an `apiCall` that a form's `onSubmit` ran fails with a body of the shape `{ "errors": { "<field>": "message" } }`, those messages show on the form's fields.

**`event`.** Inside a handler, `event.value` is the first thing the component reported, made JSON: a DOM event becomes its control's value (`checked` for a checkbox or radio), a Set an array, a date `"YYYY-MM-DD"` (an instant: ISO with its offset), a date range `{ "start", "end" }`. `event.args.0`, `event.args.1`… are every argument, made JSON the same way. `event` is not carried into `onSuccess`/`onError`, which get their own. Prefer a component's uncontrolled seed (`defaultValue`, `defaultOpen`) where it has one: it needs no state at all.

`onSuccess`/`onError` may nest up to 5 deep; a list holds at most 10 actions.

## Data

```jsonc
"data": {
  "summary":  { "type": "static", "value": { "uptime": 0.9993 } },
  "services": { "type": "api", "endpoint": "/api/services", "query": { "region": { "$ref": "state.region" } } },
  "incidents": { "type": "source", "source": "incidents", "params": { "open": true } }
}
```

- `static`: the `value` as written; markers inside it are data.
- `api`: requested through the host's `fetch` when the binding has closed. `method` `GET` (default) or `POST`; `query` and `body` may `$ref` **`state.…` only**, and the request repeats when one of those values changes.
- `source`: handed to the host's `resolveSource` with `params` resolved (`state.…` refs only, as above).

While a binding first loads, `data.<name>` is missing and `status.<name>` is `"loading"`; when it loads again (a `state` value it reads changed) the last value stays on show while the status is `"loading"`. On failure `status.<name>` is `"error"`, `data.<name>` is missing and the view reports `data-error`. A binding that cannot start (no `fetch` or `resolveSource` from the host, a refused endpoint) is `"error"` at once and reports `missing-adapter` or `refused-url` instead. A view usually draws a Skeleton under `{ "$cond": { "ref": "status.services", "eq": "loading" } }`.

## Forms

```jsonc
"forms": {
  "contact": {
    "fields": {
      "name":  { "rules": { "required": true }, "message": "Tell us your name." },
      "email": { "rules": { "required": true, "pattern": "^[^@\\s]+@[^@\\s]+$" } },
      "seats": { "type": "number", "initialValue": 5, "rules": { "min": 1, "max": 500 } },
      "start": { "type": "date", "initialValue": { "$ref": "data.plan.renewsOn" } },
      "terms": { "type": "boolean", "rules": { "required": true }, "message": "Accept the terms to continue." }
    },
    "validateOn": "blur",
    "onSubmit": { "action": "apiCall", "payload": { "endpoint": "/api/contact", "method": "POST", "body": { "$ref": "event.value" } } }
  }
}
```

- **Field types:** `text` (default, `""`), `number` (`null`), `boolean` (`false`), `date` (`null`, ISO text), `dateRange` (`null`, `{ "start", "end" }`), `list` (`[]`, an array of strings). Field keys are names: no dots, no nesting.
- **Rules**, checked in this order, the first failure being the field's error: `required` (empty is `null`, `""`, `false`, `[]`, and a date range missing either end; so a required boolean must be true), `minLength`/`maxLength` (characters of text, items of a list), `pattern` (text; tested on at most 1000 characters, a longer value fails), `min`/`max` (numbers for number fields; ISO dates for date fields). `message` replaces every rule's default message; `messages: { "pattern": "…" }` replaces one. A rule the field's type ignores, a `pattern` that does not compile or could backtrack without end (a quantifier inside or beside another unbounded one, `(a+)+`; a backreference), or a date bound that is not an ISO date is `unusable-value`. Such a `pattern` fails every value, so its field never passes.
- `validateOn` / `revalidateOn`: `change`, `blur` or `submit`.
- `onSubmit` runs only when the form is valid, with `event.value` = the values as JSON (dates as ISO text). `onInvalid` runs otherwise, with `event.value` = the errors by field. When `onSubmit` fails, a response `{ "errors": { "<field>": "message" } }` shows on those fields; any other failure shows as the form's own error. Either way `submitFailed` is true.
- A form does not submit until the whole document has arrived (Streaming order).
- `initialValue` may `$ref` data or state; the form then waits until it resolves (or its binding fails) and keeps its values from then on. `resetForm` reads it again.

**Placing a form.** Put the `<form>` where the fields are, and bind each control with a `Field` named after the field:

```jsonc
{ "component": "Form", "props": { "form": "contact" }, "children": [
  { "component": "Field", "props": { "name": "email" }, "children": [
    { "component": "Field.Label", "children": ["Email"] },
    { "component": "Input", "props": { "type": "email" } },
    { "component": "Field.Error" } ] },
  { "component": "FormActions", "children": [ { "component": "FormActions.Submit", "children": ["Send"] } ] } ] }
```

The control inside a `Field` reads and writes the field through the Field: give it **no** `value`, `checked` or `defaultValue` (that would detach it; `controlled-in-field`). Labels, descriptions and errors wire themselves. Read values anywhere with `forms.contact.values.email`. A form's fields belong inside its `Form`.

## Formatting

`$format` and every formatter prop take a **FormatSpec**: a style name, or the style with options.

| Style | Formats | Example |
| --- | --- | --- |
| `number` | a number | `1234.5` → "1,234.5" |
| `integer` | a number, no fraction | `1234.5` → "1,235" |
| `compact` | a number, short | `1234567` → "1.2M" |
| `percent` | a **ratio** | `0.123` → "12.3%" (for points use `unit` + `"percent"`) |
| `delta` | a signed change | `3` → "+3" |
| `bytes` | a byte count | `1536` → "1.5 kB" |
| `currency` | an amount; needs `currency` (ISO 4217) | `{ "style": "currency", "currency": "EUR" }` |
| `unit` | a measure; needs `unit` (an Intl unit) | `{ "style": "unit", "unit": "millisecond" }` |
| `date`, `datetime`, `time` | ISO text or a timestamp | `dateStyle` / `timeStyle`, `timeZone`: `"local"` (default) or `"UTC"` |

`currency` without `currency`, or `unit` without `unit`, is an error. A code Intl does not know (`"EURO"`, `"furlong"`) is `unusable-value`, and so is `minimumFractionDigits` above `maximumFractionDigits` where they apply (a number style other than `integer`, without `maximumSignificantDigits`, which takes over from them): the value then formats as a plain number.

Options: `notation` (`standard`, `compact`), `minimumFractionDigits`, `maximumFractionDigits`, `maximumSignificantDigits`, `signDisplay` (`auto`, `always`, `exceptZero`, `negative`, `never`), `currencyDisplay`, `unitDisplay`, `useGrouping`, `dateStyle`, `timeStyle` (`full`, `long`, `medium`, `short`), `timeZone`, `missing` (text for a missing value, "—" by default). The locale is always the host's.

## DataTable columns

`columns` is an array of:

```jsonc
{ "id": "cost",                       // REQUIRED; sort state and filters name the column by it
  "header": "Cost / mo",              // text or $node; the id when absent
  "field": "billing.monthly",         // dot path into the row; the id when absent
  "format": { "style": "currency", "currency": "USD" },   // display only: sort and filters read the raw value
  "cell": { "$node": … },             // a row template: row, rowIndex, value
  "numeric": true, "sortable": true, "firstDirection": "desc", "priority": 2,
  "truncate": true, "required": false, "resizable": true,
  "width": "…", "minWidth": "…", "maxWidth": "…",   // CSS lengths
  "label": "…",
  "filter": { "type": "text", "placeholder": "…" }   // or { "type": "select", "options": [{ "value", "label" }] }
}
```

No other column key exists; one is dropped (`unknown-prop`). `rowKey` is a field path (`"id"`) whose value identifies a row; without it, or on a missing or repeated value, the row's position is used. `rowActions`, `renderDetail` and `bulkActions` are row templates.

## Built-in components

The renderer provides three components the library leaves to the page. They are styled with tokens only.

| Component | Props | Renders |
| --- | --- | --- |
| `Text` | `as`: `p` (default), `span`, `strong`, `em`, `small`, `code`, `blockquote` · `size`: `body-1`, `body-2`, `body-3` (inherited when absent; 1 is the largest) · `tone` · `weight`: `normal`, `medium`, `semibold` · `className` | body text |
| `Heading` | `level`: 1–6 (default 2), the outline · `size`: `h1`–`h6`, the look (matches `level` when absent) · `tone` · `className` | `h1`–`h6` |
| `Icon` | `name` (required) · `label` · `tone` · `className` | the named icon at the density's icon size; decorative unless `label` names it |

`tone` is `primary`, `secondary`, `muted`, or a status ink: `error`, `success`, `warning`, `info`, `serious`, `stale`. A status colour never stands alone: pair it with an icon or a word.

## Styling

`className` styles a component's own outermost element; `classNames` styles its named inner parts (`{ "classNames": { "label": "…" } }`, keys per component). Both win over the component's own classes. Prefer a real prop (`variant`, `size`, `tone`, `gap`) where one exists.

**Only classes in the vocabulary work.** A class is CSS only if the host's stylesheet already contains it, and a document arrives long after that stylesheet was built, so any other class styles nothing, silently. The vocabulary is the design system's token utilities (spacing `p-r3`, `gap-r4`; type `text-body-2`, `text-h3`; colour `text-fg-secondary`, `bg-surface-1`; `rounded-md`, `shadow-sm`, `border`) and a short list of layout utilities. A Grid cell's span can step with the Grid's own width, as its `columns` map does: `@3xl:col-span-2` spans two columns from 48rem, one below (never a plain `col-span-2` in a grid that narrows to one column). There are no raw sizes or colours (`p-4`, `text-sm`, `bg-blue-500`, `w-[37%]`). The validator warns on any other class (`unknown-class`). Spacing steps run `r1` (largest) to `r6` (smallest).

<!-- GENERATED:classes -->
- `@2xl:col-span-2` `@2xl:col-span-3` `@2xl:col-span-4` `@2xl:col-span-5` `@2xl:col-span-6`
- `@3xl:col-span-2` `@3xl:col-span-3` `@3xl:col-span-4` `@3xl:col-span-5` `@3xl:col-span-6`
- `@4xl:col-span-2` `@4xl:col-span-3` `@4xl:col-span-4` `@4xl:col-span-5` `@4xl:col-span-6`
- `@5xl:col-span-2` `@5xl:col-span-3` `@5xl:col-span-4` `@5xl:col-span-5` `@5xl:col-span-6`
- `@lg:col-span-2` `@lg:col-span-3` `@lg:col-span-4` `@lg:col-span-5` `@lg:col-span-6`
- `@md:col-span-2` `@md:col-span-3` `@md:col-span-4` `@md:col-span-5` `@md:col-span-6`
- `@sm:col-span-2` `@sm:col-span-3` `@sm:col-span-4` `@sm:col-span-5` `@sm:col-span-6`
- `@xl:col-span-2` `@xl:col-span-3` `@xl:col-span-4` `@xl:col-span-5` `@xl:col-span-6`
- `aspect-square` `aspect-video`
- `bg-accent` `bg-accent-hover` `bg-canvas` `bg-primary` `bg-primary-active` `bg-primary-hover` `bg-scrim` `bg-selection` `bg-status-error` `bg-status-error-bg` `bg-status-info` `bg-status-info-bg` `bg-status-success` `bg-status-success-bg` `bg-status-warning` `bg-status-warning-bg` `bg-surface-0` `bg-surface-1` `bg-surface-2` `bg-surface-3`
- `border` `border-0` `border-accent` `border-b` `border-border` `border-border-strong` `border-e` `border-s` `border-status-error` `border-status-info` `border-status-success` `border-status-warning` `border-t` `border-x` `border-y`
- `col-span-1` `col-span-10` `col-span-11` `col-span-12` `col-span-2` `col-span-3` `col-span-4` `col-span-5` `col-span-6` `col-span-7` `col-span-8` `col-span-9` `col-span-full`
- `divide-border` `divide-border-strong` `divide-x` `divide-y`
- `flex` `flex-1` `flex-auto` `flex-col` `flex-none` `flex-nowrap` `flex-row` `flex-wrap`
- `font-display` `font-heading` `font-medium` `font-mono` `font-normal` `font-semibold` `font-ui`
- `gap-0` `gap-r1` `gap-r2` `gap-r3` `gap-r4` `gap-r5` `gap-r6` `gap-section-1` `gap-section-2` `gap-section-3` `gap-x-r1` `gap-x-r2` `gap-x-r3` `gap-x-r4` `gap-x-r5` `gap-x-r6` `gap-y-r1` `gap-y-r2` `gap-y-r3` `gap-y-r4` `gap-y-r5` `gap-y-r6` `gap-y-section-1` `gap-y-section-2` `gap-y-section-3`
- `grid` `grid-cols-1` `grid-cols-10` `grid-cols-11` `grid-cols-12` `grid-cols-2` `grid-cols-3` `grid-cols-4` `grid-cols-5` `grid-cols-6` `grid-cols-7` `grid-cols-8` `grid-cols-9`
- `h-control` `h-full` `h-row`
- `inline` `inline-block` `inline-flex`
- `items-baseline` `items-center` `items-end` `items-start` `items-stretch`
- `justify-between` `justify-center` `justify-end` `justify-start`
- `m-0` `m-r1` `m-r2` `m-r3` `m-r4` `m-r5` `m-r6`
- `max-w-column-lg` `max-w-column-md` `max-w-column-sm` `max-w-full` `max-w-measure` `max-w-page`
- `mb-r1` `mb-r2` `mb-r3` `mb-r4` `mb-r5` `mb-r6` `mb-section-1` `mb-section-2` `mb-section-3`
- `me-auto` `me-r1` `me-r2` `me-r3` `me-r4` `me-r5` `me-r6`
- `min-h-0` `min-h-control` `min-h-hit` `min-h-row` `min-w-0` `min-w-column-lg` `min-w-column-md` `min-w-column-sm` `min-w-hit`
- `ms-auto` `ms-r1` `ms-r2` `ms-r3` `ms-r4` `ms-r5` `ms-r6`
- `mt-r1` `mt-r2` `mt-r3` `mt-r4` `mt-r5` `mt-r6` `mt-section-1` `mt-section-2` `mt-section-3`
- `mx-auto` `mx-r1` `mx-r2` `mx-r3` `mx-r4` `mx-r5` `mx-r6`
- `my-r1` `my-r2` `my-r3` `my-r4` `my-r5` `my-r6` `my-section-1` `my-section-2` `my-section-3`
- `object-contain` `object-cover`
- `overflow-auto` `overflow-hidden` `overflow-x-auto` `overflow-y-auto`
- `p-0` `p-r1` `p-r2` `p-r3` `p-r4` `p-r5` `p-r6`
- `pb-r1` `pb-r2` `pb-r3` `pb-r4` `pb-r5` `pb-r6` `pb-section-1` `pb-section-2` `pb-section-3`
- `pe-gutter` `pe-r1` `pe-r2` `pe-r3` `pe-r4` `pe-r5` `pe-r6`
- `ps-gutter` `ps-r1` `ps-r2` `ps-r3` `ps-r4` `ps-r5` `ps-r6`
- `pt-r1` `pt-r2` `pt-r3` `pt-r4` `pt-r5` `pt-r6` `pt-section-1` `pt-section-2` `pt-section-3`
- `px-control-pad` `px-gutter` `px-r1` `px-r2` `px-r3` `px-r4` `px-r5` `px-r6`
- `py-r1` `py-r2` `py-r3` `py-r4` `py-r5` `py-r6` `py-section-1` `py-section-2` `py-section-3`
- `rounded-full` `rounded-lg` `rounded-md` `rounded-none` `rounded-sm` `rounded-xl`
- `self-center` `self-end` `self-start` `self-stretch`
- `shadow-lg` `shadow-md` `shadow-none` `shadow-sm`
- `size-full` `size-icon`
- `space-x-r1` `space-x-r2` `space-x-r3` `space-x-r4` `space-x-r5` `space-x-r6` `space-y-r1` `space-y-r2` `space-y-r3` `space-y-r4` `space-y-r5` `space-y-r6`
- `text-body-1` `text-body-2` `text-body-3` `text-center` `text-display-1` `text-display-2` `text-display-3` `text-display-4` `text-end` `text-fg-accent` `text-fg-error` `text-fg-info` `text-fg-inverse` `text-fg-muted` `text-fg-on-accent` `text-fg-on-error` `text-fg-on-info` `text-fg-on-primary` `text-fg-on-selection` `text-fg-on-success` `text-fg-on-warning` `text-fg-primary` `text-fg-secondary` `text-fg-success` `text-fg-warning` `text-h1` `text-h2` `text-h3` `text-h4` `text-h5` `text-h6` `text-prose-1` `text-prose-2` `text-prose-3` `text-start`
- `w-column-lg` `w-column-md` `w-column-sm` `w-full`
- `block` `break-words` `grow` `hidden` `italic` `no-underline` `place-items-center` `relative` `shrink-0` `sr-only` `tabular-nums` `truncate` `underline` `whitespace-nowrap`
<!-- /GENERATED:classes -->

## Theme

`theme` recolours this view and nothing else: the host's theme stands for every role the document leaves out, and the page around the view never changes.

```jsonc
"theme": {
  "scheme": "dark",                          // optional: "light" | "dark"
  "tokens": {                                // optional: colour role → colour
    "--C-CANVAS": "oklch(0.2 0.012 250)",
    "--C-TEXT-PRIMARY": "oklch(0.95 0.006 250)",
    …
  }
}
```

- **Colour roles only.** The keys are the roles listed below; anything else (`--SCHEME-DARK`, a size, a font, motion, a misspelt role) is an error. A value is `#rgb`, `#rrggbb`, or `rgb()`, `hsl()`, `oklch()`, `oklab()`, `lab()` or `lch()` with space-separated numbers (`oklch(0.62 0.13 250)`, `hsl(210 40% 20%)`), the function name in lower case; `none` is the only keyword. No `var()`, `calc()`, `color-mix()`, `url()`, commas or colour names. Alpha (`#rgba`, `#rrggbbaa`, `/ 0.4`) only on the roles marked translucent: every role a contrast floor measures is opaque.
- **`scheme`** sets the view's `color-scheme` (form controls, scrollbars) and `--SCHEME-DARK`, so the library's own colours (chart series, trend and status inks) take their light or dark values. Without it the host's scheme stands: a dark palette needs `"scheme": "dark"`, or it is refused on a light host.
- **A palette is all or nothing.** The roles are coupled: the canvas, the four surfaces in order (0 lightest and 3 darkest in dark palettes too, the canvas between 1 and 2), the text roles, the borders, the primary and accent fills with their `on-` text, selection, focus, and each status's mark, text, background and `on-` text. Recolour the canvas and not the text, and something becomes unreadable. Change a whole group or none of it.
- **It must meet the contrast floors below.** Before anything paints, the renderer measures the view's final palette (the host's roles with the document's over them) and checks every floor a document's role takes part in. If one falls short, none of the theme applies, the host's theme stands, and each shortfall is reported (`theme-contrast`, naming both roles and the ratio). The validator checks the floors whose roles the document sets on both sides, and warns.
- **A themed view paints its own floor**: its box fills with `--C-CANVAS` and its text takes `--C-TEXT-PRIMARY`; a view without a theme stays transparent. Popovers, menus, tooltips and dialogs render inside the view, so they take its theme.
- **The host decides.** A host may ignore every theme or allow only some roles (`theme-disabled`); `scheme` applies whenever any theme is allowed. Print and forced colours (high contrast) set aside a document's theme as they set aside any theme, and a more-contrast preference applies to its roles. A new document starts from the host's theme.

<!-- GENERATED:theme -->
| Role | Paints | Utilities | Value |
| --- | --- | --- | --- |
| `--C-CANVAS` | page floor | `bg-canvas` | opaque |
| `--C-SURFACE-0` | raised sheet: cards, dialogs, menus, input fills | `bg-surface-0` | opaque |
| `--C-SURFACE-1` | still raised: panels in a sheet, table headers | `bg-surface-1` | opaque |
| `--C-SURFACE-2` | recessed: wells, chips, hover washes | `bg-surface-2` | opaque |
| `--C-SURFACE-3` | deepest: tracks, disabled fills | `bg-surface-3` | opaque |
| `--C-TEXT-PRIMARY` | body text, headings, icons (>= 4.5 on every surface) | `text-fg-primary` | opaque |
| `--C-TEXT-SECONDARY` | supporting text: descriptions, captions | `text-fg-secondary` | opaque |
| `--C-TEXT-MUTED` | least emphasis that is still read: hints, meta | `text-fg-muted` | opaque |
| `--C-TEXT-INVERSE` | text on a --C-TEXT-PRIMARY fill (tooltips) | `text-fg-inverse` | opaque |
| `--C-BORDER` | hairline structure: dividers, card edges | `border-border` `divide-border` | translucent: alpha allowed |
| `--C-BORDER-STRONG` | control edges: inputs, checkboxes (>= 3 on surfaces) | `border-border-strong` `divide-border-strong` | opaque |
| `--C-SCRIM` | backdrop behind modal layers | `bg-scrim` | translucent: alpha allowed |
| `--C-PRIMARY` | the main action's fill | `bg-primary` | opaque |
| `--C-PRIMARY-HOVER` | ...hovered | `bg-primary-hover` | opaque |
| `--C-PRIMARY-ACTIVE` | ...pressed | `bg-primary-active` | opaque |
| `--C-TEXT-ON-PRIMARY` | text/icons on all three primary fills | `text-fg-on-primary` | opaque |
| `--C-ACCENT` | markers and accent fills (>= 3 on surfaces) | `bg-accent` `border-accent` | opaque |
| `--C-ACCENT-HOVER` | accent fill, hovered | `bg-accent-hover` | opaque |
| `--C-TEXT-ON-ACCENT` | text on both accent fills | `text-fg-on-accent` | opaque |
| `--C-TEXT-ACCENT` | accent-coloured text: links (>= 4.5 on surfaces) | `text-fg-accent` | opaque |
| `--C-SELECTION` | selected text, selected rows/options | `bg-selection` | opaque |
| `--C-TEXT-ON-SELECTION` | text on the selection fill | `text-fg-on-selection` | opaque |
| `--C-FOCUS` | ring colour (>= 3 on every surface) |  | opaque |
| `--C-STATUS-ERROR` | error mark: icon, dot, border, danger fill | `bg-status-error` `border-status-error` | opaque |
| `--C-TEXT-ERROR` | error text | `text-fg-error` | opaque |
| `--C-STATUS-ERROR-BG` | subtle error background | `bg-status-error-bg` | opaque |
| `--C-TEXT-ON-ERROR` | text on the error mark as a fill | `text-fg-on-error` | opaque |
| `--C-STATUS-SUCCESS` | success mark | `bg-status-success` `border-status-success` | opaque |
| `--C-TEXT-SUCCESS` | success text | `text-fg-success` | opaque |
| `--C-STATUS-SUCCESS-BG` | subtle success background | `bg-status-success-bg` | opaque |
| `--C-TEXT-ON-SUCCESS` | text on the success mark as a fill | `text-fg-on-success` | opaque |
| `--C-STATUS-WARNING` | warning mark (no pale yellow: it must hit 3:1) | `bg-status-warning` `border-status-warning` | opaque |
| `--C-TEXT-WARNING` | warning text | `text-fg-warning` | opaque |
| `--C-STATUS-WARNING-BG` | subtle warning background | `bg-status-warning-bg` | opaque |
| `--C-TEXT-ON-WARNING` | text on the warning mark as a fill | `text-fg-on-warning` | opaque |
| `--C-STATUS-INFO` | info mark | `bg-status-info` `border-status-info` | opaque |
| `--C-TEXT-INFO` | info text | `text-fg-info` | opaque |
| `--C-STATUS-INFO-BG` | subtle info background | `bg-status-info-bg` | opaque |
| `--C-TEXT-ON-INFO` | text on the info mark as a fill | `text-fg-on-info` | opaque |

Every surface: `--C-CANVAS`, `--C-SURFACE-0`, `--C-SURFACE-1`, `--C-SURFACE-2`, `--C-SURFACE-3`.

| Role | On | At least |
| --- | --- | --- |
| `--C-TEXT-PRIMARY` | every surface, `--C-STATUS-ERROR-BG`, `--C-STATUS-SUCCESS-BG`, `--C-STATUS-WARNING-BG`, `--C-STATUS-INFO-BG` | 4.5:1 |
| `--C-TEXT-SECONDARY` | every surface, `--C-SELECTION` | 4.5:1 |
| `--C-TEXT-MUTED` | every surface | 4.5:1 |
| `--C-TEXT-ACCENT` | every surface | 4.5:1 |
| `--C-TEXT-ERROR` | every surface, `--C-STATUS-ERROR-BG` | 4.5:1 |
| `--C-TEXT-SUCCESS` | every surface, `--C-STATUS-SUCCESS-BG` | 4.5:1 |
| `--C-TEXT-WARNING` | every surface, `--C-STATUS-WARNING-BG` | 4.5:1 |
| `--C-TEXT-INFO` | every surface, `--C-STATUS-INFO-BG` | 4.5:1 |
| `--C-STATUS-ERROR` | every surface, `--C-STATUS-ERROR-BG` | 3:1 |
| `--C-STATUS-SUCCESS` | every surface, `--C-STATUS-SUCCESS-BG` | 3:1 |
| `--C-STATUS-WARNING` | every surface, `--C-STATUS-WARNING-BG` | 3:1 |
| `--C-STATUS-INFO` | every surface, `--C-STATUS-INFO-BG` | 3:1 |
| `--C-ACCENT` | every surface | 3:1 |
| `--C-FOCUS` | every surface | 3:1 |
| `--C-BORDER-STRONG` | every surface | 3:1 |
| `--C-TEXT-ON-PRIMARY` | `--C-PRIMARY`, `--C-PRIMARY-HOVER`, `--C-PRIMARY-ACTIVE` | 4.5:1 |
| `--C-TEXT-ON-ACCENT` | `--C-ACCENT`, `--C-ACCENT-HOVER` | 4.5:1 |
| `--C-TEXT-ON-SELECTION` | `--C-SELECTION` | 4.5:1 |
| `--C-TEXT-INVERSE` | `--C-TEXT-PRIMARY` | 4.5:1 |
| `--C-TEXT-ON-ERROR` | `--C-STATUS-ERROR` | 4.5:1 |
| `--C-TEXT-ON-SUCCESS` | `--C-STATUS-SUCCESS` | 4.5:1 |
| `--C-TEXT-ON-WARNING` | `--C-STATUS-WARNING` | 4.5:1 |
| `--C-TEXT-ON-INFO` | `--C-STATUS-INFO` | 4.5:1 |

And the scheme: under `"dark"` `--C-TEXT-PRIMARY` is lighter than `--C-CANVAS`, under `"light"` darker.
<!-- /GENERATED:theme -->

## Density

`density` (`"comfortable"` or `"compact"`) sets the density of the whole view, unless the host sets one, which wins. A part of the view can differ either way: `"data-density": "compact"` on any component makes its subtree compact. Density changes spacing, UI text, control and row heights and icon size; nothing else.

## Ids, names and attributes

- A document never writes DOM ids or what points at them: `id`, `htmlFor`, `for`, `form`, `list`, `headers`, `popoverTarget`, `commandFor`, `aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-owns`, `aria-activedescendant`, `aria-details`, `aria-errormessage`, `aria-flowto` are dropped (`forbidden-prop`). Fields wire their labels, descriptions and errors themselves, and two views on one page never collide.
- `name` on a form control (`Input`, `Select`, `Slider`, `RadioGroup`, anything that submits a DOM name) is dropped (`forbidden-prop`): the `Field` around it names the control. `Field`'s `name` is the form field it binds. Everywhere else `name` is the component's own (`Avatar`'s person, `Icon`'s glyph) and passes on as written.
- Name a control without a visible label with `aria-label`.
- Dialog components take a `dialogId` (a name) that `openDialog` and `closeDialog` match; the renderer owns their open state: `open` is dropped (`forbidden-prop`), and `defaultOpen` seeds it.
- `data-*` attributes pass through with string, number or boolean values, to a component that renders an element of its own; on one that does not (a `Dialog`), put them on the part that does (`Dialog.Content`). `data-density` takes `comfortable` or `compact`; `data-theme` and `data-input` are dropped (the host owns those axes).

## Network and images

- Nothing is requested unless the host provides `fetch`. Without it, `api` bindings and `apiCall` send nothing and report `missing-adapter`.
- `endpoint` is relative or same-origin unless the host allows more. Origins are judged on the resolved URL, never on how the string starts.
- A `query` value is a string, number or boolean; a list of them sends one parameter per item (`"tag": ["db", "eu"]` → `?tag=db&tag=eu`); `null` leaves the parameter out. An object has no query-string form: it is left out (`unusable-value`), whether written or read by `$ref`.
- Every image a document makes the browser load (`src`, `srcSet`, `poster`, avatar and logo URLs, at any depth) must pass the host's image policy: by default same-origin, or a `data:` PNG, JPEG, GIF, WebP or AVIF. A refused image shows its fallback and loads nothing.
- Markdown shows an image only from a URL prefix the host lists (its policy's `markdownImages`; none by default), otherwise its alt text. A document's own `imageAllowlist` is dropped.

## Sensitive components

`PasswordInput` and `OTPInput` render only when the host allows them, and so does any control given a password `type` or an `autoComplete` of `current-password`, `new-password`, `one-time-code` or a `cc-…` token; otherwise they render a diagnostic (`sensitive-component`). Ask for credentials only in views the host built for that.

## Safety

- A `Form` takes no `action` or `method`.
- A URL is kept only when relative, or `http:`, `https:`, `mailto:`, `tel:`, or a `data:` raster image, judged on the resolved value; this applies to the URL props below and to every component prop that becomes one (including URLs inside items).
- Props that choose an element (`as`, a heading level) take only the values listed per component.
- The renderer degrades instead of failing: a bad node renders a small diagnostic in its place and the rest of the view is unaffected.

<!-- GENERATED:safety -->
- Dropped everywhere, compared in any casing: `dangerouslysetinnerhtml`, `srcdoc`, `style`, `formaction`, `formmethod`, `formtarget`, `formenctype`, `formnovalidate`, `ping`, `ref`, `key`, `__proto__`, `constructor`, `prototype`; any name containing `:` (`xlink:href`); and any `on…` value that is not a handler.
- URL props on every component, compared in any casing: `href`, `src`, `srcset`, `poster`, `cite`, `action`, `background`, `xlinkhref`, `to`. Of these, `src`, `srcset`, `poster` load images and pass the host's image policy.
- Limits: nodes nest at most 50 deep (deeper renders a diagnostic); handlers chain at most 5 deep and run at most 10 actions each; arrays and objects nest at most 256 deep (deeper refuses the whole document); a `pattern` rule tests at most 1000 characters; `title` is at most 200 characters.
<!-- /GENERATED:safety -->

## Issues

`validateViewSpec` and the renderer report issues as `{ "code", "path", "severity", "message", "suggestion"? }`. `path` is a JSON Pointer into the document (`/root/children/2/props/href`; `""` is the document). An **error** means the document does not conform; a **warning** means it conforms but something will be dropped, refused or will not work. Fix both. A document whose arrays and objects nest past the limit under Safety is refused whole: `too-deep`, an error.

<!-- GENERATED:issue-codes -->
| Code | Severity | Meaning |
| --- | --- | --- |
| `invalid-json` | error | The text is not JSON. |
| `invalid-type` | error | A value has the wrong JSON type for its place in the format. |
| `invalid-value` | error | A value is outside the set the format allows there. |
| `missing-key` | error | A required key is absent. |
| `unknown-key` | error | A key the format does not define. |
| `unsupported-version` | error | `version` is not 2. |
| `invalid-node` | error | A node matches none of the node shapes. |
| `invalid-ref` | error | A reference path is malformed. |
| `invalid-name` | error | A name breaks the name rules or is reserved. |
| `too-deep` | error | Arrays and objects nested past `LIMITS.jsonDepth`; neither validated nor rendered. |
| `limit-exceeded` | warning | Past a limit (depth, handler chain); the excess is not rendered or run. |
| `undeclared-name` | warning | A reference, form, field, dialog or binding name nothing declares. |
| `unknown-component` | warning | A component name nothing registers. |
| `not-addressable` | warning | A library component documents cannot use. |
| `misplaced-part` | warning | A compound part outside its parent. |
| `unknown-prop` | warning | A prop the component does not take. |
| `invalid-prop-value` | warning | A prop value outside the component's set or shape. |
| `unknown-icon` | warning | An icon name the icon set does not have. |
| `forbidden-prop` | warning | A prop the renderer drops. |
| `refused-url` | warning | A URL the scheme allowlist or the origin policy refuses. |
| `unknown-class` | warning | A class outside the class vocabulary; it would style nothing. |
| `sensitive-component` | warning | A component the host must allow before it renders. |
| `controlled-in-field` | warning | A value on a control inside a bound Field; it would detach the binding. |
| `unusable-value` | warning | A value that conforms but cannot work: a rule its field's type ignores, a pattern that does not compile, a code `Intl` refuses. |
| `key-order` | warning | Keys out of the streaming order; the object shows late, or remounts once when the late key closes. |
| `duplicate-key` | warning | Two siblings share a key; positions are used instead. Reported only while rendering. |
| `missing-adapter` | warning | The host did not provide the adapter this needs; nothing was sent. Reported only while rendering. |
| `data-error` | error | A data binding failed. Reported only while rendering. |
| `action-failed` | error | An action failed. Reported only while rendering. |
| `render-error` | error | A node threw while rendering. Reported only while rendering. |
| `not-renderable` | warning | A value its place cannot use: not text where text renders, not an array under `$each`. Reported only while rendering. |
| `stream-incomplete` | error | The stream ended before the document closed. Reported only while rendering. |
| `theme-contrast` | warning | The theme's colours break the contrast contract; the whole theme is refused and the host's stands. |
| `theme-disabled` | warning | The host does not allow the theme, or one of its colour roles; that part is ignored. |
<!-- /GENERATED:issue-codes -->

## Components

<!-- GENERATED:components -->
### Layout

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `Container` | — | `as?`: "div" \| "section" \| "article" \| "aside" \| "header" \| "footer" \| "nav" \| "ul" \| "ol" \| "li" \| "figure" · `gutter?`: boolean · `width?`: "measure" \| "page" \| "full" |  |
| `Grid` | — | `as?`: "div" \| "section" \| "article" \| "aside" \| "header" \| "footer" \| "nav" \| "ul" \| "ol" \| "li" \| "figure" · `columns?`: GridColumns \| GridColumnMap · `gap?`: "r1" \| "r2" \| "r3" \| "r4" \| "r5" \| "r6" · `minColumn?`: "sm" \| "md" \| "lg" · `rowGap?`: "r1" \| "r2" \| "r3" \| "r4" \| "r5" \| "r6" | `columns` is a count (1–6) or a map by the Grid's own width: `{ "base": 1, "@3xl": 3 }` (`@sm` 24rem, `@md` 28, `@lg` 32, `@xl` 36, `@2xl` 42, `@3xl` 48, `@4xl` 56, `@5xl` 64). A cell spans by the same steps: `@3xl:col-span-2`. |
| `Inline` | — | `align?`: "start" \| "center" \| "end" \| "stretch" \| "baseline" · `as?`: "div" \| "section" \| "article" \| "aside" \| "header" \| "footer" \| "nav" \| "ul" \| "ol" \| "li" \| "figure" · `gap?`: "r1" \| "r2" \| "r3" \| "r4" \| "r5" \| "r6" · `justify?`: "start" \| "center" \| "end" \| "between" · `rowGap?`: "r1" \| "r2" \| "r3" \| "r4" \| "r5" \| "r6" · `wrap?`: boolean |  |
| `Prose` | — | `as?`: "div" \| "section" \| "article" \| "aside" \| "header" \| "footer" \| "nav" \| "ul" \| "ol" \| "li" \| "figure" · `measure?`: boolean |  |
| `ScrollPanel` | `.Body` `.Footer` | — | Scrolls only when its height is bounded: a parent with a height (`h-full` fills one); the vocabulary holds no free heights. |
| `ScrollPanel.Body` | — | — |  |
| `ScrollPanel.Footer` | — | — |  |
| `Section` | — | `as?`: "div" \| "section" \| "article" \| "aside" \| "header" \| "footer" \| "nav" \| "ul" \| "ol" \| "li" \| "figure" · `padding?`: "section-1" \| "section-2" \| "section-3" · `variant?`: "plain" \| "band" |  |
| `Stack` | — | `align?`: "center" \| "start" \| "end" \| "stretch" · `as?`: "div" \| "section" \| "article" \| "aside" \| "header" \| "footer" \| "nav" \| "ul" \| "ol" \| "li" \| "figure" · `gap?`: "r1" \| "r2" \| "r3" \| "r4" \| "r5" \| "r6" · `justify?`: "start" \| "center" \| "end" \| "between" |  |

### Built-in

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `Heading` | — | `className?`: string · `level?`: 1 \| 2 \| 3 \| 4 \| 5 \| 6 · `size?`: "h1" \| "h2" \| "h3" \| "h4" \| "h5" \| "h6" · `tone?`: "primary" \| "secondary" \| "muted" \| "error" \| "success" \| "warning" \| "info" \| "serious" \| "stale" | `level` is the outline (h1–h6); `size` is the look and matches the level when absent. |
| `Icon` | — | `name`: string · `className?`: string · `label?`: string · `tone?`: "primary" \| "secondary" \| "muted" \| "error" \| "success" \| "warning" \| "info" \| "serious" \| "stale" | Decorative unless `label` names it. Sized by the density's icon step. |
| `Text` | — | `as?`: "p" \| "span" \| "strong" \| "em" \| "small" \| "code" \| "blockquote" · `className?`: string · `size?`: "body-1" \| "body-2" \| "body-3" · `tone?`: "primary" \| "secondary" \| "muted" \| "error" \| "success" \| "warning" \| "info" \| "serious" \| "stale" · `weight?`: "normal" \| "medium" \| "semibold" | Body text. `as` picks the element, `size` the UI body step (inherited when absent). |

### Primitives

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `Alert` | — | `actions?`: node · `icon?`: icon name · `labels?`: LabelsProp<AlertLabels> · `onDismiss?`: handler · `title?`: node · `tone?`: "neutral" \| "error" \| "success" \| "warning" \| "info" \| "serious" \| "stale" |  |
| `Avatar` | — | `alt?`: string · `name?`: string · `size?`: "control" \| "icon" · `src?`: string \| null |  |
| `AvatarGroup` | — | `items`: AvatarGroupItem[] · `label`: string · `labels?`: LabelsProp<AvatarGroupLabels> · `max?`: number · `size?`: "icon" \| "control" |  |
| `Badge` | — | `icon?`: icon name · `tone?`: "neutral" \| "accent" \| "error" \| "success" \| "warning" \| "info" \| "serious" \| "stale" · `variant?`: "subtle" \| "solid" \| "outline" |  |
| `Button` | — | `href?`: string · `iconEnd?`: icon name · `iconStart?`: icon name · `loading?`: boolean · `variant?`: "primary" \| "secondary" \| "ghost" \| "danger" |  |
| `Card` | `.Actions` `.Body` `.Description` `.Footer` `.Header` `.Title` | — |  |
| `Card.Actions` | — | — |  |
| `Card.Body` | — | — |  |
| `Card.Description` | — | — |  |
| `Card.Footer` | — | — |  |
| `Card.Header` | — | — | Put `Card.Actions` directly among its children; it is picked out by type and placed on the end. |
| `Card.Title` | — | `as?`: "h2" \| "h3" \| "h4" \| "h5" \| "h6" |  |
| `Chip` | — | `as?`: "span" \| "li" · `disabled?`: boolean · `labels?`: LabelsProp<ChipLabels> · `onRemove?`: handler | Children are plain text (the chip's name, also used by its remove button), not nodes. |
| `Divider` | — | `orientation?`: "horizontal" \| "vertical" |  |
| `IconButton` | — | `icon`: icon name · `label`: string · `variant?`: "primary" \| "secondary" \| "ghost" \| "danger" |  |
| `Kbd` | — | — |  |
| `Link` | — | `external?`: boolean · `href?`: string · `labels?`: LabelsProp<LinkLabels> · `rel?`: string · `target?`: string · `variant?`: "accent" \| "inherit" |  |
| `Skeleton` | — | `label?`: string · `lines?`: number · `shape?`: "text" \| "block" \| "circle" |  |
| `Spinner` | — | `label?`: string |  |
| `StatusLabel` | — | `icon?`: icon name · `tone?`: "neutral" \| "accent" \| "error" \| "success" \| "warning" \| "info" \| "serious" \| "stale" |  |

### Content

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `CodeBlock` | — | `code`: string · `copyable?`: boolean · `defaultWrap?`: boolean · `filename?`: string · `highlightLines?`: number[] · `labels?`: LabelsProp<CodeBlockLabels> · `language?`: string · `lineNumbers?`: boolean · `onWrapChange?`: handler · `wrap?`: boolean · `wrapToggle?`: boolean |  |
| `CopyButton` | — | `value`: string · `labels?`: LabelsProp<CopyButtonLabels> · `onCopy?`: handler · `onCopyError?`: handler · `resetAfter?`: number · `showLabel?`: boolean · `variant?`: "primary" \| "secondary" \| "ghost" \| "danger" |  |
| `Markdown` | — | `headingOffset?`: number · `labels?`: LabelsProp<MarkdownLabels> · `measure?`: boolean | Children are the Markdown source as text. Images load only where the host allows them. |

### Data

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `ActivityFeed` | — | `items`: ActivityItem[] · `empty?`: node · `groupByDay?`: boolean · `hasMore?`: boolean · `headingLevel?`: 2 \| 3 \| 4 \| 5 \| 6 · `label?`: string · `labels?`: LabelsProp<TimelineLabels> · `loading?`: boolean · `loadingMore?`: boolean · `now?`: ISO date-time · `onLoadMore?`: handler · `order?`: "newest-first" \| "oldest-first" · `pageSize?`: number · `scrollable?`: boolean · `timeFormat?`: "relative" \| "absolute" |  |
| `DataTable` | — | `columns`: DataTableColumnSpec[] · `rows`: Row[] · `bulkActions?`: template (selectedKeys) · `caption?`: node · `columnsMenu?`: boolean · `columnWidths?`: Readonly<Record<string, number>> · `defaultColumnWidths?`: Readonly<Record<string, number>> · `defaultExpandedKeys?`: RowKey[] · `defaultFilters?`: DataTableFilters · `defaultPage?`: number · `defaultPageSize?`: number · `defaultSelectedKeys?`: RowKey[] · `defaultSort?`: SortState · `defaultVisibleColumns?`: string[] · `empty?`: node · `error?`: node · `errorActions?`: node · `expandedKeys?`: RowKey[] · `filters?`: DataTableFilters · `labels?`: LabelsProp<DataTableLabels> · `layout?`: "auto" \| "fixed" · `loading?`: boolean · `loadingRows?`: number · `manualFiltering?`: boolean · `manualPagination?`: boolean · `manualSorting?`: boolean · `onColumnWidthsChange?`: handler · `onExpandedKeysChange?`: handler · `onFiltersChange?`: handler · `onPageChange?`: handler · `onPageSizeChange?`: handler · `onSelectedKeysChange?`: handler · `onSortChange?`: handler · `onVisibleColumnsChange?`: handler · `page?`: number · `pageSize?`: number · `pageSizeOptions?`: number[] · `renderDetail?`: template (row, rowIndex) · `resizableColumns?`: boolean · `rowActions?`: template (row, rowIndex) · `rowCount?`: number · `rowKey?`: string · `rowLabel?`: string · `selectable?`: boolean · `selectedKeys?`: RowKey[] · `sort?`: SortState · `stickyColumns?`: number · `stickyHeader?`: boolean · `striped?`: boolean · `variant?`: "boxed" \| "rules" \| "plain" · `visibleColumns?`: string[] | `columns` are data and `rowKey` names the field that identifies a row; rows usually come from `{ "$ref": "data.…" }`. |
| `DescriptionList` | `.Item` | `variant?`: "plain" \| "divided" |  |
| `DescriptionList.Item` | — | `term`: node |  |
| `EmptyState` | — | `title`: node · `actions?`: node · `description?`: node · `headingLevel?`: 2 \| 3 \| 4 \| 5 \| 6 · `icon?`: icon name · `tone?`: "neutral" \| "error" |  |
| `Meter` | — | `label`: node · `value`: number \| null \| undefined · `labels?`: LabelsProp<MeterLabels> · `max?`: number · `min?`: number · `thresholds?`: MeterThreshold[] · `valueText?`: string · `variant?`: "stacked" \| "inline" · `worse?`: "high" \| "low" | `value` is read on the `min`–`max` scale; outside it the fill clamps while the text keeps the real share. |
| `Sparkline` | — | `label`: string · `values`: (number \| null \| undefined)[] · `format?`: FormatSpec · `labels?`: LabelsProp<SparklineLabels> · `series?`: 1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7 \| 8 \| "total" · `summary?`: string |  |
| `StatCard` | — | `label`: node · `value`: node · `delta?`: number \| null · `deltaLabel?`: node · `formatDelta?`: FormatSpec · `labels?`: LabelsProp<StatCardLabels> · `loading?`: boolean · `sentiment?`: "good" \| "bad" \| "neutral" · `sparkline?`: node · `stale?`: node · `status?`: node · `unit?`: node | `value` renders as given: format numbers with `$format`. |
| `Table` | `.Body` `.Caption` `.Cell` `.Head` `.HeaderCell` `.Row` | `footer?`: node · `layout?`: "auto" \| "fixed" · `stickyHeader?`: boolean · `striped?`: boolean · `variant?`: "boxed" \| "rules" \| "plain" |  |
| `Table.Body` | — | — |  |
| `Table.Caption` | — | `visuallyHidden?`: boolean |  |
| `Table.Cell` | — | `numeric?`: boolean · `priority?`: 1 \| 2 \| 3 \| 4 \| 5 · `truncate?`: boolean · `wrap?`: boolean |  |
| `Table.Head` | — | — |  |
| `Table.HeaderCell` | — | `after?`: node · `numeric?`: boolean · `onSort?`: handler · `priority?`: 1 \| 2 \| 3 \| 4 \| 5 · `sort?`: SortDirection \| null · `truncate?`: boolean · `wrap?`: boolean |  |
| `Table.Row` | — | `index?`: number · `selected?`: boolean |  |
| `Timeline` | — | `events`: TimelineEvent[] · `empty?`: node · `groupByDay?`: boolean · `hasMore?`: boolean · `headingLevel?`: 2 \| 3 \| 4 \| 5 \| 6 · `label?`: string · `labels?`: LabelsProp<TimelineLabels> · `loading?`: boolean · `loadingMore?`: boolean · `now?`: ISO date-time · `onLoadMore?`: handler · `order?`: "newest-first" \| "oldest-first" · `pageSize?`: number · `scrollable?`: boolean · `timeFormat?`: "relative" \| "absolute" |  |
| `VirtualizedTable` | — | `columns`: DataTableColumnSpec[] · `rows`: Row[] · `bulkActions?`: template (selectedKeys) · `caption?`: node · `columnsMenu?`: boolean · `columnWidths?`: Readonly<Record<string, number>> · `defaultColumnWidths?`: Readonly<Record<string, number>> · `defaultFilters?`: DataTableFilters · `defaultSelectedKeys?`: RowKey[] · `defaultSort?`: SortState · `defaultVisibleColumns?`: string[] · `empty?`: node · `error?`: node · `errorActions?`: node · `filters?`: DataTableFilters · `labels?`: LabelsProp<DataTableLabels> · `layout?`: "auto" \| "fixed" · `loading?`: boolean · `loadingRows?`: number · `manualFiltering?`: boolean · `manualSorting?`: boolean · `onColumnWidthsChange?`: handler · `onFiltersChange?`: handler · `onSelectedKeysChange?`: handler · `onSortChange?`: handler · `onVisibleColumnsChange?`: handler · `overscan?`: number · `resizableColumns?`: boolean · `rowActions?`: template (row, rowIndex) · `rowKey?`: string · `rowLabel?`: string · `selectable?`: boolean · `selectedKeys?`: RowKey[] · `sort?`: SortState · `stickyColumns?`: number · `stickyHeader?`: boolean · `striped?`: boolean · `variant?`: "boxed" \| "rules" \| "plain" · `visibleColumns?`: string[] · `visibleRows?`: number |  |

### Charts

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `BarChart` | — | `label`: string · `series`: ChartSeries[] · `format?`: FormatSpec · `formatTick?`: FormatSpec · `labels?`: LabelsProp<ChartLabels> · `max?`: number · `min?`: number · `orientation?`: "vertical" \| "horizontal" · `stacked?`: boolean · `summary?`: string · `timeZone?`: "local" \| "UTC" · `unit?`: string · `x?`: ChartX[] |  |
| `Heatmap` | — | `columns`: string[] · `label`: string · `rows`: string[] · `values`: ((number \| null \| undefined)[])[] · `format?`: FormatSpec · `labels?`: LabelsProp<ChartLabels> · `summary?`: string · `unit?`: string · `valueLabel?`: string |  |
| `LineChart` | — | `label`: string · `series`: ChartSeries[] · `area?`: boolean · `format?`: FormatSpec · `formatTick?`: FormatSpec · `formatX?`: FormatSpec · `labels?`: LabelsProp<ChartLabels> · `max?`: number · `min?`: number · `summary?`: string · `timeZone?`: "local" \| "UTC" · `unit?`: string · `x?`: ChartX[] · `xType?`: "category" \| "number" \| "time" |  |

### Feedback

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `Banner` | — | `actions?`: node · `dismissKey?`: string · `icon?`: icon name · `labels?`: LabelsProp<BannerLabels> · `onDismiss?`: handler · `title?`: node · `tone?`: "neutral" \| "error" \| "success" \| "warning" \| "info" \| "serious" \| "stale" · `urgent?`: boolean | Inline only. `dismissKey` remembers a dismissal per view; the renderer prefixes it. |
| `ErrorFallback` | — | `details?`: boolean · `error?`: unknown · `labels?`: LabelsProp<ErrorFallbackLabels> · `onRetry?`: handler |  |
| `ProgressBar` | — | `label`: node · `hideLabel?`: boolean · `labels?`: LabelsProp<ProgressLabels> · `max?`: number · `showValue?`: boolean · `tone?`: "neutral" \| "accent" \| "error" \| "success" \| "warning" \| "info" \| "serious" · `value?`: number \| null · `valueText?`: string · `variant?`: "continuous" \| "segmented" | `value` is on the 0–`max` scale; `null` is indeterminate. |
| `ProgressRing` | — | `label`: string · `labels?`: LabelsProp<ProgressLabels> · `max?`: number · `showValue?`: boolean · `size?`: "icon" \| "control" \| "large" · `tone?`: "neutral" \| "accent" \| "error" \| "success" \| "warning" \| "info" \| "serious" · `value?`: number \| null · `valueText?`: string |  |

### Forms

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `Checkbox` | — | `checked?`: boolean · `defaultChecked?`: boolean · `disabled?`: boolean · `indeterminate?`: boolean · `invalid?`: boolean · `onCheckedChange?`: handler |  |
| `ColorPicker` | — | `alpha?`: boolean · `contrast?`: { against: string; label: string; } · `defaultOpen?`: boolean · `defaultValue?`: string · `eyeDropper?`: boolean · `format?`: "hex" \| "oklch" · `invalid?`: boolean · `labels?`: LabelsProp<ColorPickerLabels> · `onOpenChange?`: handler · `onValueChange?`: handler · `open?`: boolean · `readOnly?`: boolean · `required?`: boolean · `swatches?`: ColorSwatch[] · `value?`: string |  |
| `Combobox` | — | `options`: ComboboxOption[] · `allowCustomValue?`: boolean · `defaultInputValue?`: string · `defaultOpen?`: boolean · `defaultValue?`: string \| null · `filter?`: ComboboxFilter \| false · `inputValue?`: string · `invalid?`: boolean · `labels?`: LabelsProp<ComboboxLabels> · `loadError?`: string · `loading?`: boolean · `onInputChange?`: handler · `onOpenChange?`: handler · `onValueChange?`: handler · `open?`: boolean · `start?`: node · `value?`: string \| null · `virtualizeThreshold?`: number |  |
| `CurrencyInput` | — | `currency`: ISO 4217 code · `allowNegative?`: boolean · `currencyDisplay?`: "symbol" \| "narrowSymbol" \| "code" · `defaultValue?`: number \| null · `end?`: node · `invalid?`: boolean · `max?`: number · `min?`: number · `minorUnits?`: boolean · `onValueChange?`: handler · `value?`: number \| null |  |
| `ErrorSummary` | — | `labels?`: LabelsProp<ErrorSummaryLabels> · `title?`: node | Must sit inside a `Form`; it lists that form's errors. |
| `Field` | `.Description` `.Error` `.Label` | `disabled?`: boolean · `invalid?`: boolean · `name?`: field name · `orientation?`: "vertical" \| "horizontal" · `readOnly?`: boolean · `required?`: boolean | `name` binds the control inside it to that form field: give the control no `value`, `checked` or `defaultValue`. |
| `Field.Description` | — | — |  |
| `Field.Error` | — | `icon?`: icon name |  |
| `Field.Label` | — | `required?`: boolean |  |
| `Form` | — | `form`: form name | `form` names a declared form. Forms do not nest; a Wizard renders its own. |
| `FormActions` | `.Submit` | `sticky?`: boolean |  |
| `FormActions.Submit` | — | `iconEnd?`: icon name · `iconStart?`: icon name · `loading?`: boolean · `variant?`: "primary" \| "secondary" \| "ghost" \| "danger" |  |
| `Input` | — | `end?`: node · `invalid?`: boolean · `start?`: node · `type?`: "text" \| "email" \| "password" \| "search" \| "tel" \| "url" |  |
| `MaskedInput` | — | `mask`: string · `defaultValue?`: string · `end?`: node · `invalid?`: boolean · `onComplete?`: handler · `onValueChange?`: handler · `placeholderChar?`: string · `start?`: node · `type?`: "text" \| "tel" · `value?`: string |  |
| `MultiSelect` | — | `options`: ComboboxOption[] · `defaultInputValue?`: string · `defaultOpen?`: boolean · `defaultValue?`: string[] · `filter?`: ComboboxFilter \| false · `inputValue?`: string · `invalid?`: boolean · `labels?`: LabelsProp<MultiSelectLabels> · `loadError?`: string · `loading?`: boolean · `max?`: number · `onInputChange?`: handler · `onOpenChange?`: handler · `onValueChange?`: handler · `open?`: boolean · `selectAll?`: boolean · `value?`: string[] · `virtualizeThreshold?`: number |  |
| `NumberInput` | — | `defaultValue?`: number \| null · `end?`: node · `formatOptions?`: Pick<FormatNumberOptions, "minimumFractionDigits" \| "maximumFractionDig… · `invalid?`: boolean · `labels?`: LabelsProp<NumberInputLabels> · `max?`: number · `min?`: number · `onValueChange?`: handler · `precision?`: number · `start?`: node · `step?`: number · `value?`: number \| null |  |
| `OTPInput` | — | `defaultValue?`: string · `groups?`: number[] · `invalid?`: boolean · `labels?`: LabelsProp<OTPInputLabels> · `length?`: number · `mask?`: boolean · `mode?`: "numeric" \| "alphanumeric" · `onComplete?`: handler · `onValueChange?`: handler · `separator?`: node · `value?`: string |  |
| `PasswordInput` | — | `autoComplete?`: "current-password" \| "new-password" \| "one-time-code" \| "off" · `capsLockWarning?`: boolean · `defaultValue?`: string · `defaultVisible?`: boolean · `end?`: node · `invalid?`: boolean · `labels?`: LabelsProp<PasswordInputLabels> · `minStrengthLength?`: number · `onValueChange?`: handler · `onVisibleChange?`: handler · `start?`: node · `strength?`: boolean \| PasswordStrengthEstimator · `value?`: string · `visible?`: boolean |  |
| `Radio` | — | `value`: string · `disabled?`: boolean | Only inside a `RadioGroup`. |
| `RadioGroup` | — | `defaultValue?`: string · `disabled?`: boolean · `invalid?`: boolean · `onValueChange?`: handler · `orientation?`: "vertical" \| "horizontal" · `readOnly?`: boolean · `required?`: boolean · `value?`: string |  |
| `RangeSlider` | — | `defaultValue?`: RangeSliderValue · `disabled?`: boolean · `formatOptions?`: Omit<FormatNumberOptions, "locale" \| "missing"> · `invalid?`: boolean · `labels?`: LabelsProp<RangeSliderLabels> · `largeStep?`: number · `marks?`: SliderMark[] · `max?`: number · `min?`: number · `minStepsBetweenThumbs?`: number · `onValueChange?`: handler · `onValueCommit?`: handler · `orientation?`: "horizontal" \| "vertical" · `readOnly?`: boolean · `showValue?`: boolean · `step?`: number · `value?`: RangeSliderValue |  |
| `Rating` | — | `allowHalf?`: boolean · `clearable?`: boolean · `defaultValue?`: number \| null · `disabled?`: boolean · `icon?`: icon name · `invalid?`: boolean · `labels?`: LabelsProp<RatingLabels> · `max?`: number · `onValueChange?`: handler · `readOnly?`: boolean · `value?`: number \| null |  |
| `SearchInput` | — | `defaultValue?`: string · `end?`: node · `invalid?`: boolean · `labels?`: LabelsProp<SearchInputLabels> · `loading?`: boolean · `onClear?`: handler · `onValueChange?`: handler · `value?`: string |  |
| `SegmentedControl` | `.Item` | `defaultValue?`: string · `disabled?`: boolean · `invalid?`: boolean · `onValueChange?`: handler · `readOnly?`: boolean · `value?`: string |  |
| `SegmentedControl.Item` | — | `value`: string · `disabled?`: boolean · `icon?`: icon name |  |
| `Select` | — | `defaultValue?`: string · `invalid?`: boolean · `onValueChange?`: handler · `options?`: { value: string; label: string; disabled?: boolean }[] · `placeholder?`: string · `readOnly?`: boolean · `value?`: string | Choices go in `options`, not children. |
| `Slider` | — | `defaultValue?`: number · `disabled?`: boolean · `formatOptions?`: Omit<FormatNumberOptions, "locale" \| "missing"> · `invalid?`: boolean · `largeStep?`: number · `marks?`: SliderMark[] · `max?`: number · `min?`: number · `onValueChange?`: handler · `onValueCommit?`: handler · `orientation?`: "horizontal" \| "vertical" · `readOnly?`: boolean · `showValue?`: boolean · `step?`: number · `value?`: number |  |
| `Switch` | — | `checked?`: boolean · `defaultChecked?`: boolean · `disabled?`: boolean · `invalid?`: boolean · `onCheckedChange?`: handler |  |
| `TagInput` | — | `caseSensitive?`: boolean · `commitOnBlur?`: boolean · `defaultInputValue?`: string · `defaultValue?`: string[] · `delimiter?`: string · `inputValue?`: string · `invalid?`: boolean · `labels?`: LabelsProp<TagInputLabels> · `max?`: number · `onInputChange?`: handler · `onValueChange?`: handler · `suggestions?`: (string \| ComboboxOption)[] · `value?`: string[] |  |
| `Textarea` | — | `autosize?`: boolean · `invalid?`: boolean · `maxRows?`: number |  |

### Dates

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `Calendar` | — | `autoFocus?`: boolean · `defaultMonth?`: ISO date · `defaultValue?`: ISO date · `disabled?`: boolean · `labels?`: LabelsProp<CalendarLabels> · `max?`: ISO date · `min?`: ISO date · `month?`: ISO date · `months?`: number · `onMonthChange?`: handler · `onValueChange?`: handler · `value?`: ISO date · `weekStartsOn?`: 0 \| 1 \| 2 \| 3 \| 4 \| 5 \| 6 |  |
| `DatePicker` | — | `defaultOpen?`: boolean · `defaultValue?`: ISO date · `hint?`: node · `invalid?`: boolean · `labels?`: LabelsProp<DatePickerLabels> · `max?`: ISO date · `min?`: ISO date · `months?`: number · `onOpenChange?`: handler · `onValueChange?`: handler · `open?`: boolean · `value?`: ISO date · `weekStartsOn?`: 0 \| 1 \| 2 \| 3 \| 4 \| 5 \| 6 |  |
| `DateRangePicker` | — | `defaultOpen?`: boolean · `defaultValue?`: { start, end } of ISO dates · `hourCycle?`: 12 \| 24 · `invalid?`: boolean · `labels?`: LabelsProp<DateRangePickerLabels> · `max?`: ISO date · `min?`: ISO date · `months?`: number · `now?`: ISO date-time · `onOpenChange?`: handler · `onValueChange?`: handler · `open?`: boolean · `placeholder?`: string · `placement?`: "top" \| "right" \| "bottom" \| "left" \| "top-start" \| "top-end" \| "right-start" \| "right-end" \| "bottom-start" \| "bottom-end" \| "left-start" \| "left-end" · `timeStep?`: number · `value?`: { start, end } of ISO dates · `variant?`: "button" \| "field" · `weekStartsOn?`: 0 \| 1 \| 2 \| 3 \| 4 \| 5 \| 6 · `withTime?`: boolean |  |
| `EventCalendar` | — | `events`: CalendarEvent[] · `date?`: ISO date · `defaultDate?`: ISO date · `defaultView?`: "month" \| "week" \| "day" \| "agenda" · `labels?`: LabelsProp<EventCalendarLabels> · `loading?`: boolean · `maxEventsPerDay?`: number · `now?`: ISO date-time · `onDateChange?`: handler · `onEventClick?`: handler · `onViewChange?`: handler · `scrollToHour?`: number · `view?`: "month" \| "week" \| "day" \| "agenda" · `views?`: EventCalendarView[] · `weekStartsOn?`: 0 \| 1 \| 2 \| 3 \| 4 \| 5 \| 6 |  |
| `RangeCalendar` | — | `autoFocus?`: boolean · `defaultMonth?`: ISO date · `defaultValue?`: { start, end } of ISO dates · `disabled?`: boolean · `labels?`: LabelsProp<CalendarLabels> · `max?`: ISO date · `min?`: ISO date · `month?`: ISO date · `months?`: number · `onMonthChange?`: handler · `onValueChange?`: handler · `value?`: { start, end } of ISO dates · `weekStartsOn?`: 0 \| 1 \| 2 \| 3 \| 4 \| 5 \| 6 |  |
| `TimeField` | — | `defaultValue?`: string \| null · `disabled?`: boolean · `end?`: node · `hourCycle?`: 12 \| 24 · `invalid?`: boolean · `labels?`: LabelsProp<TimeFieldLabels> · `max?`: string · `min?`: string · `onValueChange?`: handler · `readOnly?`: boolean · `required?`: boolean · `step?`: number · `value?`: string \| null · `withSeconds?`: boolean |  |
| `TimePicker` | — | `defaultOpen?`: boolean · `defaultValue?`: string \| null · `disabled?`: boolean · `hourCycle?`: 12 \| 24 · `invalid?`: boolean · `labels?`: LabelsProp<TimePickerLabels> · `max?`: string · `min?`: string · `onOpenChange?`: handler · `onValueChange?`: handler · `open?`: boolean · `readOnly?`: boolean · `required?`: boolean · `step?`: number · `value?`: string \| null · `withSeconds?`: boolean |  |

### Filters

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `FilterBar` | — | `filters`: FilterDefinition[] · `collapse?`: "auto" \| "always" \| "never" · `defaultOpen?`: boolean · `defaultValue?`: FilterValues · `disabled?`: boolean · `drawerSide?`: "end" \| "bottom" · `labels?`: LabelsProp<FilterBarLabels> · `loading?`: boolean · `now?`: ISO date-time · `onOpenChange?`: handler · `onValueChange?`: handler · `open?`: boolean · `resultCount?`: number · `value?`: FilterValues |  |

### Steps

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `Stepper` | `.Step` | `current`: number · `label?`: string · `labels?`: LabelsProp<StepperLabels> · `onStepSelect?`: handler · `orientation?`: "horizontal" \| "vertical" | `current` is required; its children are `Stepper.Step` nodes with nothing between. |
| `Stepper.Step` | — | `label`: node · `description?`: node · `href?`: string · `optional?`: boolean · `selectable?`: boolean · `status?`: "error" \| "skipped" |  |
| `Wizard` | `.Step` | `defaultStep?`: number · `form?`: form name · `headingLevel?`: 2 \| 3 \| 4 \| 5 \| 6 · `label?`: string · `labels?`: LabelsProp<WizardLabels> · `onComplete?`: handler · `onStepChange?`: handler · `orientation?`: "horizontal" \| "vertical" · `step?`: number | `form` names a declared form; each `Wizard.Step` lists its `fields`, which Next validates. |
| `Wizard.Step` | — | `label`: node · `description?`: node · `fields?`: string[] · `optional?`: boolean |  |

### Toolbars

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `ToggleGroup` | `.Item` | `type`: "single" \| "multiple" · `defaultValue?`: string \| string[] · `disabled?`: boolean · `invalid?`: boolean · `onValueChange?`: handler · `orientation?`: "horizontal" \| "vertical" · `required?`: boolean · `value?`: string \| string[] | `type` (`single` or `multiple`) is required and sets the value's shape: a string or an array. |
| `ToggleGroup.Item` | — | `value`: string · `disabled?`: boolean · `icon?`: icon name · `label?`: string \| undefined |  |
| `Toolbar` | `.Group` `.Item` `.Separator` | `aria-label?`: string · `labels?`: LabelsProp<ToolbarLabels> · `orientation?`: "horizontal" \| "vertical" · `overflow?`: boolean | `aria-label` is required; its units are direct children, so overflow can move them into More. |
| `Toolbar.Group` | — | — |  |
| `Toolbar.Item` | — | `menu?`: node |  |
| `Toolbar.Separator` | — | — |  |

### Navigation

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `Breadcrumbs` | `.Item` | `itemsAfterCollapse?`: number · `itemsBeforeCollapse?`: number · `labels?`: LabelsProp<BreadcrumbsLabels> · `maxItems?`: number |  |
| `Breadcrumbs.Item` | — | `current?`: boolean |  |
| `NavList` | `.Item` `.Section` | `label`: string |  |
| `NavList.Item` | — | `badge?`: node · `current?`: boolean · `icon?`: icon name |  |
| `NavList.Section` | — | `title`: ReactNode |  |
| `Pagination` | — | `pageCount`: number · `defaultPage?`: number · `labels?`: LabelsProp<PaginationLabels> · `onPageChange?`: handler · `page?`: number · `siblings?`: number |  |
| `Tabs` | `.List` `.Panel` `.Tab` | `activation?`: "automatic" \| "manual" · `defaultValue?`: string · `onValueChange?`: handler · `value?`: string · `variant?`: "underline" \| "enclosed" | Each `Tabs.Tab` and `Tabs.Panel` pair shares a `value` string. |
| `Tabs.List` | — | — |  |
| `Tabs.Panel` | — | `value`: string |  |
| `Tabs.Tab` | — | `value`: string · `icon?`: icon name |  |
| `TreeView` | — | `aria-label?`: string · `checkedIds?`: string[] · `defaultCheckedIds?`: string[] · `defaultExpandedIds?`: string[] · `defaultSelectedId?`: string \| null · `error?`: node · `expandedIds?`: string[] · `items?`: TreeNode[] · `labels?`: LabelsProp<TreeViewLabels> · `loading?`: boolean · `onAction?`: handler · `onCheckedIdsChange?`: handler · `onExpandedIdsChange?`: handler · `onSelectedIdChange?`: handler · `selectedId?`: string \| null · `selectionMode?`: "none" \| "single" \| "multiple" · `virtualizeAbove?`: number | Give it `items` as data; items nest through `children`, and every level's `href` passes the URL rules. |

### Disclosure

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `Accordion` | `.Content` `.Item` `.Trigger` | `collapsible?`: boolean · `defaultValue?`: string \| null \| string[] · `headingLevel?`: 1 \| 2 \| 3 \| 4 \| 5 \| 6 · `multiple?`: boolean · `onValueChange?`: handler · `value?`: string \| null \| string[] |  |
| `Accordion.Content` | — | — |  |
| `Accordion.Item` | — | `value`: string · `disabled?`: boolean | `value` is required and unique among its siblings; the root's `value`/`defaultValue` names open items by it. |
| `Accordion.Trigger` | — | — |  |
| `Collapsible` | `.Content` `.Trigger` | `defaultOpen?`: boolean · `disabled?`: boolean · `onOpenChange?`: handler · `open?`: boolean |  |
| `Collapsible.Content` | — | — |  |
| `Collapsible.Trigger` | — | `hideChevron?`: boolean · `iconEnd?`: icon name · `iconStart?`: icon name · `loading?`: boolean · `variant?`: "primary" \| "secondary" \| "ghost" \| "danger" |  |

### Overlays

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `Dialog` | `.Body` `.Close` `.Content` `.Description` `.Footer` `.Header` `.Title` `.Trigger` | `defaultOpen?`: boolean · `dialogId?`: string · `onOpenChange?`: handler | Give it a `dialogId`; `openDialog`/`closeDialog` and its own trigger and close buttons share one open state. |
| `Dialog.Body` | — | — |  |
| `Dialog.Close` | — | `iconEnd?`: icon name · `iconStart?`: icon name · `loading?`: boolean · `variant?`: "primary" \| "secondary" \| "ghost" \| "danger" |  |
| `Dialog.Content` | — | `labels?`: LabelsProp<DialogLabels> · `lightDismiss?`: boolean · `role?`: "dialog" \| "alertdialog" · `showClose?`: boolean |  |
| `Dialog.Description` | — | — |  |
| `Dialog.Footer` | — | — |  |
| `Dialog.Header` | — | — |  |
| `Dialog.Title` | — | — |  |
| `Dialog.Trigger` | — | `iconEnd?`: icon name · `iconStart?`: icon name · `loading?`: boolean · `variant?`: "primary" \| "secondary" \| "ghost" \| "danger" |  |
| `Drawer` | `.Body` `.Close` `.Content` `.Description` `.Footer` `.Header` `.Title` `.Trigger` | `defaultOpen?`: boolean · `dialogId?`: string · `onOpenChange?`: handler | Give it a `dialogId`; `openDialog`/`closeDialog` and its own trigger and close buttons share one open state. |
| `Drawer.Body` | — | — |  |
| `Drawer.Close` | — | `iconEnd?`: icon name · `iconStart?`: icon name · `loading?`: boolean · `variant?`: "primary" \| "secondary" \| "ghost" \| "danger" |  |
| `Drawer.Content` | — | `labels?`: LabelsProp<DialogLabels> · `lightDismiss?`: boolean · `role?`: "dialog" \| "alertdialog" · `showClose?`: boolean · `side?`: "end" \| "bottom" |  |
| `Drawer.Description` | — | — |  |
| `Drawer.Footer` | — | — |  |
| `Drawer.Header` | — | — |  |
| `Drawer.Title` | — | — |  |
| `Drawer.Trigger` | — | `iconEnd?`: icon name · `iconStart?`: icon name · `loading?`: boolean · `variant?`: "primary" \| "secondary" \| "ghost" \| "danger" |  |
| `DropdownMenu` | `.CheckboxItem` `.Content` `.Item` `.Label` `.RadioGroup` `.RadioItem` `.Separator` `.Trigger` | `defaultOpen?`: boolean · `onOpenChange?`: handler · `open?`: boolean · `placement?`: "top" \| "right" \| "bottom" \| "left" \| "top-start" \| "top-end" \| "right-start" \| "right-end" \| "bottom-start" \| "bottom-end" \| "left-start" \| "left-end" |  |
| `DropdownMenu.CheckboxItem` | — | `checked?`: boolean · `closeOnSelect?`: boolean · `defaultChecked?`: boolean · `disabled?`: boolean · `onCheckedChange?`: handler · `onSelect?`: handler · `shortcut?`: node |  |
| `DropdownMenu.Content` | — | — |  |
| `DropdownMenu.Item` | — | `closeOnSelect?`: boolean · `disabled?`: boolean · `icon?`: icon name · `onSelect?`: handler · `shortcut?`: node · `variant?`: "default" \| "danger" |  |
| `DropdownMenu.Label` | — | — |  |
| `DropdownMenu.RadioGroup` | — | `defaultValue?`: string · `onValueChange?`: handler · `value?`: string |  |
| `DropdownMenu.RadioItem` | — | `value`: string · `closeOnSelect?`: boolean · `disabled?`: boolean · `onSelect?`: handler · `shortcut?`: node |  |
| `DropdownMenu.Separator` | — | — |  |
| `DropdownMenu.Trigger` | — | `iconEnd?`: icon name · `iconStart?`: icon name · `loading?`: boolean · `variant?`: "primary" \| "secondary" \| "ghost" \| "danger" |  |
| `HoverCard` | `.Content` `.Toggle` `.Trigger` | `closeDelay?`: number · `defaultOpen?`: boolean · `disabled?`: boolean · `labels?`: LabelsProp<HoverCardLabels> · `onOpenChange?`: handler · `open?`: boolean · `openDelay?`: number · `placement?`: "top" \| "right" \| "bottom" \| "left" \| "top-start" \| "top-end" \| "right-start" \| "right-end" \| "bottom-start" \| "bottom-end" \| "left-start" \| "left-end" |  |
| `HoverCard.Content` | — | — |  |
| `HoverCard.Toggle` | — | `icon?`: icon name · `label?`: string · `variant?`: "primary" \| "secondary" \| "ghost" \| "danger" |  |
| `HoverCard.Trigger` | — | — |  |
| `Popover` | `.Close` `.Content` `.Trigger` | `defaultOpen?`: boolean · `onOpenChange?`: handler · `open?`: boolean · `placement?`: "top" \| "right" \| "bottom" \| "left" \| "top-start" \| "top-end" \| "right-start" \| "right-end" \| "bottom-start" \| "bottom-end" \| "left-start" \| "left-end" |  |
| `Popover.Close` | — | `iconEnd?`: icon name · `iconStart?`: icon name · `loading?`: boolean · `variant?`: "primary" \| "secondary" \| "ghost" \| "danger" |  |
| `Popover.Content` | — | `arrow?`: boolean · `initialFocus?`: number |  |
| `Popover.Trigger` | — | `iconEnd?`: icon name · `iconStart?`: icon name · `loading?`: boolean · `variant?`: "primary" \| "secondary" \| "ghost" \| "danger" |  |
| `Tooltip` | — | `content`: node · `arrow?`: boolean · `defaultOpen?`: boolean · `delay?`: number · `disabled?`: boolean · `onOpenChange?`: handler · `open?`: boolean · `placement?`: "top" \| "right" \| "bottom" \| "left" \| "top-start" \| "top-end" \| "right-start" \| "right-end" \| "bottom-start" \| "bottom-end" \| "left-start" \| "left-end" | Exactly one child, and a focusable one (a Button or IconButton). |

### Media

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `Image` | — | `alt`: string · `height`: number · `src`: string \| null · `width`: number · `fit?`: "cover" \| "contain" · `onError?`: handler · `onLoad?`: handler · `placeholder?`: string · `placeholderColor?`: string · `priority?`: boolean · `radius?`: "none" \| "sm" \| "md" \| "lg" \| "xl" · `ratio?`: "intrinsic" \| "fill" \| "wide" \| "classic" \| "square" \| "portrait" · `sizes?`: string · `srcSet?`: string | `width` and `height` are the file's intrinsic size and are required; every URL passes the host's image policy. |
| `Lightbox` | `.Trigger` | `items`: LightboxItem[] · `label`: string · `defaultIndex?`: number · `defaultOpen?`: boolean · `index?`: number · `labels?`: LabelsProp<LightboxLabels> · `onIndexChange?`: handler · `onOpenChange?`: handler · `open?`: boolean |  |
| `Lightbox.Trigger` | — | `index`: number |  |
| `MasonryGrid` | — | `gap?`: "r1" \| "r2" \| "r3" \| "r4" \| "r5" \| "r6" · `list?`: boolean · `maxColumns?`: number · `minColumn?`: "sm" \| "md" \| "lg" |  |

### Marketing

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `CallToAction` | — | `title`: node · `actions?`: node · `body?`: node · `headingLevel?`: 1 \| 2 \| 3 \| 4 \| 5 \| 6 · `layout?`: "stacked" \| "split" · `variant?`: "plain" \| "band" | `actions` holds its buttons; a sign-up form (`EmailCapture`) goes in its children. |
| `Carousel` | `.Slide` | `label`: string · `autoplay?`: boolean \| number · `dots?`: boolean · `labels?`: LabelsProp<CarouselLabels> · `perView?`: 1 \| 2 \| 3 \| 4 | Its children must be `Carousel.Slide` nodes (a `$each` of them is fine), with nothing between. |
| `Carousel.Slide` | — | — |  |
| `EmailCapture` | — | `onSubmit`: handler · `consent?`: node · `consentRequired?`: boolean · `defaultValue?`: string · `description?`: node · `disabled?`: boolean · `hideLabel?`: boolean · `honeypot?`: boolean \| string · `labels?`: LabelsProp<EmailCaptureLabels> |  |
| `FeatureGrid` | `.Item` | `columns?`: GridColumns \| GridColumnMap · `gap?`: "r1" \| "r2" \| "r3" \| "r4" \| "r5" \| "r6" · `headingLevel?`: 2 \| 3 \| 4 \| 5 \| 6 · `minColumn?`: "sm" \| "md" \| "lg" · `variant?`: "plain" \| "card" |  |
| `FeatureGrid.Item` | — | `title`: node · `href?`: string · `icon?`: icon name |  |
| `FeatureRows` | `.Row` | `headingLevel?`: 2 \| 3 \| 4 \| 5 \| 6 · `mediaSide?`: "alternate" \| "start" \| "end" · `stackedMedia?`: "first" \| "last" |  |
| `FeatureRows.Row` | — | `title`: node · `actions?`: node · `eyebrow?`: node · `media?`: node · `mediaSide?`: "start" \| "end" |  |
| `Hero` | — | `title`: node · `actions?`: node · `backdrop?`: node · `eyebrow?`: node · `headingLevel?`: 1 \| 2 \| 3 \| 4 \| 5 \| 6 · `layout?`: "stacked" \| "split" · `lead?`: node · `media?`: node · `proof?`: node · `variant?`: "plain" \| "band" |  |
| `HowItWorks` | `.Step` | `headingLevel?`: 2 \| 3 \| 4 \| 5 \| 6 · `label?`: string · `orientation?`: "auto" \| "horizontal" \| "vertical" |  |
| `HowItWorks.Step` | — | `title`: node · `media?`: node |  |
| `LogoCloud` | — | `colorOnHover?`: boolean · `labels?`: LabelsProp<LogoCloudLabels> · `marquee?`: boolean \| number · `title?`: node | Each logo is an `Image` node with a meaningful `alt`. |
| `MediaCard` | `.Skeleton` | `title`: node · `actions?`: node · `badge?`: node · `description?`: node · `href?`: string · `image?`: MediaCardImage · `meta?`: node · `ratio?`: "wide" \| "classic" \| "square" \| "portrait" · `titleAs?`: "h2" \| "h3" \| "h4" \| "h5" \| "h6" |  |
| `MediaCard.Skeleton` | — | `label?`: string · `ratio?`: "wide" \| "classic" \| "square" \| "portrait" |  |
| `Pricing` | — | `currency`: ISO 4217 code · `plans`: PricingPlan[] · `billing?`: "monthly" \| "annual" · `currencyDisplay?`: "symbol" \| "narrowSymbol" \| "code" · `defaultBilling?`: "monthly" \| "annual" · `headingLevel?`: 2 \| 3 \| 4 \| 5 \| 6 · `labels?`: LabelsProp<PricingLabels> · `loading?`: boolean · `onBillingChange?`: handler | `currency` is an ISO 4217 code (`"EUR"`); amounts are numbers. |
| `PricingTable` | — | `groups`: PricingTableGroup[] · `plans`: Pick<PricingPlan, "id" \| "name" \| "highlighted" \| "badge">[] · `labels?`: LabelsProp<PricingLabels> |  |
| `SectionHeading` | — | `title`: node · `align?`: "start" \| "center" · `eyebrow?`: node · `headingLevel?`: 2 \| 3 \| 4 \| 5 \| 6 · `lead?`: node · `titleId?`: string |  |
| `Testimonial` | — | `name`: string · `quote`: node · `avatar?`: string \| false · `company?`: string · `labels?`: LabelsProp<TestimonialLabels> · `logo?`: node · `rating?`: number · `ratingMax?`: number · `role?`: string · `source?`: node · `sourceUrl?`: string · `variant?`: "card" \| "pull" \| "compact" |  |

### Motion

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `CountUp` | — | `value`: number \| null \| undefined · `format?`: FormatSpec · `formatOptions?`: Omit<FormatNumberOptions, "locale"> · `from?`: number · `threshold?`: number |  |
| `ScrollReveal` | — | `animation?`: "fade-up" \| "fade-in" \| "scale-in" · `as?`: "div" \| "section" \| "article" \| "aside" \| "header" \| "footer" \| "nav" \| "ul" \| "ol" \| "li" \| "figure" · `once?`: boolean · `rootMargin?`: string · `threshold?`: number |  |
| `Stagger` | — | `animation?`: "fade-up" \| "fade-in" \| "scale-in" · `as?`: "div" \| "section" \| "article" \| "aside" \| "header" \| "footer" \| "nav" \| "ul" \| "ol" \| "li" \| "figure" · `trigger?`: "scroll" \| "mount" |  |

### `classNames` keys

| Component | Keys |
| --- | --- |
| `Accordion.Content` | `body` |
| `Accordion.Trigger` | `chevron` `heading` |
| `ActivityFeed` | `day` `description` `footer` `item` `list` `mark` `time` `title` |
| `Alert` | `actions` `body` `icon` `title` |
| `Avatar` | `image` `initials` |
| `AvatarGroup` | `avatar` `item` `overflow` |
| `Badge` | `icon` |
| `Banner` | `actions` `body` `dismiss` `icon` `title` |
| `BarChart` | `legend` `notes` `plot` `table` `tooltip` |
| `Breadcrumbs` | `expand` `item` `list` `separator` |
| `Button` | `icon` `label` `spinner` |
| `Calendar` | `caption` `cell` `day` `grid` `month` `months` `weekday` |
| `CallToAction` | `actions` `body` `container` `text` `title` |
| `Carousel` | `controls` `dots` `next` `prev` `status` `toggle` `track` |
| `Checkbox` | `box` `input` `label` |
| `Chip` | `label` `remove` |
| `CodeBlock` | `actions` `code` `header` `language` `line` `pre` `title` |
| `Collapsible.Content` | `body` |
| `Collapsible.Trigger` | `icon` `label` `spinner` |
| `ColorPicker` | `alpha` `area` `contrast` `hue` `input` `note` `panel` `swatch` `swatches` `trigger` `value` |
| `Combobox` | `frame` `input` `listbox` `option` |
| `CopyButton` | `icon` `status` |
| `CurrencyInput` | `end` `input` `start` |
| `DataTable` | `bulkBar` `cell` `detail` `empty` `filterCell` `headerCell` `pagination` `row` `table` |
| `DatePicker` | `calendar` `error` `frame` `hint` `input` `panel` `trigger` |
| `DateRangePicker` | `calendar` `panel` `preset` `presets` `trigger` |
| `DescriptionList.Item` | `details` `term` |
| `Dialog.Close` | `icon` `label` `spinner` |
| `Dialog.Content` | `close` |
| `Dialog.Trigger` | `icon` `label` `spinner` |
| `Divider` | `label` `line` |
| `Drawer.Close` | `icon` `label` `spinner` |
| `Drawer.Content` | `close` |
| `Drawer.Trigger` | `icon` `label` `spinner` |
| `DropdownMenu.Item` | `icon` `shortcut` |
| `DropdownMenu.Trigger` | `icon` `label` `spinner` |
| `EmailCapture` | `consent` `form` `input` `row` `submit` `success` |
| `EmptyState` | `actions` `description` `icon` `title` |
| `ErrorFallback` | `details` `icon` `message` `retry` `title` |
| `EventCalendar` | `body` `event` `title` `toolbar` `views` |
| `FeatureGrid` | `container` |
| `FeatureGrid.Item` | `body` `icon` `link` `title` |
| `FeatureRows.Row` | `actions` `body` `eyebrow` `media` `text` `title` |
| `Field` | `layout` |
| `FilterBar` | `chip` `clear` `controls` `drawer` `field` `results` `summary` `trigger` |
| `FormActions` | `row` |
| `FormActions.Submit` | `icon` `label` `spinner` |
| `Grid` | `container` |
| `Heatmap` | `legend` `notes` `plot` `table` `tooltip` |
| `Hero` | `actions` `backdrop` `container` `eyebrow` `lead` `media` `proof` `text` `title` |
| `HowItWorks` | `list` |
| `HowItWorks.Step` | `body` `connector` `description` `marker` `media` `title` |
| `Image` | `fallback` `image` `placeholder` |
| `Input` | `end` `input` `start` |
| `Lightbox` | `caption` `close` `counter` `figure` `header` `image` `next` `prev` `stage` `title` |
| `LineChart` | `legend` `notes` `plot` `table` `tooltip` |
| `Link` | `icon` |
| `LogoCloud` | `list` `logo` `title` `toggle` `viewport` |
| `MaskedInput` | `end` `input` `start` |
| `MasonryGrid` | `item` |
| `MediaCard` | `actions` `body` `description` `footer` `image` `link` `media` `meta` `title` |
| `Meter` | `fill` `label` `track` `value` |
| `MultiSelect` | `chip` `frame` `input` `listbox` `option` |
| `NavList.Item` | `badge` `icon` `item` `label` |
| `NumberInput` | `end` `input` `start` |
| `OTPInput` | `box` `input` `separator` |
| `Pagination` | `list` `next` `page` `previous` `row` `status` |
| `PasswordInput` | `capsLock` `frame` `hints` `input` `meter` `toggle` |
| `Popover.Close` | `icon` `label` `spinner` |
| `Popover.Content` | `arrow` |
| `Popover.Trigger` | `icon` `label` `spinner` |
| `Pricing` | `action` `features` `plan` `plans` `price` `saving` `toggle` |
| `PricingTable` | `table` |
| `ProgressBar` | `fill` `label` `track` `value` |
| `ProgressRing` | `center` `indicator` `track` |
| `Radio` | `box` `input` `label` |
| `RangeCalendar` | `caption` `cell` `day` `grid` `month` `months` `weekday` |
| `RangeSlider` | `bubble` `control` `fill` `marks` `thumb` `track` |
| `Rating` | `icon` `item` |
| `SearchInput` | `end` `input` `start` |
| `SectionHeading` | `eyebrow` `lead` `title` |
| `Select` | `icon` `select` |
| `Slider` | `bubble` `control` `fill` `marks` `thumb` `track` |
| `StatCard` | `chart` `delta` `footer` `label` `unit` `value` |
| `StatusLabel` | `icon` `label` |
| `Stepper` | `compact` `list` |
| `Stepper.Step` | `connector` `description` `label` `marker` `meta` `target` |
| `Switch` | `label` `thumb` `track` |
| `Table` | `table` |
| `Table.HeaderCell` | `button` `icon` |
| `TagInput` | `chip` `frame` `input` `listbox` `message` `option` |
| `Testimonial` | `affiliation` `avatar` `caption` `header` `name` `quote` `source` |
| `TimeField` | `error` `frame` `literal` `segment` |
| `Timeline` | `day` `description` `footer` `item` `list` `mark` `time` `title` |
| `TimePicker` | `error` `frame` `list` `literal` `option` `panel` `segment` `trigger` |
| `Toolbar` | `menu` `more` |
| `Tooltip` | `arrow` |
| `TreeView` | `actions` `check` `icon` `item` `label` `toggle` |
| `VirtualizedTable` | `bulkBar` `cell` `detail` `empty` `filterCell` `headerCell` `pagination` `row` `table` |
| `Wizard` | `actions` `heading` `panel` `stepper` |
<!-- /GENERATED:components -->

## Not addressable

These library components are not available to documents, each for the reason given.

<!-- GENERATED:not-addressable -->
| Component | Why not, and what to use instead |
| --- | --- |
| `AppShell` | The app frame is the host's; a view renders inside its main region. |
| `AvatarUpload` | Needs a host upload handler; show a picture with Avatar. |
| `CommandPalette` | An app-wide launcher bound to a global shortcut; use a DropdownMenu for a view's actions. |
| `ContextMenu` | A shortcut that is never the only door; use DropdownMenu. |
| `DensitySwitcher` | Page density is the host's; a document sets `density` or `data-density` on its own subtree. |
| `DocumentTitleProvider` | The page title is host chrome. |
| `ErrorBoundary` | The renderer contains every node's errors itself; use ErrorFallback to show a failure. |
| `FileUpload` | Its value is File objects or a host upload handler. |
| `Footer` | The site footer is the host's. |
| `InputSwitcher` | The input mode is the host's. |
| `Kanban` | Moving work items is an editing surface over host records; use DataTable or a list of Cards. |
| `LocaleProvider` | Locale and translations are the host's. |
| `NavigationMenu` | Site navigation is the host's; use NavList or Tabs inside a view. |
| `Parallax` | Decoration that only works when its caller positions it; a Hero owns its own backdrop. |
| `PreferencesMenu` | Theme, density and input preferences are the host's. |
| `ReadingProgress` | Page-level reading chrome that needs the host's scroll container. |
| `RequireAuth` | Auth is the host's; a gate whose status a document supplies protects nothing. |
| `RouterProvider` | The host's router already drives every library link a document renders. |
| `SiteHeader` | The site's top bar is the host's. |
| `Splitter` | Resizable panes are host layout; lay a view out with Grid or Stack. |
| `Spotlight` | A pointer-following wash with no information; it is meant to wrap a component type. |
| `ThemeScript` | An inline script for the host's document head. |
| `ThemeSwitcher` | Theme is the host's choice, never a document's. |
| `ToastProvider` | The host mounts the one toast stack; documents raise toasts with `showToast`. |
| `TreeView.Item` | TreeView reads its items by element type; give TreeView its `items` data instead. |
<!-- /GENERATED:not-addressable -->

## Icons

<!-- GENERATED:icons -->
`activity` `archive` `arrow-down` `arrow-down-right` `arrow-left` `arrow-right` `arrow-up` `arrow-up-down` `arrow-up-right` `at-sign` `award` `badge-check` `ban` `battery` `bell` `bell-off` `book-open` `bookmark` `briefcase` `bug` `building-2` `calendar` `calendar-check` `calendar-days` `camera` `chart-area` `chart-bar` `chart-column` `chart-line` `chart-pie` `check` `check-check` `chevron-down` `chevron-left` `chevron-right` `chevron-up` `chevrons-up-down` `circle` `circle-alert` `circle-check` `circle-dot` `circle-question-mark` `circle-x` `clipboard` `clock` `cloud` `code` `compass` `copy` `cpu` `credit-card` `database` `dollar-sign` `download` `ellipsis` `ellipsis-vertical` `external-link` `eye` `eye-off` `file` `file-text` `flag` `folder` `folder-open` `funnel` `gauge` `gift` `git-branch` `globe` `hard-drive` `hash` `heart` `history` `hourglass` `house` `image` `inbox` `info` `key` `laptop` `layers` `layout-dashboard` `layout-grid` `lightbulb` `link` `list` `list-filter` `loader` `lock` `lock-open` `log-in` `log-out` `mail` `map` `map-pin` `maximize-2` `megaphone` `menu` `message-square` `mic` `minimize-2` `minus` `monitor` `moon` `navigation` `network` `newspaper` `octagon-alert` `package` `panel-left` `paperclip` `pause` `pencil` `percent` `phone` `play` `plug` `plus` `power` `printer` `receipt` `redo-2` `refresh-cw` `rocket` `rotate-ccw` `save` `search` `send` `server` `settings` `share-2` `shield` `shield-alert` `shield-check` `shopping-cart` `sigma` `signal` `siren` `sliders-horizontal` `smartphone` `sparkles` `square` `star` `sun` `tag` `target` `terminal` `thermometer` `timer` `trash-2` `trending-down` `trending-up` `triangle-alert` `trophy` `truck` `undo-2` `upload` `user` `user-plus` `users` `video` `wallet` `wifi` `wifi-off` `workflow` `wrench` `x` `zap`
<!-- /GENERATED:icons -->
