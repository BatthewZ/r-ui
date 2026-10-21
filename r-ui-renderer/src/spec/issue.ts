import { isOneOf } from "./guards";
import { BLOCKING_CODES, ISSUE_CODE_INFO, type Issue, type IssueCode } from "./types";

/** An issue with its code's fixed severity: the one way the validator, the renderer and the runtime make one. */
export function makeIssue(code: IssueCode, path: string, message: string, suggestion?: string): Issue {
  const severity = ISSUE_CODE_INFO[code].severity;
  return suggestion === undefined ? { code, path, severity, message } : { code, path, severity, message, suggestion };
}

/** Whether the issue keeps a document from rendering as written: any error, or a `BLOCKING_CODES` warning. */
export function isBlocking(issue: Issue): boolean {
  return issue.severity === "error" || isOneOf(BLOCKING_CODES, issue.code);
}
