import { type StandardSchemaIssue, type StandardSchemaV1, toISODate } from "@batthewz/r-ui-react-components";

import { toJsonValue } from "../runtime/event-value";
import { parseIsoDate } from "../spec/dates";
import { isForbiddenSegment, isName, isPlainObject, isRefMarker } from "../spec/guards";
import { appendPointer } from "../spec/pointer";
import { LIMITS } from "../spec/policy";
import {
  FIELD_TYPES,
  type FieldRules,
  type FieldType,
  type FormDef,
  type JsonValue,
  type RuleName,
} from "../spec/types";

/** A form's values as its controls hold them (Dates for date fields). */
export type FormValues = { readonly [field: string]: unknown };

/** A form's values as JSON: what `onSubmit` receives as `event.value`. */
export type FormOutput = { readonly [field: string]: JsonValue };

interface CompiledField {
  readonly key: string;
  readonly type: FieldType;
  readonly rules: FieldRules;
  /** Null when the def's `pattern` is not a valid regular expression: the rule then always fails. */
  readonly pattern: RegExp | null | undefined;
  readonly message: string | undefined;
  readonly messages: { readonly [R in RuleName]?: string };
}

function isFieldType(value: unknown): value is FieldType {
  return FIELD_TYPES.some((type) => type === value);
}

function compilePattern(source: unknown): RegExp | null | undefined {
  if (typeof source !== "string") return undefined;
  try {
    return new RegExp(source);
  } catch {
    return null;
  }
}

