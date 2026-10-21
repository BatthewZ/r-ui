/**
 * The format's conformance rules, written once as a JSON Schema (draft
 * 2020-12). Three things read it: `validateViewSpec` interprets it for its
 * errors, `./zod` builds its schema from it, and `scripts/generate-schema.mjs`
 * publishes it as `schema.json`. None of them restates a rule, so they cannot
 * drift apart.
 *
 * Every closed set comes from a tuple in `types.ts`, and every object shape is
 * typed against its interface there (`shape<T>`): a key added to or dropped
 * from an interface fails to compile here until the schema follows.
 *
 * The `x-` keywords are the validator's annotations and are stripped from the
 * published schema: `x-issue` is the issue code any failure of that subschema
 * reports, `x-message` its message, `x-discriminator` the key whose value picks
 * a union's branch.
 */

import {
  ACTION_NAMES,
  type ActionName,
  type ApiBinding,
  type ApiCallPayload,
  BINDING_TYPES,
  COMPARISON_OPERATORS,
  type ComponentNode,
  type CondNode,
  DENSITIES,
  type DataTableColumnSpec,
  type DialogPayload,
  type EachNode,
  FIELD_TYPES,
  type FieldRules,
  FORBIDDEN_SEGMENTS,
  FORMAT_STYLES,
  FORMAT_VERSION,
  type FormatOptions,
  type FormDef,
  type FormFieldDef,
  type FormPayload,
  HTTP_METHODS,
  type IssueCode,
  type JsonPrimitive,
  type NavigatePayload,
  REF_ROOTS,
  RULE_NAMES,
  type SetStatePayload,
  type ShowToastPayload,
  type SourceBinding,
  type StaticBinding,
  TOAST_TONES,
  VALIDATION_TRIGGERS,
  type ViewSpec,
} from "./types";
import { LIMITS } from "./policy";

export type JsonType = "null" | "boolean" | "number" | "integer" | "string" | "array" | "object";

/** The JSON Schema subset the format is written in. The interpreters reject any other keyword. */
export interface SchemaDef {
  readonly $ref?: string;
  readonly title?: string;
  readonly description?: string;
  readonly type?: JsonType | readonly JsonType[];
  readonly const?: JsonPrimitive;
  readonly enum?: readonly JsonPrimitive[];
  readonly properties?: { readonly [key: string]: SchemaDef };
  readonly required?: readonly string[];
  readonly additionalProperties?: false | SchemaDef;
  readonly patternProperties?: { readonly [pattern: string]: SchemaDef };
  readonly propertyNames?: SchemaDef;
  readonly minProperties?: number;
  readonly items?: SchemaDef;
  readonly minItems?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly anyOf?: readonly SchemaDef[];
  readonly "x-issue"?: IssueCode;
  readonly "x-message"?: string;
  readonly "x-discriminator"?: string;
}

/** Every keyword a `SchemaDef` may carry; a test holds the interface to this list. */
export const SCHEMA_KEYWORDS = [
  "$ref",
  "title",
  "description",
  "type",
  "const",
  "enum",
  "properties",
  "required",
  "additionalProperties",
  "patternProperties",
  "propertyNames",
  "minProperties",
  "items",
  "minItems",
  "minLength",
  "maxLength",
  "pattern",
  "minimum",
  "maximum",
  "anyOf",
  "x-issue",
  "x-message",
  "x-discriminator",
] as const satisfies readonly (keyof SchemaDef)[];

export type SchemaDefs = { readonly [name: string]: SchemaDef };

const DEF_PREFIX = "#/$defs/";

/** The definition a `$ref` names in `defs`, with its name. Throws when it names none. */
export function lookupRef(defs: SchemaDefs, target: string): { readonly name: string; readonly def: SchemaDef } {
  const name = target.startsWith(DEF_PREFIX) ? target.slice(DEF_PREFIX.length) : undefined;
  const def = name === undefined || !Object.hasOwn(defs, name) ? undefined : defs[name];
  if (name === undefined || def === undefined) throw new Error(`Schema $ref ${target} names no definition.`);
  return { name, def };
}

/** A string's length as `minLength` and `maxLength` count it: in code points. */
export function codePoints(text: string): number {
  let count = 0;
  for (const _ of text) count += 1;
  return count;
}

