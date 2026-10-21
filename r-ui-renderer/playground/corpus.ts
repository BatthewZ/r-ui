import {
  COVERAGE_EXAMPLES,
  type ExampleName,
  exampleSpec,
  exampleText,
  isExampleName,
  PRODUCT_EXAMPLES,
} from "../src/examples";
import { CONTROL_EXAMPLES, type ControlName, isControlName } from "../src/examples/controls";
import { errorMessage } from "../src/spec/errors";
import type { ViewSpec } from "../src/spec/types";
import { validateViewSpec } from "../src/spec/validate";

export const PRODUCT_NAMES = Object.keys(PRODUCT_EXAMPLES).filter(isExampleName);
export const COVERAGE_NAMES = Object.keys(COVERAGE_EXAMPLES).filter(isExampleName);

export type CorpusDocument =
  | { readonly ok: true; readonly name: ExampleName | ControlName; readonly spec: ViewSpec; readonly text: string }
  | { readonly ok: false; readonly code: string; readonly message: string };

/** A control document, validated as `exampleSpec` validates the corpus. */
function controlDocument(name: ControlName): CorpusDocument {
  const { document } = CONTROL_EXAMPLES[name];
  const result = validateViewSpec(document);
  if (!result.ok) return { ok: false, code: "invalid-view", message: `The control document "${name}" does not conform: ${result.issues[0]?.message ?? ""}` };
  return { ok: true, name, spec: result.spec, text: `${JSON.stringify(document, null, 2)}\n` };
}

/**
 * The document `name`, as a spec and as the text a model would write: a
 * corpus document, or a control document (the browser checks' probes, which
 * the editor's list leaves out).
 */
export function corpusDocument(name: string): CorpusDocument {
  if (isControlName(name)) return controlDocument(name);
  if (!isExampleName(name)) {
    return { ok: false, code: "unknown-view", message: `No corpus or control document is named "${name}".` };
  }
  try {
    return { ok: true, name, spec: exampleSpec(name), text: exampleText(name) };
  } catch (error) {
    return { ok: false, code: "invalid-view", message: errorMessage(error) };
  }
}
