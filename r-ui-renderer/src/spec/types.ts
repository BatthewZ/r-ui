/**
 * The ViewSpec wire format, version 2: a JSON document describing a view built
 * from @batthewz/r-ui-react-components. VIEWSPEC.md is the prose for these
 * types; the two change together.
 *
 * This module is React-free and import-free: it is the shape a server, a CLI,
 * a JSON Schema and a Zod schema are all derived from. Every closed set is a
 * `const` tuple so the type, the runtime check and the schema read one list.
 */

// ---------------------------------------------------------------------------
// JSON

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type JsonObject = { readonly [key: string]: JsonValue };

// ---------------------------------------------------------------------------
// Document

export const FORMAT_VERSION = 2;

export const DENSITIES = ["comfortable", "compact"] as const;
export type Density = (typeof DENSITIES)[number];

export interface ViewSpec {
  /** Always `2`. */
  readonly version: typeof FORMAT_VERSION;
  /** 1 to 200 characters. */
  readonly title: string;
  readonly description?: string;
  /** Written as `data-density` on the view root unless the host passes its own. */
  readonly density?: Density;
  /** Seeds `state.…`. Keys are names (see `NAME_PATTERN`). */
  readonly state?: { readonly [name: string]: JsonValue };
  readonly data?: { readonly [name: string]: DataBinding };
  readonly forms?: { readonly [name: string]: FormDef };
  /** Written last: everything above it has closed by the time it streams. */
  readonly root: ViewNode;
  /** Ignored. Lets an editor point at the JSON Schema. */
  readonly $schema?: string;
}

/**
 * The order keys must appear in for a document to render as it streams. Each
 * tuple is also the complete list of keys its object may carry.
 */
export const DOCUMENT_KEYS = ["$schema", "version", "title", "description", "density", "state", "data", "forms", "root"] as const;
export const COMPONENT_NODE_KEYS = ["component", "props", "children"] as const;
export const EACH_NODE_KEYS = ["$each", "as", "key", "node"] as const;
export const COND_NODE_KEYS = ["$cond", "then", "else"] as const;

/** Data, state, form, field, alias and dialog names. */
export const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Path segments and names that never resolve and are never written. */
export const FORBIDDEN_SEGMENTS = ["__proto__", "constructor", "prototype"] as const;

// ---------------------------------------------------------------------------
// Nodes

/** Text, rendered as is. */
export type TextNode = string;

/** A registered component; `component` may name a part: `"Card.Header"`. */
export interface ComponentNode {
  readonly component: string;
  readonly props?: Props;
  readonly children?: readonly ViewNode[];
}

/** The value at a reference path, rendered as text. */
export interface RefNode {
  readonly $ref: string;
}

/** `node` once per element of the array at `$each`. */
export interface EachNode {
  readonly $each: string;
  /** The element's name inside `node`; `<as>Index` is its position. */
  readonly as: string;
  /** A path inside the element whose value keys it (`"id"`); the position when absent. */
  readonly key?: string;
  readonly node: ViewNode;
}

/** `then` when the condition holds, else `else` (or nothing). */
export interface CondNode {
  readonly $cond: Condition;
  readonly then: ViewNode;
  readonly else?: ViewNode;
}

export type ViewNode = TextNode | ComponentNode | RefNode | FormatMarker | EachNode | CondNode;

// ---------------------------------------------------------------------------
// Conditions

export const COMPARISON_OPERATORS = ["eq", "ne", "gt", "lt", "in"] as const;
export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

/** A reference path, true when its value is truthy (an empty array is falsy). */
export type TruthCondition = string;

export interface NotCondition {
  readonly not: Condition;
}

/** Compares the value at `ref` with one operand. Exactly one operator key. */
export type ComparisonCondition = { readonly ref: string } & (
  | { readonly eq: JsonValue | RefMarker }
  | { readonly ne: JsonValue | RefMarker }
  | { readonly gt: number | string | RefMarker }
  | { readonly lt: number | string | RefMarker }
  | { readonly in: readonly JsonValue[] | RefMarker }
);

export type Condition = TruthCondition | NotCondition | ComparisonCondition;

// ---------------------------------------------------------------------------
// Values inside `props`

/** A value read from a reference path. The object's only key. */
export interface RefMarker {
  readonly $ref: string;
}

/** A node where a component wants a React node (or a row template). The object's only key. */
export interface NodeMarker {
  readonly $node: ViewNode;
}

