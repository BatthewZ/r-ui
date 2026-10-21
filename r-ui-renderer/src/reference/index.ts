// @batthewz/r-ui-renderer/reference: the model reference (VIEWSPEC.md),
// rendered from the contracts and the hand-written prose. React-free.

import { type ReferenceOptions, renderDocument } from "./document";
import proseLines from "./prose.json";

export {
  type ReferenceOptions,
  type ReferenceRegions,
  type RegionOptions,
  renderReferenceRegions,
} from "./document";
export { scopeContracts } from "./scope";

/** VIEWSPEC.md's hand-written half, its regions empty (written by `gen:viewspec`). */
const PROSE = proseLines.join("\n");

/**
 * The whole reference as Markdown: this package's prose with every region
 * rendered. With no options it is the shipped VIEWSPEC.md byte for byte.
 * `include` narrows the component tables (the prose and the not-addressable
 * table stay whole, and the examples' components a scope drops are named);
 * `contracts` adds a host's components (`extendContracts(defaultContracts, …)`).
 */
export function renderViewSpecReference(options: ReferenceOptions = {}): string {
  return renderDocument(PROSE, options);
}
