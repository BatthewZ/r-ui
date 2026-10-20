import type { Issue } from "../spec/types";
import type { IssueReporter } from "./context";

/** The view's issue channel: reported issues, readable by the issue log. */
export interface IssueChannel {
  readonly report: IssueReporter;
  readonly subscribe: (listener: () => void) => () => void;
  /** Issues no diagnostic element shows, in report order. */
  readonly getSnapshot: () => readonly Issue[];
}

export function createIssueChannel(onIssue?: (issue: Issue) => void): IssueChannel {
  throw new Error("not implemented");
}
