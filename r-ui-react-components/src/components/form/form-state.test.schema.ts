// A tiny Standard Schema implementation for tests: no validator dependency.
// `defineSchema(check, parse)` validates with `check` (issues, sync or async)
// and, when there are none, outputs `parse(value)`.

import type { StandardSchemaIssue, StandardSchemaResult, StandardSchemaV1 } from "./form-state-schema";

export type TestIssue = StandardSchemaIssue;

/** An issue at a path given as keys (`"conditions", 0, "metric"`), or `{ key }` segments. */
export const issue = (message: string, ...path: Array<PropertyKey | { key: PropertyKey }>): TestIssue => ({
  message,
  path: path.length ? path : undefined,
});

export function defineSchema<In, Out = In>(
  check: (value: In) => TestIssue[] | Promise<TestIssue[]>,
  parse: (value: In) => Out = (value) => value as unknown as Out,
): StandardSchemaV1<In, Out> & { calls: number } {
  const schema = {
    calls: 0,
    "~standard": {
      version: 1 as const,
      vendor: "test",
      validate: (value: unknown): StandardSchemaResult<Out> | Promise<StandardSchemaResult<Out>> => {
        schema.calls += 1;
        const result = check(value as In);
        const settle = (issues: TestIssue[]): StandardSchemaResult<Out> =>
          issues.length ? { issues } : { value: parse(value as In) };
        return result instanceof Promise ? result.then(settle) : settle(result);
      },
    },
  };
  return schema;
}

/** A promise you resolve from outside, to order async races deterministically. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
