/**
 * The contracts every check reads: the built-ins plus the library's
 * (generated from its declarations and curated), merged per field.
 */

import { BUILTIN_CONTRACTS } from "./builtins";
import type { ComponentContract, ComponentContracts } from "./types";

export const defaultContracts: ComponentContracts = BUILTIN_CONTRACTS;

/** The contract for `name`, own properties only (`"toString"` names nothing). */
export function contractFor(contracts: ComponentContracts, name: string): ComponentContract | undefined {
  return Object.hasOwn(contracts, name) ? contracts[name] : undefined;
}

/**
 * `base` with `extra` laid over it, field by field: a field `extra` sets
 * replaces that field, the rest of `base`'s record stays. A new name without a
 * `category` is filed under `"custom"`. Never mutates either.
 */
export function extendContracts(
  base: ComponentContracts,
  extra: { readonly [name: string]: Partial<ComponentContract> },
): ComponentContracts {
  const next: Record<string, ComponentContract> = Object.create(null) as Record<string, ComponentContract>;
  for (const name of Object.keys(base)) next[name] = base[name] as ComponentContract;
  for (const name of Object.keys(extra)) {
    const over = extra[name] as Partial<ComponentContract>;
    const under = contractFor(base, name);
    next[name] = { category: "custom", ...under, ...over };
  }
  return next;
}