// ---------------------------------------------------------------------------
// Closed sets the format's types spell inline (`types.ts` holds them as unions;
// validate-schema.test.ts holds each list equal to its union).

export const NOTATIONS = ["standard", "compact"] as const;
export const SIGN_DISPLAYS = ["auto", "always", "exceptZero", "negative", "never"] as const;
export const CURRENCY_DISPLAYS = ["symbol", "narrowSymbol", "code", "name"] as const;
export const UNIT_DISPLAYS = ["short", "long", "narrow"] as const;
export const DATE_TIME_STYLES = ["full", "long", "medium", "short"] as const;
export const TIME_ZONES = ["local", "UTC"] as const;
export const API_BINDING_METHODS = ["GET", "POST"] as const;
export const FIRST_DIRECTIONS = ["asc", "desc"] as const;
export const COLUMN_PRIORITIES = [1, 2, 3, 4, 5] as const;
export const COLUMN_FILTER_TYPES = ["text", "select"] as const;

/** What `forms.<form>.…` reads. */
export const FORM_STATE_KEYS = ["values", "errors", "submitting", "dirty", "submitCount", "submitFailed"] as const;

// ---------------------------------------------------------------------------
// Patterns

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const oneOf = (words: readonly string[]) => words.map(escapeRegExp).join("|");

const FORBIDDEN = oneOf(FORBIDDEN_SEGMENTS);
const NAME_BODY = "[A-Za-z_][A-Za-z0-9_]*";
/** A segment that is not a forbidden one, then the segment. */
const SEGMENT = `(?!(?:${FORBIDDEN})(?:\\.|$))[^.]+`;

export const PATTERNS = {
  name: `^(?!(?:${FORBIDDEN})$)${NAME_BODY}$`,
  alias: `^(?!(?:${oneOf([...FORBIDDEN_SEGMENTS, ...REF_ROOTS])})$)${NAME_BODY}$`,
  refPath: `^(?!(?:${FORBIDDEN})(?:\\.|$))${NAME_BODY}(?:\\.${SEGMENT})*$`,
  statePath: `^state(?:\\.${SEGMENT})+$`,
  keyPath: `^${SEGMENT}(?:\\.${SEGMENT})*$`,
  handlerKey: "^on[A-Z]",
} as const;

// ---------------------------------------------------------------------------
// Builders

type RequiredKeys<T> = Extract<{ [K in keyof T]-?: object extends Pick<T, K> ? never : K }[keyof T], string>;
type AllKeys<T> = { readonly [K in keyof T]-?: SchemaDef };

/**
 * A closed object whose keys are exactly `T`'s, with `T`'s required keys
 * required. Omitting a key of `T`, adding one, or listing an optional key as
 * required does not compile; `required` must list every required key.
 */
function shape<T>() {
  return <const R extends readonly RequiredKeys<T>[]>(
    properties: AllKeys<T>,
    required: R & ([Exclude<RequiredKeys<T>, R[number]>] extends [never] ? unknown : never),
    extra: SchemaDef = {},
  ): SchemaDef => ({
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
    ...extra,
  });
}

const ref = (name: string): SchemaDef => ({ $ref: `${DEF_PREFIX}${name}` });
const string: SchemaDef = { type: "string" };
const boolean: SchemaDef = { type: "boolean" };
const number: SchemaDef = { type: "number" };
const values = (list: readonly JsonPrimitive[]): SchemaDef => ({ enum: list });
const record = (value: SchemaDef, keys?: SchemaDef): SchemaDef => ({
  type: "object",
  ...(keys ? { propertyNames: keys } : {}),
  additionalProperties: value,
});
const integer = (minimum: number, maximum?: number): SchemaDef => ({
  type: "integer",
  minimum,
  ...(maximum === undefined ? {} : { maximum }),
});

const PRIMITIVE: SchemaDef = { type: ["null", "boolean", "number", "string"] };

/** An object that is not a marker: its only key is none of `keys`. */
function notSoleKey(keys: readonly string[]): SchemaDef {
  return {
    anyOf: [
      { type: "object", propertyNames: { type: "string", pattern: `^(?!(?:${oneOf(keys)})$)` } },
      { type: "object", minProperties: 2 },
    ],
    description: `An object whose only key is ${keys.join(" or ")} is that marker.`,
  };
}

