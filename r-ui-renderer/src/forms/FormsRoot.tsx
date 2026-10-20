import type { ReactNode } from "react";

import type { FormRefState } from "../spec/types";
import type {
  ActionDispatcher,
  FormHandles,
  IssueReporter,
  RefRoots,
  StreamingState,
} from "../runtime/context";
import type { FormRegistry } from "./registry";

export interface FormsSnapshot {
  readonly handles: FormHandles;
  readonly values: { readonly [name: string]: FormRefState };
}

export interface FormsRootProps {
  /** The document's `forms` object as far as it has arrived. */
  readonly defs: unknown;
  readonly streaming: StreamingState;
  /** For initial values that `$ref` data or state. */
  readonly roots: Omit<RefRoots, "forms">;
  readonly dispatch: ActionDispatcher;
  readonly registry: FormRegistry;
  readonly report: IssueReporter;
  readonly children: (forms: FormsSnapshot) => ReactNode;
}

/**
 * One FormHost per form def, each calling the library's `useForm` once (keyed
 * by `formDefHash`), publishing its handle to `registry` and to `children`. A
 * form mounts once its def has closed and its initial `$ref`s have resolved
 * (or their binding failed), and is never re-keyed after that.
 */
export function FormsRoot(props: FormsRootProps): ReactNode {
  throw new Error("not implemented");
}
