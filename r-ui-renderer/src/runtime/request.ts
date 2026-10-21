import { resolveUrl } from "../spec/url-policy";
import type { JsonValue } from "../spec/types";
import type { RendererAdapters } from "./adapters";

export interface RequestPlan {
  /** Literal, as the document wrote it. */
  readonly endpoint: string;
  readonly method: string;
  /** Resolved values: scalars, and lists of them as repeated parameters; `null` and objects are left out. */
  readonly query?: unknown;
  /** Resolved; sent as JSON except with GET and DELETE. */
  readonly body?: unknown;
}

export type PreparedRequest =
  | {
      readonly ok: true;
      readonly url: string;
      readonly init: RequestInit;
      /** Query parameters left out because they have no query-string form (an object, or a list holding one). */
      readonly unusable: readonly string[];
    }
  | { readonly ok: false; readonly message: string };

type Scalar = string | number | boolean;
const isScalar = (value: unknown): value is Scalar => typeof value === "string" || typeof value === "number" || typeof value === "boolean";

export const UNUSABLE_QUERY = "An object has no query-string form; this parameter was left out.";

const NO_BODY: ReadonlySet<string> = new Set(["GET", "DELETE"]);

/**
 * The request a plan describes, or why it may not be made. The endpoint's
 * origin is judged on the URL it resolves to (never on how the string
 * starts), by the policy's `allowUrl`.
 */
export function prepareRequest(plan: RequestPlan, allowUrl: (url: URL) => boolean): PreparedRequest {
  const url = resolveUrl(plan.endpoint);
  if (url === null) return { ok: false, message: `"${plan.endpoint}" is not an allowed URL.` };
  if (!allowUrl(url)) return { ok: false, message: `Requests to ${url.origin} are not allowed.` };

  const unusable: string[] = [];
  if (typeof plan.query === "object" && plan.query !== null && !Array.isArray(plan.query)) {
    for (const [name, value] of Object.entries(plan.query)) {
      const items: readonly unknown[] = Array.isArray(value) ? value : [value];
      if (!items.every((item) => item === null || item === undefined || isScalar(item))) {
        unusable.push(name);
        continue;
      }
      for (const item of items) if (isScalar(item)) url.searchParams.append(name, String(item));
    }
  }

  const init: { method: string; headers?: Record<string, string>; body?: string } = { method: plan.method };
  if (plan.body !== undefined && !NO_BODY.has(plan.method)) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(plan.body);
  }
  return { ok: true, url: url.href, init, unusable };
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