const MARKER_KEYS = ["$ref", "$node", "$format", "$concat"] as const;
const HANDLERS = { [PATTERNS.handlerKey]: ref("OnValue") };

/** A prop value's object: any keys, `on[A-Z]…` keys hold handlers, other values are prop values. */
function propObject(extra: SchemaDef = {}): SchemaDef {
  return {
    type: "object",
    patternProperties: HANDLERS,
    additionalProperties: ref("PropValue"),
    ...notSoleKey(MARKER_KEYS),
    ...extra,
  };
}

/** JSON whose top-level object is not a `$ref` marker, beside a `$ref` marker. */
function jsonOrRef(...json: SchemaDef[]): SchemaDef {
  return { anyOf: [ref("RefMarker"), ...json] };
}

const FORMAT_OPTION_PROPERTIES: Omit<AllKeys<FormatOptions>, "style"> = {
  currency: string,
  unit: string,
  notation: values(NOTATIONS),
  minimumFractionDigits: integer(0, 100),
  maximumFractionDigits: integer(0, 100),
  maximumSignificantDigits: integer(1, 21),
  signDisplay: values(SIGN_DISPLAYS),
  currencyDisplay: values(CURRENCY_DISPLAYS),
  unitDisplay: values(UNIT_DISPLAYS),
  useGrouping: boolean,
  dateStyle: values(DATE_TIME_STYLES),
  timeStyle: values(DATE_TIME_STYLES),
  timeZone: values(TIME_ZONES),
  missing: string,
};

/** The style needs an option: `currency` needs `currency`, `unit` needs `unit`. */
const STYLE_NEEDS = { currency: "currency", unit: "unit" } as const;

/** FormatOptions, one branch per style that needs an option and one for the rest. */
function formatOptions(withValue: boolean): SchemaDef {
  const value: { readonly [key: string]: SchemaDef } = withValue ? { value: ref("PropValue") } : {};
  const branch = (style: SchemaDef, required: readonly string[]): SchemaDef => ({
    type: "object",
    properties: { ...value, style, ...FORMAT_OPTION_PROPERTIES },
    required: [...(withValue ? ["value"] : []), "style", ...required],
    additionalProperties: false,
  });
  const plain = FORMAT_STYLES.filter((style) => !Object.hasOwn(STYLE_NEEDS, style));
  return {
    anyOf: [
      ...Object.entries(STYLE_NEEDS).map(([style, option]) => branch({ const: style }, [option])),
      branch(values(plain), []),
    ],
    "x-discriminator": "style",
    description: "A style with its options; `currency` needs `currency`, `unit` needs `unit`.",
  };
}

// ---------------------------------------------------------------------------
// Actions

const PAYLOADS: { readonly [A in ActionName]: SchemaDef } = {
  setState: shape<SetStatePayload>()({ path: ref("StatePath"), value: ref("PropValue"), replace: boolean }, ["path", "value"]),
  submitForm: shape<FormPayload>()({ form: ref("Name") }, ["form"]),
  resetForm: shape<FormPayload>()({ form: ref("Name") }, ["form"]),
  navigate: shape<NavigatePayload>()({ to: { anyOf: [string, ref("RefMarker"), ref("ConcatMarker")] }, replace: boolean }, ["to"]),
  showToast: shape<ShowToastPayload>()(
    { title: ref("ToastText"), description: ref("ToastText"), tone: values(TOAST_TONES) },
    ["title"],
  ),
  apiCall: shape<ApiCallPayload>()(
    {
      endpoint: string,
      method: values(HTTP_METHODS),
      query: ref("QueryParams"),
      body: ref("PropValue"),
      into: ref("StatePath"),
      onSuccess: ref("Handler"),
      onError: ref("Handler"),
    },
    ["endpoint"],
  ),
  openDialog: shape<DialogPayload>()({ dialogId: ref("Name") }, ["dialogId"]),
  closeDialog: shape<DialogPayload>()({ dialogId: ref("Name") }, ["dialogId"]),
};

const ACTION: SchemaDef = {
  title: "Action",
  anyOf: ACTION_NAMES.map((action) => ({
    type: "object",
    properties: { action: { const: action }, payload: PAYLOADS[action] },
    required: ["action", "payload"],
    additionalProperties: false,
  })),
  "x-discriminator": "action",
  description: `{ "action": ${ACTION_NAMES.join(" | ")}, "payload": {…} }`,
};

