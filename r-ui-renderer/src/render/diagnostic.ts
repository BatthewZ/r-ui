import { createElement, type ReactElement, type ReactNode } from "react";

import { diagnosticAttributes } from "../diagnostics";
import { makeIssue } from "../spec/issue";
import type { Issue, IssueCode } from "../spec/types";
import type { Scope } from "./scope";

/** The element that shows `issue` where its node would have been. */
export function diagnosticElement(issue: Issue, key?: string, extraClass?: string): ReactElement {
  // A span, so it is valid inside phrasing content too; the stylesheet makes it a block.
  return createElement("span", { key, ...diagnosticAttributes(issue, extraClass) }, issue.message);
}

/**
 * Shows `issue` in place, or, where no element may stand (`structural`),
 * hands it to the issue log and renders nothing.
 */
export function placeDiagnostic(scope: Scope, issue: Issue, structural: boolean, key?: string): ReactNode {
  if (structural) {
    scope.ctx.report(issue);
    return null;
  }
  scope.ctx.report(issue, { inPlace: true });
  return diagnosticElement(issue, key);
}

/** An issue no element shows (a dropped prop, an unrenderable value): the issue log lists it. */
export function reportIssue(scope: Scope, code: IssueCode, path: string, message: string): void {
  scope.ctx.report(makeIssue(code, path, message));
}
