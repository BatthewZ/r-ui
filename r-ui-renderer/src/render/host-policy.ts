/**
 * Props the host decides, set on every node of the component (its contract
 * drops the document's own). Checked against the library's declarations by
 * its test.
 */

import type { ResolvedPolicy } from "../runtime/context";

export const HOST_PROPS: { readonly [component: string]: { readonly [prop: string]: (policy: ResolvedPolicy) => unknown } } = {
  Markdown: { imageAllowlist: (policy) => policy.markdownImages },
};