/** A value formatted to text with the host's locale. The object's only key. */
export interface FormatMarker {
  readonly $format: FormatOptions & { readonly value: PropValue };
}

export type Marker = RefMarker | NodeMarker | FormatMarker;

/**
 * Any value a prop may hold. Markers resolve wherever they appear; an action
 * (or a list of them) is a handler under an `on[A-Z]…` key, and data anywhere
 * else.
 */
export type PropValue =
  | JsonPrimitive
  | Marker
  | Handler
  | readonly PropValue[]
  | { readonly [key: string]: PropValue };

export type Props = { readonly [name: string]: PropValue };

/** Keys that hold an event handler: `on` then an upper-case letter. */
export const HANDLER_KEY_PATTERN = /^on[A-Z]/;

// ---------------------------------------------------------------------------
// Actions

export const ACTION_NAMES = [
  "setState",
  "submitForm",
  "resetForm",
  "navigate",
  "showToast",
  "apiCall",
  "openDialog",
  "closeDialog",
] as const;
export type ActionName = (typeof ACTION_NAMES)[number];

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const TOAST_TONES = ["neutral", "success", "warning", "error", "info", "serious", "stale"] as const;
export type ToastTone = (typeof TOAST_TONES)[number];

export type Dynamic<T> = T | RefMarker;

/** Query string values; `$ref` resolves at the moment of the request. */
export type QueryParams = { readonly [name: string]: Dynamic<string | number | boolean | null> };

export interface SetStatePayload {
  /** Literal. `state.` then a path; missing objects on the way are created. */
  readonly path: string;
  /** Shallow-merged into the current value when both are plain objects; else replaces it. */
  readonly value: PropValue;
}

export interface FormPayload {
  /** Literal form name. */
  readonly form: string;
}

export interface NavigatePayload {
  /** Resolved, then checked against the URL scheme allowlist. */
  readonly to: Dynamic<string>;
  readonly replace?: boolean;
}

export interface ShowToastPayload {
  readonly title: Dynamic<string> | FormatMarker;
  readonly description?: Dynamic<string> | FormatMarker;
  readonly tone?: ToastTone;
}

export interface ApiCallPayload {
  /** Literal. Relative or same-origin unless the host's `allowUrl` says otherwise. */
  readonly endpoint: string;
  /** Literal. `GET` by default. */
  readonly method?: HttpMethod;
  readonly query?: QueryParams;
  /** Resolved deeply, then sent as JSON. Not sent with `GET` or `DELETE`. */
  readonly body?: PropValue;
  /** Literal. `state.` then a path; receives the parsed response. */
  readonly into?: string;
  /** Literal handlers. `event.value` is the parsed response. */
  readonly onSuccess?: Handler;
  /** Literal handlers. `event.value` is `{ status, message, body }`. */
  readonly onError?: Handler;
}

export interface DialogPayload {
  /** Literal. Matches a dialog component's `dialogId` prop. */
  readonly dialogId: string;
}

export type Action =
  | { readonly action: "setState"; readonly payload: SetStatePayload }
  | { readonly action: "submitForm"; readonly payload: FormPayload }
  | { readonly action: "resetForm"; readonly payload: FormPayload }
  | { readonly action: "navigate"; readonly payload: NavigatePayload }
  | { readonly action: "showToast"; readonly payload: ShowToastPayload }
  | { readonly action: "apiCall"; readonly payload: ApiCallPayload }
  | { readonly action: "openDialog"; readonly payload: DialogPayload }
  | { readonly action: "closeDialog"; readonly payload: DialogPayload };

/** One action, or several run in order (each awaited; a failure stops the rest). */
export type Handler = Action | readonly Action[];

/** Payload keys that are read literally, never resolved, per action. */
export const LITERAL_PAYLOAD_KEYS: { readonly [A in ActionName]: readonly string[] } = {
  setState: ["path"],
  submitForm: ["form"],
  resetForm: ["form"],
  navigate: ["replace"],
  showToast: ["tone"],
  apiCall: ["endpoint", "method", "into", "onSuccess", "onError"],
  openDialog: ["dialogId"],
  closeDialog: ["dialogId"],
};

// ---------------------------------------------------------------------------
// References

/** Roots a reference path may start with besides local names (`$each` aliases, template names). */
export const REF_ROOTS = ["data", "status", "state", "forms", "event"] as const;
export type RefRoot = (typeof REF_ROOTS)[number];

