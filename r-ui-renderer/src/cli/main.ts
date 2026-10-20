import { defaultContracts, extendContracts } from "../contracts";
import { formatIssuesForModel } from "../spec/format-issues";
import { isPlainObject } from "../spec/guards";
import type { ComponentContract, ComponentContracts, Issue } from "../spec/types";
import { validateViewSpec } from "../spec/validate";

export const USAGE = `Usage: r-ui-validate [file | -] [options]
       r-ui-validate --raw '<json>' [options]
       <producer> | r-ui-validate [options]

Validates a ViewSpec document (format version 2). A surrounding Markdown code
fence is ignored. With no file and no --raw, reads standard input.

Options:
  --raw <json>         Validate this text instead of a file.
  --format <format>    text (default), json, or model (feedback for a producer).
  --contracts <file>   A JSON object of contracts to add (name -> contract).
  --origin <url>       The host's origin, for the request and image URL checks.
  --strict             Warnings fail too.
  -h, --help           Show this help.

Exit status: 0 valid, 1 not valid (or warnings with --strict), 2 usage or input
error, 3 internal error (a bug in r-ui-validate, not in the document).
`;

export const OUTPUT_FORMATS = ["text", "json", "model"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export interface CliArgs {
  readonly help: boolean;
  /** A file path, `-` for standard input, or undefined (standard input unless `raw`). */
  readonly file?: string;
  readonly raw?: string;
  readonly format: OutputFormat;
  readonly contracts?: string;
  readonly origin?: string;
  readonly strict: boolean;
}

export interface CliIO {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly readFile: (path: string) => Promise<string>;
  readonly readStdin: () => Promise<string>;
  readonly stdinIsTTY: boolean;
}

export class UsageError extends Error {}

/** The first line of the report when r-ui-validate itself fails (exit 3). */
export const INTERNAL_ERROR = "r-ui-validate failed internally; the document was not judged.\n";

const VALUE_FLAGS = new Set(["--raw", "--format", "--contracts", "--origin"]);

function isOutputFormat(value: string): value is OutputFormat {
  return OUTPUT_FORMATS.some((format) => format === value);
}

/** The arguments, or a UsageError naming what is wrong. */
export function parseArgs(argv: readonly string[]): CliArgs {
  let help = false;
  let strict = false;
  let format: OutputFormat = "text";
  let file: string | undefined;
  const values = new Map<string, string>();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    if (arg === "-h" || arg === "--help") help = true;
    else if (arg === "--strict") strict = true;
    else if (VALUE_FLAGS.has(arg)) {
      const value = argv[i + 1];
      if (value === undefined) throw new UsageError(`${arg} needs a value.`);
      if (values.has(arg)) throw new UsageError(`${arg} given twice.`);
      values.set(arg, value);
      i += 1;
    } else if (arg.startsWith("-") && arg !== "-") throw new UsageError(`Unknown option ${arg}.`);
    else if (file !== undefined) throw new UsageError("Give one file at most.");
    else file = arg;
  }

  const formatValue = values.get("--format");
  if (formatValue !== undefined) {
    if (!isOutputFormat(formatValue)) throw new UsageError(`--format must be one of ${OUTPUT_FORMATS.join(", ")}.`);
    format = formatValue;
  }
  const raw = values.get("--raw");
  if (raw !== undefined && file !== undefined) throw new UsageError("Give a file or --raw, not both.");
  const origin = values.get("--origin");
  if (origin !== undefined && !URL.canParse(origin)) throw new UsageError(`--origin must be a URL ("https://app.example"), not ${JSON.stringify(origin)}.`);

  return {
    help,
    file,
    raw,
    format,
    contracts: values.get("--contracts"),
    origin,
    strict,
  };
}

