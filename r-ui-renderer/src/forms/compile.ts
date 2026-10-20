import type { StandardSchemaV1 } from "@batthewz/r-ui-react-components";

import type { FormDef, JsonValue } from "../spec/types";

/** A form's values as its controls hold them (Dates for date fields). */
export type FormValues = { readonly [field: string]: unknown };

/** A form's values as JSON: what `onSubmit` receives as `event.value`. */
export type FormOutput = { readonly [field: string]: JsonValue };

/**
 * The def's rules as a synchronous Standard Schema for the library's
 * `useForm`. Rule order: required, then length and pattern, then min/max.
 * Its output turns every Date back into ISO.
 */
export function compileFormSchema(def: FormDef): StandardSchemaV1<FormValues, FormOutput> {
  throw new Error("not implemented");
}

/**
 * The form's initial values: each field's `initialValue` (its `$ref` read
 * through `resolve`) or its type's empty value, ISO dates turned into Dates.
 */
export function formDefaults(def: FormDef, resolve: (path: string) => unknown): FormValues {
  throw new Error("not implemented");
}

/** A structural hash of the def: equal defs share a form store across re-emitted documents. */
export function formDefHash(def: FormDef): string {
  throw new Error("not implemented");
}
