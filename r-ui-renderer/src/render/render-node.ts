import type { ReactNode } from "react";

import type { Scope } from "./scope";

/**
 * A document node (untrusted, possibly still streaming) as React elements:
 * the library's own elements built directly, with no wrapper component or
 * wrapper DOM between a parent and the children it reads. `$each` yields an
 * array of keyed siblings. Never throws: a bad node renders a diagnostic in
 * place, or reports one where its context allows no element.
 */
export function renderNode(node: unknown, scope: Scope): ReactNode {
  throw new Error("not implemented");
}
