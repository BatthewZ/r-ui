import {
  COVERAGE_EXAMPLES,
  type ExampleName,
  exampleSpec,
  exampleText,
  isExampleName,
  PRODUCT_EXAMPLES,
} from "../src/examples";
import type { ViewSpec } from "../src/spec/types";

export const PRODUCT_NAMES = Object.keys(PRODUCT_EXAMPLES).filter(isExampleName);
export const COVERAGE_NAMES = Object.keys(COVERAGE_EXAMPLES).filter(isExampleName);

export type CorpusDocument =
  | { readonly ok: true; readonly name: ExampleName; readonly spec: ViewSpec; readonly text: string }
  | { readonly ok: false; readonly code: string; readonly message: string };

/** The corpus document `name`, as a spec and as the text a model would write. */
export function corpusDocument(name: string): CorpusDocument {
  if (!isExampleName(name)) {
    return { ok: false, code: "unknown-view", message: `No corpus document is named "${name}".` };
  }
  try {
    return { ok: true, name, spec: exampleSpec(name), text: exampleText(name) };
  } catch (error) {
    return { ok: false, code: "invalid-view", message: error instanceof Error ? error.message : String(error) };
  }
}
