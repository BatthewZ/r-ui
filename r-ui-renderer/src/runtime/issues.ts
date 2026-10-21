import type { Issue } from "../spec/types";
import type { IssueReporter } from "./context";

/** The view's issue channel: reported issues, readable by the issue log. */
export interface IssueChannel {
  readonly report: IssueReporter;
  readonly subscribe: (listener: () => void) => () => void;
  /** Issues no diagnostic element shows, in report order. */
  readonly getSnapshot: () => readonly Issue[];
}

const NO_ISSUES: readonly Issue[] = Object.freeze([]);

/** What makes an issue the same issue: its code and path. */
export function issueKey(issue: Issue): string {
  return `${issue.code}\u0000${issue.path}`;
}

/**
 * Each issue is delivered once per view (by code and path), on a microtask:
 * a report made while rendering reaches `onIssue` and the issue log after
 * that render, never inside it.
 */
export function createIssueChannel(onIssue?: (issue: Issue) => void): IssueChannel {
  const seen = new Set<string>();
  const queued: Array<{ issue: Issue; inPlace: boolean }> = [];
  const listeners = new Set<() => void>();
  let logged = NO_ISSUES;

  function flush(): void {
    const batch = queued.splice(0);
    const unlisted = batch.filter((entry) => !entry.inPlace).map((entry) => entry.issue);
    if (unlisted.length > 0) {
      logged = Object.freeze([...logged, ...unlisted]);
      for (const listener of [...listeners]) listener();
    }
    for (const { issue } of batch) onIssue?.(issue);
  }

  const report: IssueReporter = (issue, options) => {
    const key = issueKey(issue);
    if (seen.has(key)) return;
    seen.add(key);
    if (queued.length === 0) queueMicrotask(flush);
    queued.push({ issue, inPlace: options?.inPlace === true });
  };

  return {
    report,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => logged,
  };
}
