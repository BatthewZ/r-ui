/**
 * Marks a value that has started arriving but cannot be used yet: an open
 * string outside a text child, a half-written number or literal. Registered
 * globally (`Symbol.for`) so two copies of this package agree on it.
 */
export const PENDING: unique symbol = Symbol.for("@batthewz/r-ui-renderer/pending");
export type Pending = typeof PENDING;

export function isPending(value: unknown): value is Pending {
  return value === PENDING;
}
