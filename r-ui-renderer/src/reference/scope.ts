import { exclusionFor } from "../contracts";
import type { ComponentContract, ComponentContracts } from "../spec/types";
import { closest } from "../spec/validate-suggest";

/**
 * The contracts for `include` and nothing else. A part travels with its root
 * both ways: naming a part brings its root, and a root brings every part, so
 * no Parts column advertises less than renders. A name no contract holds
 * throws (a silently skipped name is a renamed component vanishing from the
 * reference an author writes against).
 */
export function scopeContracts(contracts: ComponentContracts, include: readonly string[]): ComponentContracts {
  if (include.length === 0) {
    throw new Error("the reference scope `include` is empty: it would document nothing.");
  }
  const known = Object.keys(contracts);
  const unknown = include.filter((name) => !Object.hasOwn(contracts, name));
  if (unknown.length > 0) {
    const detail = unknown.map((name) => {
      const exclusion = exclusionFor(name);
      if (exclusion) return `"${name}" (not addressable: ${exclusion.why})`;
      const nearest = closest(name, known);
      return nearest === undefined ? `"${name}"` : `"${name}" (did you mean "${nearest}"?)`;
    });
    throw new Error(`the reference scope names components no contract holds: ${detail.join(", ")}`);
  }
  const roots = new Set(include.map((name) => name.split(".")[0] as string));
  const scoped = Object.create(null) as Record<string, ComponentContract>;
  for (const name of known) {
    if (roots.has(name.split(".")[0] as string)) scoped[name] = contracts[name] as ComponentContract;
  }
  return scoped;
}
