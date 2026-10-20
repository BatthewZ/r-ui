/**
 * Render-side facts about a few library components that the contracts do not
 * carry. Each table is checked against the library's declarations by its test.
 */

import type { ViewEnv } from "./scope";

/** Props the host decides, set on every node of the component (contracts drop the document's own). */
export const HOST_PROPS: { readonly [component: string]: { readonly [prop: string]: (env: ViewEnv) => unknown } } = {
  Markdown: { imageAllowlist: (env) => env.markdownImageAllowlist },
};

/** Props a document may set only as a number: the library also takes a ref there, which JSON can only fake. */
export const NUMBER_ONLY_PROPS: { readonly [component: string]: readonly string[] } = {
  "Popover.Content": ["initialFocus"],
};

/**
 * Parents whose children sit in element-structured markup (`<table>` rows
 * and cells, `<dl>`, `<select>`): a diagnostic element there would be
 * invalid, so the issue log shows it instead.
 */
export const STRUCTURAL_PARENTS: ReadonlySet<string> = new Set([
  "Table",
  "Table.Head",
  "Table.Body",
  "Table.Row",
  "DescriptionList",
  "Select",
]);

/** Elements a layout component may render as (`as`) whose children are structured the same way. */
export const STRUCTURAL_ELEMENTS: ReadonlySet<string> = new Set(["ul", "ol"]);
