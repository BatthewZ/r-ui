import { COVERAGE_EXAMPLES, EXAMPLES, type ExampleName, isExampleName, PRODUCT_EXAMPLES } from "../src/examples";
import { CONTROL_EXAMPLES, type ControlName, isControlName } from "../src/examples/controls";
import type { ViewSpec } from "../src/spec/types";
import { validateViewSpec } from "../src/spec/validate";
import { FIXTURE_PATH } from "./adapters";

export const PRODUCT_NAMES = Object.keys(PRODUCT_EXAMPLES).filter(isExampleName);
export const COVERAGE_NAMES = Object.keys(COVERAGE_EXAMPLES).filter(isExampleName);

export type CorpusDocument =
  | { readonly ok: true; readonly name: ExampleName | ControlName; readonly spec: ViewSpec; readonly text: string }
  | { readonly ok: false; readonly code: string; readonly message: string };

/**
 * The corpus names its fixtures at `/fixtures/`. Under another base path (a
 * project site) the playground serves them at FIXTURE_PATH, so the document's
 * fixture paths move there too; every one is a whole string value.
 */
function rebaseFixtures(document: unknown): unknown {
  if (FIXTURE_PATH === "/fixtures/") return document;
  return JSON.parse(JSON.stringify(document).replaceAll('"/fixtures/', `"${FIXTURE_PATH}`));
}

function validated(kind: "corpus" | "control", name: ExampleName | ControlName, document: unknown): CorpusDocument {
  const rebased = rebaseFixtures(document);
  const result = validateViewSpec(rebased);
  if (!result.ok) return { ok: false, code: "invalid-view", message: `The ${kind} document "${name}" does not conform: ${result.issues[0]?.message ?? ""}` };
  return { ok: true, name, spec: result.spec, text: `${JSON.stringify(rebased, null, 2)}\n` };
}

/**
 * The document `name`, as a spec and as the text a model would write: a
 * corpus document, or a control document (the browser checks' probes, which
 * the editor's list leaves out).
 */
export function corpusDocument(name: string): CorpusDocument {
  if (isControlName(name)) return validated("control", name, CONTROL_EXAMPLES[name].document);
  if (isExampleName(name)) return validated("corpus", name, EXAMPLES[name]);
  return { ok: false, code: "unknown-view", message: `No corpus or control document is named "${name}".` };
}
