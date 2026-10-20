import { Component, type ReactNode } from "react";

import type { IssueReporter } from "../runtime/context";
import { makeIssue } from "../spec/issue";
import { diagnosticElement } from "./diagnostic";

export interface NodeBoundaryProps {
  /** JSON Pointer of the node it contains. */
  readonly path: string;
  readonly report: IssueReporter;
  /** No element may stand here: the issue log shows a failure instead. */
  readonly structural: boolean;
  /** The node is still streaming: a failure shows `pending` and is not reported (it may be half-built). */
  readonly pending: ReactNode | undefined;
  readonly children?: ReactNode;
}

interface NodeBoundaryState {
  readonly failure: string | null;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Contains a throw to its node. Adds no DOM. It never remembers: new children
 * (anything above re-rendered: a fixed document, a new value from data) are a
 * fresh attempt, so its diagnostic always describes the render it shows.
 */
export class NodeBoundary extends Component<NodeBoundaryProps, NodeBoundaryState> {
  override state: NodeBoundaryState = { failure: null };

  static getDerivedStateFromError(error: unknown): NodeBoundaryState {
    return { failure: messageOf(error) };
  }

  override componentDidCatch(error: unknown): void {
    if (this.props.pending !== undefined) return;
    this.props.report(makeIssue("render-error", this.props.path, messageOf(error)), { inPlace: !this.props.structural });
  }

  override componentDidUpdate(previous: NodeBoundaryProps): void {
    // Cannot loop: this boundary's own state change does not produce new children.
    if (this.state.failure !== null && previous.children !== this.props.children) this.setState({ failure: null });
  }

  override render(): ReactNode {
    const { failure } = this.state;
    if (failure === null) return this.props.children;
    if (this.props.pending !== undefined) return this.props.pending;
    if (this.props.structural) return null;
    return diagnosticElement(makeIssue("render-error", this.props.path, failure));
  }
}