// ---------------------------------------------------------------------------
// Nodes and conditions

const COMPONENT_NODE = shape<ComponentNode>()(
  {
    component: { type: "string", minLength: 1 },
    props: ref("Props"),
    children: { type: "array", items: ref("ViewNode") },
  },
  ["component"],
  { title: "Component node" },
);

const EACH_NODE = shape<EachNode>()(
  { $each: ref("RefPath"), as: ref("Alias"), key: ref("KeyPath"), node: ref("ViewNode") },
  ["$each", "as", "node"],
  { title: "$each node" },
);

const COND_NODE = shape<CondNode>()(
  { $cond: ref("Condition"), then: ref("ViewNode"), else: ref("ViewNode") },
  ["$cond", "then"],
  { title: "$cond node" },
);

const OPERANDS: { readonly [op in (typeof COMPARISON_OPERATORS)[number]]: SchemaDef } = {
  eq: ref("Operand"),
  ne: ref("Operand"),
  gt: { anyOf: [number, string, ref("RefMarker")] },
  lt: { anyOf: [number, string, ref("RefMarker")] },
  in: { anyOf: [{ type: "array", items: ref("Json") }, ref("RefMarker")] },
};

const CONDITION: SchemaDef = {
  anyOf: [
    { ...ref("RefPath"), title: "truthy path" },
    {
      title: "not",
      type: "object",
      properties: { not: ref("Condition") },
      required: ["not"],
      additionalProperties: false,
    },
    ...COMPARISON_OPERATORS.map(
      (op): SchemaDef => ({
        title: `ref ${op}`,
        type: "object",
        properties: { ref: ref("RefPath"), [op]: OPERANDS[op] },
        required: ["ref", op],
        additionalProperties: false,
      }),
    ),
  ],
  description: `A reference path (truthy), { "not": Condition }, or { "ref": path } with exactly one of ${COMPARISON_OPERATORS.join(", ")}.`,
};

// ---------------------------------------------------------------------------
// Data and forms

/**
 * A query value: a scalar, or a list of them sent as repeated parameters. An
 * object conforms but has no query-string form (`unusable-value`, left out).
 */
const QUERY_VALUE: SchemaDef = jsonOrRef(
  PRIMITIVE,
  ref("ConcatMarker"),
  { type: "array", items: jsonOrRef(PRIMITIVE, ref("ConcatMarker")) },
  { ...record(ref("Json")), ...notSoleKey(["$ref", "$concat"]) },
);

const DATA_BINDING: SchemaDef = {
  anyOf: [
    shape<StaticBinding>()({ type: { const: "static" }, value: ref("Json") }, ["type", "value"]),
    shape<ApiBinding>()(
      {
        type: { const: "api" },
        endpoint: string,
        method: values(API_BINDING_METHODS),
        query: ref("QueryParams"),
        body: ref("PropValue"),
      },
      ["type", "endpoint"],
    ),
    shape<SourceBinding>()(
      { type: { const: "source" }, source: string, params: record(ref("PropValue")) },
      ["type", "source"],
    ),
  ],
  "x-discriminator": "type",
  description: `A data binding: { "type": ${BINDING_TYPES.join(" | ")}, … }.`,
};

const FIELD_RULES = shape<FieldRules>()(
  {
    required: boolean,
    minLength: integer(0),
    maxLength: integer(0),
    pattern: string,
    min: { anyOf: [number, string] },
    max: { anyOf: [number, string] },
  },
  [],
);

const FORM_FIELD = shape<FormFieldDef>()(
  {
    type: values(FIELD_TYPES),
    initialValue: ref("Operand"),
    rules: FIELD_RULES,
    message: string,
    messages: {
      type: "object",
      properties: Object.fromEntries(RULE_NAMES.map((rule) => [rule, string])),
      additionalProperties: false,
    },
  },
  [],
);

const FORM_DEF = shape<FormDef>()(
  {
    fields: record(FORM_FIELD, ref("Name")),
    validateOn: values(VALIDATION_TRIGGERS),
    revalidateOn: values(VALIDATION_TRIGGERS),
    onSubmit: ref("Handler"),
    onInvalid: ref("Handler"),
  },
  ["fields"],
);

// ---------------------------------------------------------------------------
// The document

