import type { ComponentContracts, ValidationResult } from "./types";

export interface ValidateOptions {
  /**
   * The host's origin (`"https://app.example"`), for the request and image
   * origin checks. Absent: only relative URLs count as same-origin.
   */
  readonly origin?: string;
  /** The full contract set; `defaultContracts` when absent (extend it with `extendContracts`). */
  readonly contracts?: ComponentContracts;
  /** Names the host registers without a contract; they are known but unchecked. */
  readonly components?: readonly string[];
  /** Icon names the host's icon set has; the shipped set when absent. */
  readonly icons?: readonly string[];
  /** The class vocabulary; the shipped one when absent, `false` to skip `unknown-class`. */
  readonly classes?: readonly string[] | false;
  /** Mirrors the renderer's `allowSensitive`: allowed names raise no `sensitive-component`. */
  readonly allowSensitive?: boolean | readonly string[];
}

/**
 * Validates a document. A string is JSON text (a surrounding Markdown code
 * fence is stripped) and a parse failure is an `invalid-json` issue with its
 * line and column; anything else is the parsed value. Pure and React-free.
 */
export function validateViewSpec(input: unknown, options: ValidateOptions = {}): ValidationResult {
  throw new Error("not implemented");
}