function textEntries(value: unknown): { readonly [rule: string]: string } {
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

/** The def's fields with valid names, in the def's order. */
function compileFields(def: FormDef): CompiledField[] {
  const fields = isPlainObject(def.fields) ? def.fields : {};
  const out: CompiledField[] = [];
  for (const key of Object.keys(fields)) {
    const field: unknown = fields[key];
    if (!isName(key) || !isPlainObject(field)) continue;
    const rules: FieldRules = isPlainObject(field.rules) ? field.rules : {};
    out.push({
      key,
      type: isFieldType(field.type) ? field.type : "text",
      rules,
      pattern: compilePattern(rules.pattern),
      message: typeof field.message === "string" ? field.message : undefined,
      messages: textEntries(field.messages),
    });
  }
  return out;
}

function isEmpty(value: unknown, type: FieldType): boolean {
  if (value === null || value === undefined || value === "" || value === false) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (type === "dateRange" && isPlainObject(value)) return !(value.start instanceof Date) || !(value.end instanceof Date);
  return false;
}

/** A date bound as `YYYY-MM-DD`, or undefined when it names no date. */
function dateBound(bound: unknown): string | undefined {
  const date = typeof bound === "string" ? parseIsoDate(bound) : null;
  return date === null ? undefined : toISODate(date);
}

function datesOf(value: unknown, type: FieldType): string[] {
  const days = (type === "dateRange" && isPlainObject(value) ? [value.start, value.end] : [value]).filter(
    (day): day is Date => day instanceof Date && !Number.isNaN(day.getTime()),
  );
  return days.map(toISODate);
}

function numberOf(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
  return undefined;
}

function sizeOf(value: unknown): number | undefined {
  if (typeof value === "string") return [...value].length;
  if (Array.isArray(value)) return value.length;
  return undefined;
}

/** The field's first failing rule's message, in the documented order. */
function check(field: CompiledField, value: unknown): string | undefined {
  const { rules, type } = field;
  const say = (rule: RuleName, fallback: string) => field.messages[rule] ?? field.message ?? fallback;

  if (isEmpty(value, type)) return rules.required === true ? say("required", "This field is required.") : undefined;

  const size = sizeOf(value);
  const unit = Array.isArray(value) ? "items" : "characters";
  if (size !== undefined && typeof rules.minLength === "number" && size < rules.minLength) {
    return say("minLength", `Use at least ${rules.minLength} ${unit}.`);
  }
  if (size !== undefined && typeof rules.maxLength === "number" && size > rules.maxLength) {
    return say("maxLength", `Use at most ${rules.maxLength} ${unit}.`);
  }

  if (field.pattern !== undefined && typeof value === "string") {
    // The pattern is the document's and the input the user's: a capped input bounds catastrophic backtracking.
    if (field.pattern === null || value.length > LIMITS.patternInput || !field.pattern.test(value)) {
      return say("pattern", "This does not match the expected format.");
    }
  }

  if (type === "date" || type === "dateRange") {
    const days = datesOf(value, type);
    const min = dateBound(rules.min);
    const max = dateBound(rules.max);
    if (min !== undefined && days.some((day) => day < min)) return say("min", `Choose ${min} or later.`);
    if (max !== undefined && days.some((day) => day > max)) return say("max", `Choose ${max} or earlier.`);
    return undefined;
  }

  const number = numberOf(value);
  if (number !== undefined && typeof rules.min === "number" && number < rules.min) return say("min", `Must be at least ${rules.min}.`);
  if (number !== undefined && typeof rules.max === "number" && number > rules.max) return say("max", `Must be at most ${rules.max}.`);
  return undefined;
}

/** Values as JSON, every Date as ISO text (a date field's always as a calendar day). */
function toOutput(values: FormValues, types: ReadonlyMap<string, FieldType>): FormOutput {
  const out: { [field: string]: JsonValue } = {};
  for (const key of Object.keys(values)) {
    if (isForbiddenSegment(key)) continue;
    const type = types.get(key);
    const json = toJsonValue(values[key], type === "date" || type === "dateRange" ? "date" : "auto");
    if (json !== undefined) out[key] = json;
  }
  return out;
}

/** `values` as JSON per the def's field types: what `forms.<name>.values` reads. */
export function formOutput(def: FormDef, values: FormValues): FormOutput {
  return toOutput(values, new Map(compileFields(def).map((field) => [field.key, field.type])));
}

/**
 * The def's rules as a synchronous Standard Schema for the library's
 * `useForm`. Rule order: required, then length and pattern, then min/max.
 * Its output turns every Date back into ISO.
 */
export function compileFormSchema(def: FormDef): StandardSchemaV1<FormValues, FormOutput> {
  const fields = compileFields(def);
  const types = new Map(fields.map((field) => [field.key, field.type]));
  return {
    "~standard": {
      version: 1,
      vendor: "r-ui-renderer",
      validate(input) {
        const values: FormValues = isPlainObject(input) ? input : {};
        const issues: StandardSchemaIssue[] = [];
        for (const field of fields) {
          const message = check(field, Object.hasOwn(values, field.key) ? values[field.key] : undefined);
          if (message !== undefined) issues.push({ message, path: [field.key] });
        }
        return issues.length > 0 ? { issues } : { value: toOutput(values, types) };
      },
    },
  };
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  return typeof value === "string" ? parseIsoDate(value) : null;
}

/** A JSON value as the field type's control holds it; the type's empty value when it does not fit. */
function coerceIn(type: FieldType, value: unknown): unknown {
  switch (type) {
    case "text":
      return typeof value === "string" ? value : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
    case "number":
      return numberOf(value) ?? null;
    case "boolean":
      return value === true;
    case "date":
      return toDate(value);
    case "dateRange":
      return isPlainObject(value) ? { start: toDate(value.start), end: toDate(value.end) } : null;
    case "list":
      return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  }
}

/**
 * The form's initial values: each field's `initialValue` (its `$ref` read
 * through `resolve`) or its type's empty value, ISO dates turned into Dates.
 */
export function formDefaults(def: FormDef, resolve: (path: string) => unknown): FormValues {
  const out: { [field: string]: unknown } = {};
  const fields = isPlainObject(def.fields) ? def.fields : {};
  for (const field of compileFields(def)) {
    const raw = (fields[field.key] as { initialValue?: unknown }).initialValue;
    out[field.key] = coerceIn(field.type, isRefMarker(raw) ? resolve(raw.$ref) : raw);
  }
  return out;
}

/** The `$ref` paths the def's initial values read. */
export function formDefRefs(def: FormDef): string[] {
  const fields = isPlainObject(def.fields) ? def.fields : {};
  return compileFields(def).flatMap((field) => {
    const raw = (fields[field.key] as { initialValue?: unknown }).initialValue;
    return isRefMarker(raw) ? [raw.$ref] : [];
  });
}

/** Rules that can never pass as written, by JSON Pointer under the def. */
export function formDefProblems(def: FormDef): { readonly path: string; readonly message: string }[] {
  return compileFields(def)
    .filter((field) => field.pattern === null)
    .map((field) => ({
      path: ["fields", field.key, "rules", "pattern"].reduce<string>(appendPointer, ""),
      message: `The pattern for "${field.key}" is not a valid regular expression; the field can never pass.`,
    }));
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** cyrb53: a fast 53-bit string hash; collisions between two defs of one view are not a practical concern. */
function hash53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const hashes = new WeakMap<FormDef, string>();

/** A structural hash of the def: equal defs share a form store across re-emitted documents. */
export function formDefHash(def: FormDef): string {
  let hash = hashes.get(def);
  if (hash === undefined) {
    hash = hash53(canonicalJson(def));
    hashes.set(def, hash);
  }
  return hash;
}
