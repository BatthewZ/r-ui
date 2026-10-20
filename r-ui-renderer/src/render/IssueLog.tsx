import { createElement, type ReactNode, useSyncExternalStore } from "react";

import { DIAGNOSTIC_CLASSES, diagnosticAttributes } from "../diagnostics";
import type { IssueChannel } from "../runtime/issues";

/**
 * A hidden list (`DIAGNOSTIC_CLASSES.issueLog`) of the issues no diagnostic
 * element shows, each one a diagnostic element, so every issue is queryable
 * in the DOM exactly once.
 */
export function IssueLog(props: { readonly channel: IssueChannel }): ReactNode {
  const { channel } = props;
  const issues = useSyncExternalStore(channel.subscribe, channel.getSnapshot, channel.getSnapshot);
  return createElement(
    "ul",
    { className: DIAGNOSTIC_CLASSES.issueLog, hidden: true },
    issues.map((issue) =>
      createElement("li", { key: `${issue.code}\u0000${issue.path}`, ...diagnosticAttributes(issue) }, issue.message),
    ),
  );
}
