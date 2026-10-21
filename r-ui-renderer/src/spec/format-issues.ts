import { isBlocking } from "./issue";
import type { Issue } from "./types";

export interface FormatIssuesOptions {
  /** Issues past this many are summarised as a count. 50 when absent. */
  readonly maxIssues?: number;
}

/** An issue's JSON Pointer (`(document)` for the whole), with its line and column when it has them. */
export function issueLocation(issue: Issue): string {
  const at = issue.path === "" ? "(document)" : issue.path;
  const where = issue.line === undefined ? "" : ` (line ${issue.line}, column ${issue.column ?? 1})`;
  return `${at}${where}`;
}

function line(issue: Issue): string {
  const fix = issue.suggestion === undefined ? "" : ` Use ${issue.suggestion}.`;
  return `${issueLocation(issue)} ${issue.severity} ${issue.code}: ${issue.message}${fix}`;
}

function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * The issues as plain text for the producer's next attempt: errors first, one
 * line each with its JSON Pointer, message and suggestion. The first line says
 * whether to send the document again: until it is renderable (no error, no
 * blocking warning).
 */
export function formatIssuesForModel(issues: readonly Issue[], options: FormatIssuesOptions = {}): string {
  if (issues.length === 0) return "The document is valid: no issues.";
  const max = Math.max(0, options.maxIssues ?? 50);
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity !== "error");
  const ordered = [...errors, ...warnings];
  const blocking = warnings.filter(isBlocking).length;
  const head =
    errors.length > 0
      ? `The document is not valid: ${count(errors.length, "error")}, ${count(warnings.length, "warning")}. Fix each one and send the whole document again.`
      : blocking > 0
        ? `The document is valid but does not render as written: ${count(blocking, "warning")} of ${warnings.length} would show a diagnostic or nothing in its place. Fix each one and send the whole document again.`
        : `The document is valid and renders, with ${count(warnings.length, "warning")}: each names something that will be dropped or will not work.`;
  const shown = ordered.slice(0, max).map(line);
  const rest = ordered.length - shown.length;
  const tail = rest > 0 ? [`…and ${rest} more (${count(errors.length - Math.min(errors.length, max), "error")} among them).`] : [];
  return [head, ...shown, ...tail].join("\n");
}
