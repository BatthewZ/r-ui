// The Standard Schema v1 interface (https://standardschema.dev), as types only.
// Zod, Valibot, ArkType and others implement it, so `useForm` validates with any
// of them and depends on none.

/** A validator that implements Standard Schema v1. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaProps<Input, Output>;
}

export interface StandardSchemaProps<Input = unknown, Output = Input> {
  readonly version: 1;
  readonly vendor: string;
  readonly validate: (
    value: unknown,
  ) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
  readonly types?: { readonly input: Input; readonly output: Output } | undefined;
}

export type StandardSchemaResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<StandardSchemaIssue> };

export interface StandardSchemaIssue {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined;
}

/** The values a schema accepts (what the form holds). */
export type StandardSchemaInput<S extends StandardSchemaV1> = NonNullable<S["~standard"]["types"]>["input"];

/** What a schema parses them into (what `onSubmit` receives). */
export type StandardSchemaOutput<S extends StandardSchemaV1> = NonNullable<S["~standard"]["types"]>["output"];