const DEFS: SchemaDefs = {
  Name: {
    type: "string",
    pattern: PATTERNS.name,
    "x-issue": "invalid-name",
    "x-message": `A name matches ${NAME_BODY} and is not ${FORBIDDEN_SEGMENTS.join(", ")}.`,
  },
  Alias: {
    type: "string",
    pattern: PATTERNS.alias,
    "x-issue": "invalid-name",
    "x-message": `An alias is a name (${NAME_BODY}) other than ${[...REF_ROOTS, ...FORBIDDEN_SEGMENTS].join(", ")}.`,
  },
  RefPath: {
    type: "string",
    pattern: PATTERNS.refPath,
    "x-issue": "invalid-ref",
    "x-message": "A reference path is root.segment.segment…: a name, then non-empty segments, none of them __proto__, constructor or prototype.",
  },
  StatePath: {
    type: "string",
    pattern: PATTERNS.statePath,
    "x-issue": "invalid-ref",
    "x-message": "Written literally: `state.` then a path (\"state.filters.region\").",
  },
  KeyPath: {
    type: "string",
    pattern: PATTERNS.keyPath,
    "x-issue": "invalid-ref",
    "x-message": "A path inside the element (\"id\", \"meta.slug\"): non-empty segments, none of them reserved.",
  },
  Json: {
    anyOf: [PRIMITIVE, { type: "array", items: ref("Json") }, record(ref("Json"))],
    description: "Any JSON value.",
  },
  /** JSON, or a `$ref` marker: what an operand or an initial value may be. */
  Operand: jsonOrRef(PRIMITIVE, { type: "array", items: ref("Json") }, { ...record(ref("Json")), ...notSoleKey(["$ref"]) }),
  RefMarker: {
    title: "$ref marker",
    type: "object",
    properties: { $ref: ref("RefPath") },
    required: ["$ref"],
    additionalProperties: false,
  },
  NodeMarker: {
    title: "$node marker",
    type: "object",
    properties: { $node: ref("ViewNode") },
    required: ["$node"],
    additionalProperties: false,
  },
  FormatMarker: {
    title: "$format marker",
    type: "object",
    properties: { $format: formatOptions(true) },
    required: ["$format"],
    additionalProperties: false,
  },
  ConcatMarker: {
    title: "$concat marker",
    type: "object",
    properties: {
      $concat: {
        type: "array",
        minItems: 1,
        items: { anyOf: [{ type: ["string", "number", "boolean"] }, ref("RefMarker"), ref("FormatMarker")] },
        description: "Parts joined into one string: text, numbers and booleans, `$ref` and `$format` markers.",
      },
    },
    required: ["$concat"],
    additionalProperties: false,
  },
  PropValue: {
    anyOf: [
      PRIMITIVE,
      { type: "array", items: ref("PropValue") },
      ref("RefMarker"),
      ref("NodeMarker"),
      ref("FormatMarker"),
      ref("ConcatMarker"),
      propObject(),
    ],
    description: "JSON, where an object whose only key is $ref, $node, $format or $concat is that marker.",
  },
  Props: { type: "object", patternProperties: HANDLERS, additionalProperties: ref("PropValue") },
  Action: ACTION,
  Handler: {
    anyOf: [ref("Action"), { type: "array", items: ref("Action"), minItems: 1 }],
    description: "An action, or a non-empty list of actions.",
  },
  /**
   * Under an `on[A-Z]…` key: a handler, or anything that does not look like
   * one (it is dropped). An object with an `action` key, alone or in a list,
   * is held to the handler's shape.
   */
  OnValue: {
    anyOf: [ref("Handler"), ref("NotAction")],
    description: "A handler: an action or a non-empty list of actions.",
  },
  NotAction: {
    anyOf: [
      PRIMITIVE,
      { type: "array", items: ref("NotAction") },
      ref("RefMarker"),
      ref("NodeMarker"),
      ref("FormatMarker"),
      ref("ConcatMarker"),
      propObject({ propertyNames: { type: "string", pattern: "^(?!action$)" } }),
    ],
  },
  ToastText: { anyOf: [string, ref("RefMarker"), ref("FormatMarker"), ref("ConcatMarker")] },
  QueryParams: record(QUERY_VALUE),
  ViewNode: {
    anyOf: [{ type: "string", title: "text" }, COMPONENT_NODE, ref("RefMarker"), ref("FormatMarker"), EACH_NODE, COND_NODE],
    "x-issue": "invalid-node",
    description: "A node: text, or an object with exactly one of component, $ref, $format, $each, $cond.",
  },
  Condition: CONDITION,
  DataBinding: DATA_BINDING,
  FormDef: FORM_DEF,
};

