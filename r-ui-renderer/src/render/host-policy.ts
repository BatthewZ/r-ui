/**
 * Props the host decides, set on every node of the component (its contract
 * drops the document's own). Checked against the library's declarations by
 * its test.
 */

import type { ViewEnv } from "./scope";

export const HOST_PROPS: { readonly [component: string]: { readonly [prop: string]: (env: ViewEnv) => unknown } } = {
  Markdown: { imageAllowlist: (env) => env.markdownImageAllowlist },
};
