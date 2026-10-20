/**
 * Renders a document node through `renderNode` with a hand-built context, for
 * the render core's tests. The runtime's dispatcher and issue channel are the
 * boundary here: `dispatch` is a spy and `report` collects; dialogs use the
 * runtime's real state. Not shipped (the name keeps it out of the package and
 * out of the test run).
 */

import { render, type RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";

import { renderThrowing } from "../../test-utils";

import { defaultContracts } from "../contracts";
import { icons as defaultIcons } from "../icons";
import type { IconSet } from "../icons/types";
import { type ComponentRegistry, defaultRegistry } from "../registry/registry";
import type { RendererAdapters } from "../runtime/adapters";
import type { DispatchContext, FormHandles, RefRoots, RenderContext, StreamingState } from "../runtime/context";
import { useDialogState } from "../runtime/dialogs";
import type { ComponentContracts, Handler, Issue } from "../spec/types";
import { IconSetContext } from "./icon-context";
import { renderNode } from "./render-node";
import { createRootScope, DEFAULT_VIEW_ENV, type ViewEnv } from "./scope";

export interface Reported {
  readonly issue: Issue;
  readonly inPlace: boolean;
}

export interface TreeOptions {
  readonly data?: { readonly [name: string]: unknown };
  readonly state?: { readonly [key: string]: unknown };
  readonly formsValues?: RefRoots["forms"];
  readonly forms?: FormHandles;
  readonly registry?: ComponentRegistry;
  readonly contracts?: ComponentContracts;
  readonly icons?: IconSet;
  readonly adapters?: RendererAdapters;
  readonly allowSensitive?: boolean | readonly string[];
  readonly streaming?: Partial<StreamingState>;
  readonly env?: Partial<ViewEnv>;
  readonly namespace?: string;
  /** A node is expected to throw on the first render: React's error dump is silenced for it (`renderThrowing`). */
  readonly throws?: boolean;
}

export type Dispatch = (handler: Handler, context: DispatchContext) => Promise<void>;

const NOTHING: ReadonlySet<string> = new Set();
const NO_ADAPTERS: RendererAdapters = {};

export function renderTree(root: unknown, initial: TreeOptions = {}) {
  const reported: Reported[] = [];
  const dispatch = vi.fn<Dispatch>(() => Promise.resolve());
  // Once per code and path, as the runtime's issue channel delivers them.
  const report: RenderContext["report"] = (issue, flags) => {
    if (reported.some((entry) => entry.issue.code === issue.code && entry.issue.path === issue.path)) return;
    reported.push({ issue, inPlace: flags?.inPlace === true });
  };

  interface Derived {
    readonly roots: RefRoots;
    readonly env: ViewEnv;
    readonly forms: FormHandles;
  }

  function Host(props: { root: unknown; options: TreeOptions; derived: Derived }): ReactNode {
    const { options, derived } = props;
    const dialogs = useDialogState();
    const icons = options.icons ?? defaultIcons;
    const ctx: RenderContext = {
      registry: options.registry ?? defaultRegistry,
      contracts: options.contracts ?? defaultContracts,
      icons,
      adapters: options.adapters ?? NO_ADAPTERS,
      allowSensitive: options.allowSensitive ?? false,
      roots: derived.roots,
      forms: derived.forms,
      dialogs,
      dispatch,
      report,
      streaming: { complete: true, pending: NOTHING, fallback: "none", ...options.streaming },
      namespace: options.namespace ?? "view",
    };
    return <IconSetContext value={icons}>{renderNode(props.root, createRootScope(ctx, derived.env))}</IconSetContext>;
  }

  const derive = (options: TreeOptions): Derived => ({
    roots: { data: options.data ?? {}, status: {}, state: options.state ?? {}, forms: options.formsValues ?? {} },
    env: { ...DEFAULT_VIEW_ENV, ...options.env },
    forms: options.forms ?? {},
  });

  let options = initial;
  let derived = derive(initial);
  const element = <Host root={root} options={options} derived={derived} />;
  const result: RenderResult = initial.throws === true ? renderThrowing(element) : render(element);
  return {
    ...result,
    reported,
    dispatch,
    /** Issues with `code`, as `[path, inPlace]` pairs. */
    issuesOf(code: Issue["code"]): [string, boolean][] {
      return reported.filter((entry) => entry.issue.code === code).map((entry) => [entry.issue.path, entry.inPlace]);
    },
    /** Renders `next` (or the same root) again; changed options give new roots. */
    update(next: unknown, changed?: TreeOptions) {
      if (changed !== undefined) {
        options = { ...options, ...changed };
        derived = derive(options);
      }
      result.rerender(<Host root={next} options={options} derived={derived} />);
    },
  };
}
