/**
 * Every class the renderer marks its own elements with. The renderer never
 * throws at a bad document; it renders a diagnostic and carries on, which
 * makes "did anything go wrong?" a DOM question, and this module is the only
 * answer to it. Every diagnostic element carries `diagnostic`, one severity
 * class, `data-code` (an IssueCode) and `data-path` (a JSON Pointer).
 */

import type { IssueCode, IssueSeverity } from "./spec/types";

export const DIAGNOSTIC_CLASSES = {
  /** The view root element. */
  view: "r-renderer-view",
  /** Every diagnostic element, shown in place or listed in the issue log. */
  diagnostic: "r-renderer-diagnostic",
  error: "r-renderer-diagnostic-error",
  warning: "r-renderer-diagnostic-warning",
  /** The placeholder an icon the set lacks renders (with `diagnostic`). */
  missingIcon: "r-renderer-missing-icon",
  /** The hidden list of issues that have no element in place. */
  issueLog: "r-renderer-issue-log",
  /** The placeholder a pending node renders when the view opts into one. */
  pending: "r-renderer-pending",
} as const;

export const DIAGNOSTIC_SELECTOR = `.${DIAGNOSTIC_CLASSES.diagnostic}`;

export function severityClass(severity: IssueSeverity): string {
  return severity === "error" ? DIAGNOSTIC_CLASSES.error : DIAGNOSTIC_CLASSES.warning;
}

export interface FoundDiagnostic {
  readonly code: IssueCode | null;
  readonly path: string | null;
  readonly severity: IssueSeverity;
  /** The element's text, which may be empty (a missing icon). */
  readonly text: string;
}

/**
 * Every diagnostic under `root`, hidden ones included. Scan `document.body`
 * when the claim is "nothing went wrong anywhere": a floating panel renders in
 * place, but a dialog's content mounts only while open.
 */
export function findDiagnostics(root: ParentNode): FoundDiagnostic[] {
  return [...root.querySelectorAll(DIAGNOSTIC_SELECTOR)].map((element) => ({
    code: element.getAttribute("data-code") as IssueCode | null,
    path: element.getAttribute("data-path"),
    severity: element.classList.contains(DIAGNOSTIC_CLASSES.error) ? "error" : "warning",
    text: element.textContent?.trim() ?? "",
  }));
}
