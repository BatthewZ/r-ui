import { Badge, Button } from "@batthewz/r-ui-react-components";
import { useId } from "react";

import type { Issue } from "../src";

interface IssuePanelProps {
  readonly issues: readonly Issue[];
  /** Moves the editor's caret to what `issue` points at. */
  readonly onJump: (issue: Issue) => void;
}

/** `validateViewSpec`'s issues for the editor's text; each path jumps the caret. */
export function IssuePanel({ issues, onJump }: IssuePanelProps) {
  const titleId = useId();
  const errors = issues.filter((issue) => issue.severity === "error").length;
  return (
    <section className="pg-issues" aria-labelledby={titleId}>
      <h2 id={titleId} className="pg-issues-title">
        Issues
        <Badge tone={errors > 0 ? "error" : issues.length > 0 ? "warning" : "success"}>{issues.length}</Badge>
      </h2>
      {issues.length === 0 ? (
        <p className="pg-note">The document conforms, with no warnings.</p>
      ) : (
        <ul className="pg-issue-list">
          {issues.map((issue, index) => (
            <li key={`${issue.code}:${issue.path}:${index}`} className="pg-issue">
              <div className="pg-issue-head">
                <Badge tone={issue.severity === "error" ? "error" : "warning"}>{issue.severity}</Badge>
                <code>{issue.code}</code>
                <Button variant="ghost" className="pg-issue-path" onClick={() => onJump(issue)}>
                  {issue.line === undefined ? issue.path || "(document)" : `line ${issue.line}, column ${issue.column ?? 1}`}
                </Button>
              </div>
              <p>{issue.message}</p>
              {issue.suggestion !== undefined && (
                <p className="pg-note">
                  Instead: <code>{issue.suggestion}</code>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
