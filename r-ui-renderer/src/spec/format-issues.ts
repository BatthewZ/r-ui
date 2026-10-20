import type { Issue } from "./types";

export interface FormatIssuesOptions {
  /** Issues past this many are summarised as a count. 50 when absent. */
  readonly maxIssues?: number;
}

/**
 * The issues as plain text for the producer's next attempt: errors first, one
 * line each with its JSON Pointer, message and suggestion.
 */
export function formatIssuesForModel(issues: readonly Issue[], options: FormatIssuesOptions = {}): string {
  throw new Error("not implemented");
}
