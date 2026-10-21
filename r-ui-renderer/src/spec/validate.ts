import { defaultContracts } from "../contracts";
import { isBlocking } from "./issue";
import type { ComponentContracts, HostPolicy, Issue, ValidationResult, ViewSpec } from "./types";
import { adviseDocument } from "./validate-advice";
import { findNonJson, parseText } from "./validate-json";
import { VIEWSPEC_SCHEMA } from "./validate-schema";
import { SchemaInterpreter } from "./validate-structure";
import { CLASS_VOCABULARY, ICON_NAMES } from "./vocabulary";

export interface ValidateOptions {
  /**
   * The host's origin (`"https://app.example"`), for the request and image
   * origin checks. Absent: only relative URLs count as same-origin.
   */
  readonly origin?: string;
  /** The host's policy, as the renderer is given it: its URL predicates and `allowSensitive`. */
  readonly policy?: HostPolicy;
  /** Warnings fail too: `ok` is false when there is any issue. */
  readonly strict?: boolean;
  /** The full contract set; `defaultContracts` when absent (extend it with `extendContracts`). */
  readonly contracts?: ComponentContracts;
  /** Names the host registers without a contract; they are known but unchecked. */
  readonly components?: readonly string[];
  /** Icon names the host's icon set has; the shipped set when absent. */
  readonly iconNames?: readonly string[];
  /** The class vocabulary; the shipped one when absent, `false` to skip `unknown-class`. */
  readonly classes?: readonly string[] | false;
}

const STRUCTURE = new SchemaInterpreter(VIEWSPEC_SCHEMA.$defs);

function parse(input: unknown): { value: unknown; issue?: undefined } | { value?: undefined; issue: Issue } {
  if (typeof input !== "string") {
    const notJson = findNonJson(input);
    return notJson === undefined ? { value: input } : { issue: notJson };
  }
  const parsed = parseText(input);
  if (parsed.issue !== undefined) return parsed;
  const tooDeep = findNonJson(parsed.value);
  return tooDeep === undefined ? parsed : { issue: tooDeep };
}

/**
 * Validates a document. A string is JSON text (a surrounding Markdown code
 * fence is stripped) and a parse failure is an `invalid-json` issue with its
 * line and column; anything else is the parsed value. Pure and React-free.
 *
 * Errors (conformance, exactly what `schema.json` and `./zod` decide) come
 * first, then warnings; `ok` is true when there is no error (with `strict`,
 * no issue), and `renderable` when no issue blocks rendering.
 */
export function validateViewSpec(input: unknown, options: ValidateOptions = {}): ValidationResult {
  const parsed = parse(input);
  if (parsed.issue !== undefined) return { ok: false, renderable: false, issues: [parsed.issue] };
  const { value } = parsed;

  const errors = STRUCTURE.validate(VIEWSPEC_SCHEMA, value, "");
  const warnings = adviseDocument(value, {
    contracts: options.contracts ?? defaultContracts,
    components: options.components ?? [],
    icons: options.iconNames ?? ICON_NAMES,
    classes: options.classes === false ? null : (options.classes ?? CLASS_VOCABULARY),
    policy: options.policy ?? {},
    origin: options.origin,
  });

  const issues = [...errors, ...warnings];
  const renderable = !issues.some(isBlocking);
  const ok = options.strict === true ? issues.length === 0 : errors.length === 0;
  return ok ? { ok, renderable, spec: value as ViewSpec, issues } : { ok, renderable, issues };
}
