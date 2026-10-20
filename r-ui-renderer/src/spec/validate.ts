import { defaultContracts } from "../contracts";
import type { ComponentContracts, Issue, ValidationResult, ViewSpec } from "./types";
import { adviseDocument } from "./validate-advice";
import { findNonJson, parseText } from "./validate-json";
import { VIEWSPEC_SCHEMA } from "./validate-schema";
import { makeIssue } from "./issue";
import { SchemaInterpreter } from "./validate-structure";
import { CLASS_VOCABULARY, ICON_NAMES } from "./vocabulary";

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

const STRUCTURE = new SchemaInterpreter(VIEWSPEC_SCHEMA.$defs);

/**
 * Validates a document. A string is JSON text (a surrounding Markdown code
 * fence is stripped) and a parse failure is an `invalid-json` issue with its
 * line and column; anything else is the parsed value. Pure and React-free.
 *
 * Errors (conformance, exactly what `schema.json` and `./zod` decide) come
 * first, then warnings; `ok` is true when there is no error.
 */
export function validateViewSpec(input: unknown, options: ValidateOptions = {}): ValidationResult {
  let value: unknown;
  if (typeof input === "string") {
    const parsed = parseText(input);
    if (parsed.issue !== undefined) return { ok: false, issues: [parsed.issue] };
    value = parsed.value;
  } else {
    const notJson = findNonJson(input);
    if (notJson !== undefined) return { ok: false, issues: [notJson] };
    value = input;
  }

  let errors: Issue[];
  let warnings: Issue[];
  try {
    errors = STRUCTURE.validate(VIEWSPEC_SCHEMA, value, "");
    warnings = adviseDocument(value, {
      contracts: options.contracts ?? defaultContracts,
      components: options.components ?? [],
      icons: options.icons ?? ICON_NAMES,
      classes: options.classes === false ? null : (options.classes ?? CLASS_VOCABULARY),
      allowSensitive: options.allowSensitive ?? false,
      origin: options.origin,
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    // The call stack ran out: nesting far past any limit the format sets.
    return { ok: false, issues: [makeIssue("too-deep", "", "Nested too deep to check (thousands of levels); the renderer stops at 50 nodes.")] };
  }

  const issues = [...errors, ...warnings];
  return errors.length === 0 ? { ok: true, spec: value as ViewSpec, issues } : { ok: false, issues };
}
