/**
 * Every class the renderer marks its own elements with. The renderer never
 * throws at a bad document; it renders a diagnostic and carries on, which
 * makes "did anything go wrong?" a DOM question, and this module is the only
 * answer to it. Every diagnostic element carries `diagnostic`, one severity
 * class, `data-code` (an IssueCode) and `data-path` (a JSON Pointer).
 */

import type { IssueCode, IssueSeverity } from "./spec/types";

export const RENDERER_CLASSES = {
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
  /** The built-ins. A prop's value appends to its base: `r-renderer-text-body-2`, `r-renderer-heading-h3`. */
  text: "r-renderer-text",
  heading: "r-renderer-heading",
  icon: "r-renderer-icon",
  /** Prefixes, on any built-in: `r-renderer-tone-muted`, `r-renderer-weight-medium`. */
  tone: "r-renderer-tone",
  weight: "r-renderer-weight",
} as const;

export const DIAGNOSTIC_SELECTOR = `.${RENDERER_CLASSES.diagnostic}`;

function severityClass(severity: IssueSeverity): string {
  return severity === "error" ? RENDERER_CLASSES.error : RENDERER_CLASSES.warning;
}

/** What every diagnostic element carries: its classes (plus `extraClass`), `data-code` and, when known, `data-path`. */
export function diagnosticAttributes(
  issue: { readonly code: IssueCode; readonly severity: IssueSeverity; readonly path?: string },
  extraClass?: string,
): { readonly className: string; readonly "data-code": IssueCode; readonly "data-path"?: string } {
  const className = [RENDERER_CLASSES.diagnostic, severityClass(issue.severity), extraClass].filter(Boolean).join(" ");
  return issue.path === undefined ? { className, "data-code": issue.code } : { className, "data-code": issue.code, "data-path": issue.path };
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
    severity: element.classList.contains(RENDERER_CLASSES.error) ? "error" : "warning",
    text: element.textContent?.trim() ?? "",
  }));
}
