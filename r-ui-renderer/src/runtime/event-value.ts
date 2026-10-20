import type { EventValueKind, JsonValue } from "../spec/types";

/**
 * `event.value` from a callback's arguments, as JSON: a DOM event unwrapped to
 * its target's value (`checked` for a checkbox or radio), a Set to an array, a
 * Date to `YYYY-MM-DD` at local midnight and to an ISO instant otherwise.
 */
export function readEventValue(args: readonly unknown[], kind: EventValueKind = "value"): JsonValue | undefined {
  throw new Error("not implemented");
}
