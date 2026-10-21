import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { createFormRegistry, type FormRegistry } from "../forms/registry";
import { ownValue } from "../spec/guards";
import type { PartialDocument } from "../stream/snapshot";
import type { Issue } from "../spec/types";
import { createActionDispatcher } from "./actions";
import type { RendererAdapters } from "./adapters";
import type { ActionDispatcher, DialogState, RefRoots, ResolvedPolicy, StreamingState } from "./context";
import { useDataBindings } from "./data";
import { useDialogState } from "./dialogs";
import { createIssueChannel, type IssueChannel } from "./issues";
import { type FormatValue, plainFormat } from "./resolve";
import { useViewState } from "./state";

export interface ViewRuntimeOptions {
  /** The top-level object as far as it has arrived. */
  readonly document: PartialDocument | undefined;
  readonly streaming: StreamingState;
  readonly adapters: RendererAdapters;
  readonly policy: ResolvedPolicy;
  readonly onIssue?: (issue: Issue) => void;
  /** `$format` in action payloads, in the host's locale; plain text without it. */
  readonly format?: FormatValue;
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

/** A top-level section once its object has closed (`state`, `data`, `forms` take effect then). */
function closedSection(document: PartialDocument | undefined, key: string, pending: ReadonlySet<string>): unknown {
  if (document === undefined || pending.has(`/${key}`)) return undefined;
  return ownValue(document, key);
}

/**
 * State, data bindings, dialogs, the action dispatcher and the issue channel
 * of one document: a new document mounts a new runtime (the view keys it by
 * generation), so nothing here is ever reset.
 */
export function useViewRuntime(options: ViewRuntimeOptions): ViewRuntime {
  const { document, streaming, adapters, policy } = options;

  const latestOnIssue = useRef(options.onIssue);
  const [issues] = useState(() => createIssueChannel((issue) => latestOnIssue.current?.(issue)));
  const [forms] = useState(createFormRegistry);

  const view = useViewState(closedSection(document, "state", streaming.pending));
  const { data, status } = useDataBindings(document?.data, {
    adapters,
    policy,
    state: view.state,
    pending: streaming.pending,
    report: issues.report,
  });
  const dialogs = useDialogState();

  const latest = useRef({ data, status, adapters, policy, dialogs, complete: streaming.complete, format: options.format });
  useLayoutEffect(() => {
    latestOnIssue.current = options.onIssue;
    latest.current = { data, status, adapters, policy, dialogs, complete: streaming.complete, format: options.format };
  });

  const [dispatch] = useState(() =>
    createActionDispatcher({
      getRoots: () => ({
        data: latest.current.data,
        status: latest.current.status,
        state: view.getState(),
        forms: forms.getSnapshot().values,
      }),
      setState: view.setState,
      forms,
      dialogs: { isOpen: (id, initial) => latest.current.dialogs.isOpen(id, initial), setOpen: dialogs.setOpen },
      getAdapters: () => latest.current.adapters,
      getPolicy: () => latest.current.policy,
      report: issues.report,
      isComplete: () => latest.current.complete,
      format: (value, spec) => (latest.current.format ?? plainFormat)(value, spec),
    }),
  );

  const roots = useMemo(() => ({ data, status, state: view.state }), [data, status, view.state]);
  return { roots, dispatch, dialogs, issues, forms };
}
