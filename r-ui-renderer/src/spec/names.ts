import { defaultContracts } from "./contracts";
import type { ComponentContracts } from "./types";

/**
 * Every addressable component name (parts included, `"Card.Header"`), sorted:
 * what a server passes the validator without loading React.
 */
export function listComponentNames(contracts: ComponentContracts = defaultContracts): string[] {
  return Object.keys(contracts).sort();
}
