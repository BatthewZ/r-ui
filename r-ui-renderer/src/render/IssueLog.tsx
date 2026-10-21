import { createElement, type ReactNode, useSyncExternalStore } from "react";

import { RENDERER_CLASSES, diagnosticAttributes } from "../diagnostics";
import { type IssueChannel, issueKey } from "../runtime/issues";

/**
 * A hidden list (`RENDERER_CLASSES.issueLog`) of the issues no diagnostic
 * element shows, each one a diagnostic element, so every issue is queryable
 * in the DOM exactly once.
 */
export function IssueLog(props: { readonly channel: IssueChannel }): ReactNode {
  const { channel } = props;
  const issues = useSyncExternalStore(channel.subscribe, channel.getSnapshot, channel.getSnapshot);
  return createElement(
    "ul",
    { className: RENDERER_CLASSES.issueLog, hidden: true },
    issues.map((issue) =>
      createElement("li", { key: issueKey(issue), ...diagnosticAttributes(issue) }, issue.message),
    ),
  );
}
