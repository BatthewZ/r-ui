/**
 * Control documents: what the browser checks drive besides the corpus. They
 * are not corpus, since a model must not learn from them, so the package does
 * not ship them. Each one makes a check's claim observable (a host-refused
 * image, a card that reaches for the whole page) and declares the diagnostics
 * it renders, so a check that finds none of them knows its probe is blind.
 * Each name is its file's stem and is the playground's `?view=` name.
 */

import type { IssueCode } from "../../spec/types";
import containedOverlays from "./contained-overlays.json";
import refusedImage from "./refused-image.json";

export interface ControlExample {
  readonly document: unknown;
  /** The `data-code` of every diagnostic it renders, in document order. */
  readonly diagnostics: readonly IssueCode[];
}

export type ControlName = "contained-overlays" | "refused-image";

export const CONTROL_EXAMPLES: { readonly [name in ControlName]: ControlExample } = {
  "contained-overlays": { document: containedOverlays, diagnostics: [] },
  "refused-image": { document: refusedImage, diagnostics: ["refused-url"] },
};

export function isControlName(name: string): name is ControlName {
  return Object.hasOwn(CONTROL_EXAMPLES, name);
}
