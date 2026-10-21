import type { JsonValue, ToastTone } from "../spec/types";

export interface ToastRequest {
  readonly title: string;
  readonly description?: string;
  readonly tone?: ToastTone;
}

export interface SourceRequest {
  readonly source: string;
  /** `params` with every `$ref` resolved. */
  readonly params: { readonly [name: string]: JsonValue };
}

/**
 * The effects the renderer needs from its host; what a document may reach is
 * the `policy`. Nothing here has a default: without `fetch`, `api` bindings
 * and `apiCall` send nothing, and without `navigate` nothing navigates; each
 * reports `missing-adapter`.
 */
export interface RendererAdapters {
  /**
   * Serves the `navigate` action with the resolved, scheme-checked URL
   * (`url.href`). `(to, { replace }) => replace ? location.replace(to) : location.assign(to)`
   * follows it in the page.
   */
  readonly navigate?: (to: string, options: { readonly replace: boolean }) => void;
  /** Serves `showToast`. The library's `useToast().toast` fits as is. */
  readonly toast?: (toast: ToastRequest) => void;
  /** Performs `api` bindings and `apiCall`, with the URL already resolved and allowed by the policy. */
  readonly fetch?: (url: string, init: RequestInit) => Promise<Response>;
  /** Resolves `source` bindings. */
  readonly resolveSource?: (request: SourceRequest, signal: AbortSignal) => Promise<unknown>;
}
