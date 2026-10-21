// What each browser check runs inside: the run's constants, the prelude, the
// script, and the prelude's `resetPage` after it, pass or fail. Reads the
// renderer's own modules, so it loads on bun (the runner) and under vitest.

import { DIAGNOSTIC_SELECTOR, RENDERER_CLASSES } from "../../../src/diagnostics.ts";
import { CONTROL_EXAMPLES } from "../../../src/examples/controls/index.ts";
import { COVERAGE_EXAMPLES, PRODUCT_EXAMPLES } from "../../../src/examples/index.ts";

/**
 * The constants every check reads instead of spelling them: the playground's
 * URL, the selectors `src/diagnostics.ts` defines, and the documents (corpus
 * names; each control document's declared diagnostic codes).
 */
export function checkConstants(home) {
  return {
    BROWSER_CHECK_HOME: home,
    DIAGNOSTIC_SELECTOR,
    VIEW_SELECTOR: `.${RENDERER_CLASSES.view}`,
    CORPUS: {
      product: Object.keys(PRODUCT_EXAMPLES),
      coverage: Object.keys(COVERAGE_EXAMPLES),
      controls: Object.fromEntries(Object.entries(CONTROL_EXAMPLES).map(([name, control]) => [name, control.diagnostics])),
    },
  };
}

/** The `async (page) => …` that `run-code` gets for `source`, with `constants` and `prelude` in its scope. */
export function wrapScript(source, constants, prelude) {
  return [
    "async (page) => {",
    ...Object.entries(constants).map(([name, value]) => `const ${name} = ${JSON.stringify(value)};`),
    // playwright-cli's page waits for a navigation without limit, and a locator's wait for its own default.
    "page.setDefaultNavigationTimeout(30_000);",
    "page.setDefaultTimeout(15_000);",
    prelude,
    "let failed = false;",
    "let result;",
    "try {",
    `  result = await (${source.trim().replace(/;$/, "")}\n)(page);`,
    "} catch (error) {",
    "  failed = true;",
    "  throw error;",
    "} finally {",
    "  try {",
    "    await resetPage(page);",
    "  } catch (error) {",
    "    if (!failed) throw error;",
    "  }",
    "}",
    "return result;",
    "}",
  ].join("\n");
}
