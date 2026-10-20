import type { FormRegistry } from "../forms/registry";
import type { PartialDocument } from "../stream/snapshot";
import type { Issue } from "../spec/types";
import type { RendererAdapters } from "./adapters";
import type { ActionDispatcher, DialogState, RefRoots, StreamingState } from "./context";
import type { IssueChannel } from "./issues";

export interface ViewRuntimeOptions {
  /** The top-level object as far as it has arrived. */
  readonly document: PartialDocument | undefined;
  readonly streaming: StreamingState;
  readonly adapters: RendererAdapters;
  readonly onIssue?: (issue: Issue) => void;
}

export interface ViewRuntime {
  /** `data`, `status` and `state`; `forms` comes from FormsRoot. */
  readonly roots: Omit<RefRoots, "forms">;
  readonly dispatch: ActionDispatcher;
  readonly dialogs: DialogState;
  readonly issues: IssueChannel;
  /** Where FormsRoot publishes form handles for `submitForm`/`resetForm`. */
  readonly forms: FormRegistry;
}

/** State, data bindings, dialogs, the action dispatcher and the issue channel of one view. */
export function useViewRuntime(options: ViewRuntimeOptions): ViewRuntime {
  throw new Error("not implemented");
}
