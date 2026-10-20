import { readRef } from "../spec/ref-path";
import { isPending } from "../stream/pending";

/** A resolved value as text where text renders: strings and numbers; anything else is no text. */
export function valueText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

/** The value at a `$ref` path, never `PENDING` (a value still streaming reads as missing). */
export function readValue(path: string, scope: Readonly<Record<string, unknown>>): unknown {
  const value = readRef(path, scope);
  return isPending(value) ? undefined : value;
}
