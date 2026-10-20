import type { ReactNode } from "react";

import type { IssueChannel } from "../runtime/issues";

/**
 * A hidden list (`DIAGNOSTIC_CLASSES.issueLog`) of the issues no diagnostic
 * element shows, each one a diagnostic element, so every issue is queryable
 * in the DOM exactly once.
 */
export function IssueLog(props: { readonly channel: IssueChannel }): ReactNode {
  throw new Error("not implemented");
}