export const BINDING_STATUSES = ["loading", "ready", "error"] as const;
export type BindingStatus = (typeof BINDING_STATUSES)[number];

// ---------------------------------------------------------------------------
// Data bindings

/** Literal data. Markers inside `value` are data, not resolved. */
export interface StaticBinding {
  readonly type: "static";
  readonly value: JsonValue;
}

/** Requested through the host's `fetch` adapter; refetched when a resolved `query`/`body` changes. */
export interface ApiBinding {
  readonly type: "api";
  /** Literal. Relative or same-origin unless the host's `allowUrl` says otherwise. */
  readonly endpoint: string;
  readonly method?: "GET" | "POST";
  /** `$ref`s here may read `state.…` only. */
  readonly query?: QueryParams;
  /** `$ref`s here may read `state.…` only. */
  readonly body?: PropValue;
}

/** Resolved by the host's `resolveSource` adapter. */
export interface SourceBinding {
  readonly type: "source";
  readonly source: string;
  /** `$ref`s here may read `state.…` only. */
  readonly params?: { readonly [name: string]: PropValue };
}

export type DataBinding = StaticBinding | ApiBinding | SourceBinding;
export const BINDING_TYPES = ["static", "api", "source"] as const;

// ---------------------------------------------------------------------------
// Forms

