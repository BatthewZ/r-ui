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
 * Everything the renderer needs from its host. Nothing here has a network
 * default: without `fetch`, `api` bindings and `apiCall` send nothing and
 * report `missing-adapter`.
 */
export interface RendererAdapters {
  /** Serves the `navigate` action (scheme-checked first). Absent: same-origin `location.assign`, others refused. */
  readonly navigate?: (to: string, options: { readonly replace: boolean }) => void;
  /** Serves `showToast`. The library's `useToast().toast` fits as is. */
  readonly toast?: (toast: ToastRequest) => void;
  /** Performs `api` bindings and `apiCall`, with the URL already resolved and allowed. */
  readonly fetch?: (url: string, init: RequestInit) => Promise<Response>;
  /** Resolves `source` bindings. */
  readonly resolveSource?: (request: SourceRequest, signal: AbortSignal) => Promise<unknown>;
  /** Every request the document asks for. Default: same origin as the page. */
  readonly allowUrl?: (url: URL) => boolean;
  /** Every image the document makes the browser fetch. Default: same origin, or a `data:` raster image. */
  readonly allowImageUrl?: (url: URL) => boolean;
}
