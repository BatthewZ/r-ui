import type { FormRegistry } from "../forms/registry";
import type { RendererAdapters } from "./adapters";
import type { ActionDispatcher, DialogState, IssueReporter, RefRoots } from "./context";

export interface DispatcherDeps {
  /** The latest values, read when a handler runs (never a render-time copy). */
  readonly getRoots: () => RefRoots;
  readonly setState: (path: string, value: unknown) => void;
  readonly forms: FormRegistry;
  readonly dialogs: DialogState;
  readonly adapters: RendererAdapters;
  readonly report: IssueReporter;
  readonly isComplete: () => boolean;
}

export function createActionDispatcher(deps: DispatcherDeps): ActionDispatcher {
  throw new Error("not implemented");
}