export const VIEWSPEC_SCHEMA: SchemaDef & { readonly $defs: typeof DEFS } = {
  title: "ViewSpec",
  description: `A ViewSpec document, format version ${FORMAT_VERSION}: a view built from @batthewz/r-ui-react-components. Write keys in the order listed; root last.`,
  ...shape<ViewSpec>()(
    {
      $schema: string,
      version: { const: FORMAT_VERSION, "x-issue": "unsupported-version", "x-message": `\`version\` is ${FORMAT_VERSION}.` },
      title: { type: "string", minLength: 1, maxLength: LIMITS.title },
      description: string,
      density: values(DENSITIES),
      state: record(ref("Json"), ref("Name")),
      data: record(ref("DataBinding"), ref("Name")),
      forms: record(ref("FormDef"), ref("Name")),
      root: ref("ViewNode"),
    },
    ["version", "title", "root"],
  ),
  $defs: DEFS,
};

/**
 * Shapes the format leaves to a component's contract, which the validator
 * checks against the same interpreter and reports as warnings. Not published:
 * the schema cannot know which prop is a formatter or a column list.
 */
type ColumnFilter<T extends string> = Extract<NonNullable<DataTableColumnSpec["filter"]>, { readonly type: T }>;

export const ADVISORY_DEFS: SchemaDefs = {
  ...DEFS,
  FormatSpec: { anyOf: [values(FORMAT_STYLES), formatOptions(false)] },
  Column: shape<DataTableColumnSpec>()(
    {
      id: { type: "string", minLength: 1 },
      header: { anyOf: [string, ref("AnyNodeMarker")] },
      field: ref("KeyPath"),
      format: ref("FormatSpec"),
      cell: ref("AnyNodeMarker"),
      label: string,
      numeric: boolean,
      sortable: boolean,
      firstDirection: values(FIRST_DIRECTIONS),
      priority: values(COLUMN_PRIORITIES),
      truncate: boolean,
      required: boolean,
      resizable: boolean,
      width: ref("CssLength"),
      minWidth: ref("CssLength"),
      maxWidth: ref("CssLength"),
      filter: {
        anyOf: [
          shape<ColumnFilter<"text">>()(
            { type: { const: "text" }, placeholder: string },
            ["type"],
          ),
          shape<ColumnFilter<"select">>()(
            {
              type: { const: "select" },
              options: {
                type: "array",
                items: {
                  type: "object",
                  properties: { value: string, label: string },
                  required: ["value", "label"],
                  additionalProperties: false,
                },
              },
            },
            ["type", "options"],
          ),
        ],
        "x-discriminator": "type",
        description: `{ "type": ${COLUMN_FILTER_TYPES.join(" | ")}, … }`,
      },
    },
    ["id"],
  ),
  CssLength: {
    type: "string",
    pattern: "^(?:0|-?(?:\\d+|\\d*\\.\\d+)(?:px|rem|em|ch|ex|lh|%|vw|vh|vi|vb|vmin|vmax|cqw|cqh|cqi|cqb|fr)|(?:calc|min|max|clamp)\\([^;{}]*\\)|auto|min-content|max-content|fit-content)$",
    "x-message": "A CSS length (`12rem`, `40%`) or a calc()/min()/max()/clamp() of them.",
  },
  /** The node inside is the structural check's; this asks only for the marker. */
  AnyNodeMarker: {
    title: "$node marker",
    type: "object",
    properties: { $node: {} },
    required: ["$node"],
    additionalProperties: false,
  },
  SelectOptions: {
    type: "array",
    items: {
      type: "object",
      properties: { value: string, label: string, disabled: boolean },
      required: ["value", "label"],
      additionalProperties: false,
    },
  },
};

/** The schema as published: the same rules without the validator's annotations. */
export function publishedSchema(): unknown {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (typeof value !== "object" || value === null) return value;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) if (!key.startsWith("x-")) out[key] = strip(item);
    return out;
  };
  return { $schema: "https://json-schema.org/draft/2020-12/schema", ...(strip(VIEWSPEC_SCHEMA) as object) };
}
