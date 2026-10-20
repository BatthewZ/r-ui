import type { BindingStatus } from "../spec/types";
import type { RendererAdapters } from "./adapters";
import type { IssueReporter } from "./context";

export interface DataBindingsOptions {
  readonly adapters: RendererAdapters;
  /** For `$ref state.…` in `query`, `body` and `params`. */
  readonly state: { readonly [key: string]: unknown };
  /** JSON Pointers still open; a binding starts once its object has closed. */
  readonly pending: ReadonlySet<string>;
  readonly report: IssueReporter;
}

export interface DataSnapshot {
  readonly data: { readonly [name: string]: unknown };
  readonly status: { readonly [name: string]: BindingStatus };
}

/** Loads the document's `data` bindings (the raw, possibly partial `data` object). */
export function useDataBindings(bindings: unknown, options: DataBindingsOptions): DataSnapshot {
  throw new Error("not implemented");
}
