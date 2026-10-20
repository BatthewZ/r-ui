import { defaultAllowUrl, resolveUrl } from "../spec/url-policy";
import type { JsonValue } from "../spec/types";
import type { RendererAdapters } from "./adapters";

export interface RequestPlan {
  /** Literal, as the document wrote it. */
  readonly endpoint: string;
  readonly method: string;
  /** Resolved values; non-scalars are left out of the query string. */
  readonly query?: unknown;
  /** Resolved; sent as JSON except with GET and DELETE. */
  readonly body?: unknown;
}

export type PreparedRequest =
  | { readonly ok: true; readonly url: string; readonly init: RequestInit }
  | { readonly ok: false; readonly message: string };

const NO_BODY: ReadonlySet<string> = new Set(["GET", "DELETE"]);

/**
 * The request a plan describes, or why it may not be made. The endpoint's
 * origin is judged on the URL it resolves to (never on how the string
 * starts), by the host's `allowUrl` or, without one, same-origin.
 */
export function prepareRequest(plan: RequestPlan, adapters: RendererAdapters): PreparedRequest {
  const url = resolveUrl(plan.endpoint);
  if (url === null) return { ok: false, message: `"${plan.endpoint}" is not an allowed URL.` };
  const allow = adapters.allowUrl ?? ((candidate: URL) => defaultAllowUrl(candidate));
  if (!allow(url)) return { ok: false, message: `Requests to ${url.origin} are not allowed.` };

  if (typeof plan.query === "object" && plan.query !== null && !Array.isArray(plan.query)) {
    for (const [name, value] of Object.entries(plan.query)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        url.searchParams.append(name, String(value));
      }
    }
  }

  const init: { method: string; headers?: Record<string, string>; body?: string } = { method: plan.method };
  if (plan.body !== undefined && !NO_BODY.has(plan.method)) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(plan.body);
  }
  return { ok: true, url: url.href, init };
}

export type RequestOutcome =
  | { readonly ok: true; readonly body: JsonValue }
  | { readonly ok: false; readonly status: number | null; readonly message: string; readonly body: JsonValue };

async function readBody(response: Response): Promise<JsonValue> {
  const text = await response.text();
  const type = response.headers.get("content-type") ?? "";
  if (!/\bjson\b/i.test(type)) return text;
  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    return text;
  }
}

/** Performs a prepared request: the parsed body (JSON when the response says so, else text), or why it failed. */
export async function performRequest(
  fetcher: NonNullable<RendererAdapters["fetch"]>,
  url: string,
  init: RequestInit,
): Promise<RequestOutcome> {
  let response: Response;
  try {
    response = await fetcher(url, init);
  } catch (error) {
    if (init.signal?.aborted) throw error;
    return { ok: false, status: null, message: error instanceof Error ? error.message : "The request failed.", body: null };
  }
  let body: JsonValue;
  try {
    body = await readBody(response);
  } catch (error) {
    if (init.signal?.aborted) throw error;
    body = null;
  }
  if (response.ok) return { ok: true, body };
  return { ok: false, status: response.status, message: `The request failed with status ${response.status}.`, body };
}
