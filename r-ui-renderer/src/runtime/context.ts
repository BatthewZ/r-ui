import type { ViewFormApi } from "../forms/registry";
import type { IconSet } from "../icons/types";
import type { ComponentRegistry } from "../registry/registry";
import type {
  BindingStatus,
  ComponentContracts,
  EventValueKind,
  FormRefState,
  Handler,
  HostPolicy,
  Issue,
} from "../spec/types";
import type { RendererAdapters } from "./adapters";

/** What a `$ref` can reach besides local names. `event` exists only while a handler runs. */
export interface RefRoots {
  readonly data: { readonly [name: string]: unknown };
  readonly status: { readonly [name: string]: BindingStatus };
  readonly state: { readonly [key: string]: unknown };
  readonly forms: { readonly [name: string]: FormRefState };
}

/**
 * Reports an issue. Safe to call during render (it is delivered after the
 * commit) and deduplicated by code and path. `inPlace`: a diagnostic element
 * already shows it, so the view's issue log does not list it again.
 */
export type IssueReporter = (issue: Issue, options?: { readonly inPlace?: boolean }) => void;

export interface DispatchContext {
  /** The callback's arguments. */
  readonly args: readonly unknown[];
  /** Local names at the handler's node (`$each` aliases, template names). */
  readonly vars: { readonly [name: string]: unknown };
  /** JSON Pointer of the handler, for issues. */
  readonly path: string;
  /** From the component's contract; `value` when absent. */
  readonly eventValue?: EventValueKind;
}

/**
 * Runs a handler against the latest values. Resolves when every action has
 * finished; rejects when one fails (an `apiCall` that errors), after its
 * `onError` ran. Inert (resolves at once) until the document is complete.
 */
export type ActionDispatcher = (handler: Handler, context: DispatchContext) => Promise<void>;

/** Open state of dialog components, by `dialogId`; a boolean from the first render. */
export interface DialogState {
  /**
   * `initial` seeds an id seen for the first time (a node's `defaultOpen`).
   * `pending`: the asking node is still streaming, so its props may be
   * incomplete; the seed is read but not recorded.
   */
  isOpen(dialogId: string, initial?: boolean, pending?: boolean): boolean;
  setOpen(dialogId: string, open: boolean): void;
}

/** A declared form's handle by name: what a `Form` (or `Wizard`) node's `form` prop receives. */
export type FormHandles = { readonly [name: string]: ViewFormApi };

export type StreamingFallback = "none" | "skeleton";

export interface StreamingState {
  readonly complete: boolean;
  /** JSON Pointers still open (see StreamSnapshot); empty once complete. */
  readonly pending: ReadonlySet<string>;
  readonly fallback: StreamingFallback;
}

/** The host's policy with every default filled in (`resolvePolicy`): what the renderer reads. */
export type ResolvedPolicy = Readonly<Required<HostPolicy>>;

/** Everything `renderNode` reads, built once per render of the view root. */
export interface RenderContext {
  readonly registry: ComponentRegistry;
  readonly contracts: ComponentContracts;
  readonly icons: IconSet | undefined;
  /** Effects only: navigation, toasts, network, named sources. */
  readonly adapters: RendererAdapters;
  /** What the document may reach: URLs, images, Markdown images, sensitive components and values. */
  readonly policy: ResolvedPolicy;
  readonly roots: RefRoots;
  readonly forms: FormHandles;
  readonly dialogs: DialogState;
  readonly dispatch: ActionDispatcher;
  readonly report: IssueReporter;
  readonly streaming: StreamingState;
  /** Unique per mounted view: prefixes keys a component persists (`namespacedProps`). */
  readonly namespace: string;
}
