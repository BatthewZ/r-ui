// @batthewz/r-ui-renderer/reference: the model reference (VIEWSPEC.md),
// rendered from the contracts and the hand-written prose. React-free.

import type { ComponentContracts } from "../spec/types";

export interface ReferenceOptions {
  /** The contracts to document; `defaultContracts` when absent. */
  readonly contracts?: ComponentContracts;
  /** Only these component names (and their parts). */
  readonly include?: readonly string[];
  /** Props listed per component before "+n more". */
  readonly propLimit?: number;
}

/** The whole reference as Markdown. */
export function renderViewSpecReference(options: ReferenceOptions = {}): string {
  throw new Error("not implemented");
}

/** `markdown` with every `<!-- GENERATED:name -->` region rendered afresh. */
export function renderReferenceRegions(markdown: string, options: ReferenceOptions = {}): string {
  throw new Error("not implemented");
}
