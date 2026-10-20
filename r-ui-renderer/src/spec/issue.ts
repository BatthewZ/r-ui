import { ISSUE_CODE_INFO, type Issue, type IssueCode } from "./types";

/** An issue with its code's fixed severity: the one way the validator, the renderer and the runtime make one. */
export function makeIssue(code: IssueCode, path: string, message: string, suggestion?: string): Issue {
  const severity = ISSUE_CODE_INFO[code].severity;
  return suggestion === undefined ? { code, path, severity, message } : { code, path, severity, message, suggestion };
}
