import { formatIssuesForModel } from "./format-issues";
import type { Issue } from "./types";
import { type ValidateOptions, validateViewSpec } from "./validate";

export interface ValidationHandlerOptions extends ValidateOptions {
  /** Request bodies over this many bytes get 413. 1 MiB when absent. */
  readonly maxBytes?: number;
}

/** The JSON body of a validation response (status 200, valid or not). */
export interface ValidationResponseBody {
  readonly ok: boolean;
  readonly issues: readonly Issue[];
  /** `formatIssuesForModel(issues)`, ready to hand back to the producer. */
  readonly feedback: string;
}

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function reply(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

/** The body as text, or null once it passes `maxBytes` (reading stops there). */
async function readCapped(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (request.body === null) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * A fetch-style handler: POST a document as the body, get a
 * `ValidationResponseBody`. 405 for other methods, 413 past `maxBytes`.
 */
export function createValidationHandler(options: ValidationHandlerOptions = {}): (request: Request) => Promise<Response> {
  const { maxBytes = 1024 * 1024, ...validateOptions } = options;
  return async (request) => {
    if (request.method !== "POST") return reply(405, { error: "POST a ViewSpec document as the request body." }, { allow: "POST" });
    const text = await readCapped(request, maxBytes);
    if (text === null) return reply(413, { error: `The document is over ${maxBytes} bytes.` });
    const result = validateViewSpec(text, validateOptions);
    const body: ValidationResponseBody = { ok: result.ok, issues: result.issues, feedback: formatIssuesForModel(result.issues) };
    return reply(200, body);
  };
}