/** The JSON type each contract field holds, so a malformed file is an input error rather than a crash. */
const CONTRACT_FIELD_TYPES: { readonly [K in keyof Required<ComponentContract>]: "string" | "array" | "object" | "boolean" } = {
  category: "string",
  note: "string",
  props: "array",
  slots: "array",
  propEnums: "object",
  urlProps: "array",
  imageProps: "array",
  dateProps: "object",
  iconProps: "array",
  nodeProps: "array",
  templateProps: "object",
  setProps: "array",
  formatProps: "array",
  eventValue: "object",
  coercions: "object",
  childInspection: "string",
  elementProps: "object",
  headingLevelProps: "object",
  sensitive: "boolean",
  textChildren: "boolean",
  dialog: "boolean",
  fieldName: "boolean",
  formProps: "array",
  namespacedProps: "array",
  intlProps: "object",
  droppedProps: "array",
  nativeAttributes: "boolean",
};

function jsonType(value: unknown): string {
  if (Array.isArray(value)) return "array";
  return isPlainObject(value) ? "object" : typeof value;
}

async function readContracts(path: string, io: CliIO): Promise<ComponentContracts> {
  const parsed: unknown = JSON.parse(await io.readFile(path));
  if (!isPlainObject(parsed) || !Object.values(parsed).every(isPlainObject)) {
    throw new UsageError(`${path} must be a JSON object of contracts (name -> contract object).`);
  }
  for (const [name, contract] of Object.entries(parsed as Record<string, Record<string, unknown>>)) {
    for (const [field, value] of Object.entries(contract)) {
      const expected = Object.hasOwn(CONTRACT_FIELD_TYPES, field) ? CONTRACT_FIELD_TYPES[field as keyof ComponentContract] : undefined;
      if (expected === undefined) throw new UsageError(`${path}: ${name}.${field} is not a contract field.`);
      if (jsonType(value) !== expected) throw new UsageError(`${path}: ${name}.${field} must be ${expected === "array" ? "an" : "a"} ${expected}.`);
    }
    const props: unknown = contract.props;
    if (Array.isArray(props) && !props.every((prop) => isPlainObject(prop) && typeof prop.name === "string")) {
      throw new UsageError(`${path}: ${name}.props must list objects with a \`name\`.`);
    }
  }
  return extendContracts(defaultContracts, parsed as { readonly [name: string]: Partial<ComponentContract> });
}

function formatText(issues: readonly Issue[]): string {
  if (issues.length === 0) return "valid: no issues\n";
  const lines = issues.map((issue) => {
    const at = issue.path === "" ? "(document)" : issue.path;
    const where = issue.line === undefined ? "" : ` (line ${issue.line}, column ${issue.column ?? 1})`;
    const hint = issue.suggestion === undefined ? "" : `\n    ${issue.suggestion}`;
    return `${issue.severity}  ${at}${where}  ${issue.code}: ${issue.message}${hint}`;
  });
  const errors = issues.filter((issue) => issue.severity === "error").length;
  return `${lines.join("\n")}\n${errors} error(s), ${issues.length - errors} warning(s)\n`;
}

/** Runs the CLI and returns its exit status. */
export async function main(argv: readonly string[], io: CliIO): Promise<number> {
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    io.stderr(`${error.message}\n\n${USAGE}`);
    return 2;
  }
  if (args.help) {
    io.stdout(USAGE);
    return 0;
  }

  let text: string;
  let contracts: ComponentContracts | undefined;
  try {
    if (args.raw !== undefined) text = args.raw;
    else if (args.file !== undefined && args.file !== "-") text = await io.readFile(args.file);
    else if (io.stdinIsTTY && args.file === undefined) throw new UsageError("No document: give a file, --raw, or pipe one in.");
    else text = await io.readStdin();
    contracts = args.contracts === undefined ? undefined : await readContracts(args.contracts, io);
  } catch (error) {
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }

  let output: string;
  let failed: boolean;
  try {
    const result = validateViewSpec(text, { contracts, origin: args.origin });
    failed = !result.ok || (args.strict && result.issues.length > 0);
    if (args.format === "json") output = `${JSON.stringify({ ok: result.ok, issues: result.issues }, null, 2)}\n`;
    else if (args.format === "model") output = `${formatIssuesForModel(result.issues)}\n`;
    else output = formatText(result.issues);
  } catch (error) {
    io.stderr(`${INTERNAL_ERROR}${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    return 3;
  }

  io.stdout(output);
  return failed ? 1 : 0;
}
