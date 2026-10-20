import { readRef } from "../spec/ref-path";
import { isPending } from "../stream/pending";

/** The value at a `$ref` path, never `PENDING` (a value still streaming reads as missing). */
export function readValue(path: string, scope: Readonly<Record<string, unknown>>): unknown {
  const value = readRef(path, scope);
  return isPending(value) ? undefined : value;
}
