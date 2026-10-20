import type { ValidateOptions } from "./validate";
import type { Issue } from "./types";

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

/**
 * A fetch-style handler: POST a document as the body, get a
 * `ValidationResponseBody`. 405 for other methods, 413 past `maxBytes`.
 */
export function createValidationHandler(options: ValidationHandlerOptions = {}): (request: Request) => Promise<Response> {
  throw new Error("not implemented");
}