export const FIELD_TYPES = ["text", "number", "boolean", "date", "dateRange", "list"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const VALIDATION_TRIGGERS = ["change", "blur", "submit"] as const;
export type ValidationTrigger = (typeof VALIDATION_TRIGGERS)[number];

export const RULE_NAMES = ["required", "minLength", "maxLength", "pattern", "min", "max"] as const;
export type RuleName = (typeof RULE_NAMES)[number];

/** Checked in this order; the first that fails is the field's error. */
export interface FieldRules {
  /** Empty is `null`, `""`, `false` and `[]`. */
  readonly required?: boolean;
  /** Characters of a text field, items of a list field. */
  readonly minLength?: number;
  readonly maxLength?: number;
  /** A text field's value matches this source (tested on at most `LIMITS.patternInput` characters). */
  readonly pattern?: string;
  /** A number (number fields) or an ISO date (date and dateRange fields). */
  readonly min?: number | string;
  readonly max?: number | string;
}

export interface FormFieldDef {
  /** `"text"` when absent. Dates travel as ISO strings both ways. */
  readonly type?: FieldType;
  /** The type's empty value when absent; a `$ref` mounts the form once it resolves. */
  readonly initialValue?: JsonValue | RefMarker;
  readonly rules?: FieldRules;
  /** Any failed rule's message. */
  readonly message?: string;
  /** A message per rule, over `message`. */
  readonly messages?: { readonly [R in RuleName]?: string };
}

export interface FormDef {
  /** Field keys are names (no dots): `forms.<form>.values.<field>`. */
  readonly fields: { readonly [field: string]: FormFieldDef };
  readonly validateOn?: ValidationTrigger;
  readonly revalidateOn?: ValidationTrigger;
  /** `event.value` is the submitted values as JSON. */
  readonly onSubmit?: Handler;
  /** `event.value` is the errors by field. */
  readonly onInvalid?: Handler;
}

/** What `forms.<name>` reads. */
export interface FormRefState {
  readonly values: { readonly [field: string]: JsonValue };
  readonly errors: { readonly [field: string]: string };
  readonly submitting: boolean;
  readonly dirty: boolean;
  readonly submitCount: number;
  readonly submitFailed: boolean;
}

// ---------------------------------------------------------------------------
// Formatting

export const FORMAT_STYLES = [
  "number",
  "integer",
  "compact",
  "percent",
  "delta",
  "bytes",
  "currency",
  "unit",
  "date",
  "datetime",
  "time",
] as const;
export type FormatStyle = (typeof FORMAT_STYLES)[number];

export interface FormatOptions {
  readonly style: FormatStyle;
  /** ISO 4217, with `currency`. */
  readonly currency?: string;
  /** An Intl unit id, with `unit`. */
  readonly unit?: string;
  readonly notation?: "standard" | "compact";
  readonly minimumFractionDigits?: number;
  readonly maximumFractionDigits?: number;
  readonly maximumSignificantDigits?: number;
  readonly signDisplay?: "auto" | "always" | "exceptZero" | "negative" | "never";
  readonly currencyDisplay?: "symbol" | "narrowSymbol" | "code" | "name";
  readonly unitDisplay?: "short" | "long" | "narrow";
  readonly useGrouping?: boolean;
  /** With `date`, `datetime`. */
  readonly dateStyle?: "full" | "long" | "medium" | "short";
  /** With `datetime`, `time`. */
  readonly timeStyle?: "full" | "long" | "medium" | "short";
  /** With `date`, `datetime`, `time`. */
  readonly timeZone?: "local" | "UTC";
  /** Text for a missing value; "—" when absent. */
  readonly missing?: string;
}

/** A style name alone, or the style with its options. */
export type FormatSpec = FormatStyle | FormatOptions;

// ---------------------------------------------------------------------------
// DataTable columns (the document's shape; the renderer builds the library's)

export interface DataTableColumnSpec {
  readonly id: string;
  /** Text, or `{ "$node": … }`. The column `id` when absent. */
  readonly header?: string | NodeMarker;
  /** Dot path into the row; the column `id` when absent. Sort and filters read it. */
  readonly field?: string;
  /** How the value shows; sort and filters still read the raw value. */
  readonly format?: FormatSpec;
  /** A row template: `row`, `rowIndex` and `value` are in scope. */
  readonly cell?: NodeMarker;
  readonly label?: string;
  readonly numeric?: boolean;
  readonly sortable?: boolean;
  readonly firstDirection?: "asc" | "desc";
  readonly priority?: 1 | 2 | 3 | 4 | 5;
  readonly truncate?: boolean;
  readonly wrap?: boolean;
  readonly required?: boolean;
  readonly resizable?: boolean;
  /** A CSS length or `calc()`. */
  readonly width?: string;
  readonly minWidth?: string;
  readonly maxWidth?: string;
  readonly filter?:
    | { readonly type: "text"; readonly placeholder?: string }
    | { readonly type: "select"; readonly options: readonly { readonly value: string; readonly label: string }[] };
}

// ---------------------------------------------------------------------------
// Built-in components (owned by the renderer; the library has no equivalent)

export const TEXT_ELEMENTS = ["p", "span", "strong", "em", "small", "code", "blockquote"] as const;
export const TEXT_SIZES = ["body-1", "body-2", "body-3"] as const;
export const TEXT_TONES = ["primary", "secondary", "muted", "error", "success", "warning", "info", "serious", "stale"] as const;
export const TEXT_WEIGHTS = ["normal", "medium", "semibold"] as const;
export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export const HEADING_SIZES = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

export type TextTone = (typeof TEXT_TONES)[number];

export interface TextProps {
  /** `"p"` when absent. */
  readonly as?: (typeof TEXT_ELEMENTS)[number];
  /** Inherited when absent. */
  readonly size?: (typeof TEXT_SIZES)[number];
  readonly tone?: TextTone;
  readonly weight?: (typeof TEXT_WEIGHTS)[number];
  readonly className?: string;
}

export interface HeadingProps {
  /** The element: `h1`…`h6`. 2 when absent. */
  readonly level?: (typeof HEADING_LEVELS)[number];
  /** The look, independent of the level; matches the level when absent. */
  readonly size?: (typeof HEADING_SIZES)[number];
  readonly tone?: TextTone;
  readonly className?: string;
}

export interface IconProps {
  readonly name: string;
  /** Names the icon for assistive tech; without it the icon is decorative. */
  readonly label?: string;
  readonly tone?: TextTone;
  readonly className?: string;
}

// ---------------------------------------------------------------------------
// Issues

/**
 * Every issue code, with its severity and what it means. Errors are exactly
 * what a schema can express (shape, types, closed sets, syntax): `ok` means
 * "conforms", and the Zod schema agrees on it. Anything that needs scope,
 * the registry, the contracts or a cross-reference is a warning. The last
 * group is reported only at render time.
 */
export const ISSUE_CODE_INFO = {
  "invalid-json": { severity: "error", summary: "The text is not JSON." },
  "invalid-type": { severity: "error", summary: "A value has the wrong JSON type for its place in the format." },
  "invalid-value": { severity: "error", summary: "A value is outside the set the format allows there." },
  "missing-key": { severity: "error", summary: "A required key is absent." },
  "unknown-key": { severity: "error", summary: "A key the format does not define." },
  "unsupported-version": { severity: "error", summary: "`version` is not 2." },
  "invalid-node": { severity: "error", summary: "A node matches none of the node shapes." },
  "invalid-ref": { severity: "error", summary: "A reference path is malformed." },
  "invalid-name": { severity: "error", summary: "A name breaks the name rules or is reserved." },
  "limit-exceeded": { severity: "warning", summary: "Past a limit (depth, handler chain); the excess is not rendered or run." },
  "undeclared-name": { severity: "warning", summary: "A reference, form, field, dialog or binding name nothing declares." },
  "unknown-component": { severity: "warning", summary: "A component name nothing registers." },
  "not-addressable": { severity: "warning", summary: "A library component documents cannot use." },
  "misplaced-part": { severity: "warning", summary: "A compound part outside its parent." },
  "unknown-prop": { severity: "warning", summary: "A prop the component does not take." },
  "invalid-prop-value": { severity: "warning", summary: "A prop value outside the component's set or shape." },
  "unknown-icon": { severity: "warning", summary: "An icon name the icon set does not have." },
  "forbidden-prop": { severity: "warning", summary: "A prop the renderer drops." },
  "refused-url": { severity: "warning", summary: "A URL the scheme allowlist or the origin policy refuses." },
  "unknown-class": { severity: "warning", summary: "A class outside the class vocabulary; it would style nothing." },
  "sensitive-component": { severity: "warning", summary: "A component the host must allow before it renders." },
  "controlled-in-field": { severity: "warning", summary: "A value on a control inside a bound Field; it would detach the binding." },
  "key-order": { severity: "warning", summary: "Keys out of the streaming order; the object renders only once it closes." },
  "duplicate-key": { severity: "warning", summary: "Two siblings share a key; positions are used instead." },
  "missing-adapter": { severity: "warning", summary: "The host did not provide the adapter this needs; nothing was sent." },
  "data-error": { severity: "error", summary: "A data binding failed." },
  "action-failed": { severity: "error", summary: "An action failed." },
  "render-error": { severity: "error", summary: "A node threw while rendering." },
  "not-renderable": { severity: "warning", summary: "A value its place cannot use: not text where text renders, not an array under `$each`." },
  "stream-incomplete": { severity: "error", summary: "The stream ended before the document closed." },
} as const satisfies { readonly [code: string]: { readonly severity: IssueSeverity; readonly summary: string } };

export type IssueCode = keyof typeof ISSUE_CODE_INFO;
export const ISSUE_CODES = Object.keys(ISSUE_CODE_INFO) as readonly IssueCode[];

/** Codes only the renderer reports (never `validateViewSpec`). */
export const RUNTIME_ISSUE_CODES = [
  "duplicate-key",
  "missing-adapter",
  "data-error",
  "action-failed",
  "render-error",
  "not-renderable",
  "stream-incomplete",
] as const satisfies readonly IssueCode[];

export type IssueSeverity = "error" | "warning";

export interface Issue {
  readonly code: IssueCode;
  /** JSON Pointer (RFC 6901) into the document; `""` is the document itself. */
  readonly path: string;
  readonly severity: IssueSeverity;
  readonly message: string;
  /** What to write instead, when there is one answer. */
  readonly suggestion?: string;
  /** 1-based, in the text the validator was given; always on `invalid-json`. */
  readonly line?: number;
  readonly column?: number;
}

export type ValidationResult =
  | { readonly ok: true; readonly spec: ViewSpec; readonly issues: readonly Issue[] }
  | { readonly ok: false; readonly spec?: undefined; readonly issues: readonly Issue[] };

// ---------------------------------------------------------------------------
// Contracts: what the renderer, the validator and the reference know about a
// component beyond how to construct it. One record per addressable name, in
// the spelling a document uses (`"Card"`, `"Card.Header"`).

/**
 * Where a contract field names a prop: `"href"`, `"items[].href"` (each
 * element's `href`), `"x[]"` (each element), `"labels.title"`, `"value.*"`
 * (each value of a record).
 */
export type PropPath = string;

/** How a prop's ISO string(s) become the `Date`s the component takes. */
export const DATE_KINDS = ["date", "datetime", "dateRange"] as const;
export type DateKind = (typeof DATE_KINDS)[number];

/**
 * How a callback's arguments become `event.value`. `value` (the default): the
 * first argument, a DOM event unwrapped to its target's value (`checked` for
 * a checkbox or radio), a Set to an array, a Date to ISO.
 */
export const EVENT_VALUE_KINDS = ["value", "checked", "set", "date", "datetime", "dateRange"] as const;
export type EventValueKind = (typeof EVENT_VALUE_KINDS)[number];

/** How a parent reads its children, which forbids anything between them. */
export const CHILD_INSPECTIONS = ["identity", "props", "clone", "count"] as const;
export type ChildInspection = (typeof CHILD_INSPECTIONS)[number];

/** Document values the library takes in another shape, under the same or another prop name. */
export type PropCoercion =
  /** A dot path into a row becomes `(row) => value`, passed as `to`. */
  | { readonly kind: "accessor"; readonly to: string }
  /** `DataTableColumnSpec[]` becomes the library's columns. */
  | { readonly kind: "columns" }
  /** A string of delimiter characters becomes a `RegExp` matching any of them. */
  | { readonly kind: "delimiter" }
  /** `{ value, label, disabled? }[]` becomes the component's `<option>` children. */
  | { readonly kind: "options" };

/** One row of a component's props table in the reference. */
export interface PropDoc {
  readonly name: string;
  /** The declared type, one line. */
  readonly type: string;
  readonly required: boolean;
  readonly description?: string;
}

export interface ComponentContract {
  /** The reference section: the library's group, `builtin`, or a host's own. */
  readonly category: string;
  /** The one thing an author would otherwise get wrong. */
  readonly note?: string;
  /** Reference and `unknown-prop`: every prop a document may set. */
  readonly props?: readonly PropDoc[];
  /** `classNames` keys. */
  readonly slots?: readonly string[];
  /** Props bounded to a closed set. */
  readonly propEnums?: { readonly [prop: string]: readonly (string | number | boolean)[] };
  /** URL props beyond the universal names (`href`, `src`, …), including nested and renamed ones. */
  readonly urlProps?: readonly PropPath[];
  /** URLs the browser fetches as images, at any depth; they pass `allowImageUrl`. */
  readonly imageProps?: readonly PropPath[];
  /** ISO strings that become Dates. */
  readonly dateProps?: { readonly [path: PropPath]: DateKind };
  /** An icon name string becomes the icon's element. */
  readonly iconProps?: readonly PropPath[];
  /** Props typed as a React node: text or `{ "$node": … }`. */
  readonly nodeProps?: readonly PropPath[];
  /** Row templates: a `$node` here becomes a function; the listed names are in scope. */
  readonly templateProps?: { readonly [path: PropPath]: readonly string[] };
  /** Arrays that become Sets (and Sets in `event.value` that become arrays). */
  readonly setProps?: readonly PropPath[];
  /** A FormatSpec becomes a formatter function. */
  readonly formatProps?: readonly PropPath[];
  /** Per callback, how `event.value` is made; `value` when absent. */
  readonly eventValue?: { readonly [callback: string]: EventValueKind };
  readonly coercions?: { readonly [prop: string]: PropCoercion };
  /** Present when the component reads its children; nothing may sit between them. */
  readonly childInspection?: ChildInspection;
  /** Props that choose an element, with the tags each allows. */
  readonly elementProps?: { readonly [prop: string]: readonly string[] };
  /** Props interpolated into `h${n}`, with the levels each allows. */
  readonly headingLevelProps?: { readonly [prop: string]: readonly number[] };
  /** Refused unless the host allows it (`allowSensitive`). */
  readonly sensitive?: true;
  /** `children` is source text the component parses, joined verbatim. */
  readonly textChildren?: true;
  /** The renderer owns `open`; `dialogId` names it for `openDialog`/`closeDialog`. */
  readonly dialog?: true;
  /** `name` is a form field key, not a DOM name. */
  readonly fieldName?: true;
  /** Props whose value names a declared form; the renderer passes the form's handle. */
  readonly formProps?: readonly string[];
  /** Props whose string the renderer prefixes per view (persisted keys). */
  readonly namespacedProps?: readonly string[];
  /** Props validated as `Intl` input before render; an invalid value is dropped. */
  readonly intlProps?: { readonly [prop: string]: "currency" | "unit" };
  /** Props a document may not set on this component (dropped, `forbidden-prop`). */
  readonly droppedProps?: readonly PropPath[];
  /**
   * The component passes its element's native attributes through (`aria-*`,
   * `role`, `title`, `tabIndex`, …); `props` lists only its own.
   */
  readonly nativeAttributes?: true;
}

export type ComponentContracts = { readonly [name: string]: ComponentContract };
