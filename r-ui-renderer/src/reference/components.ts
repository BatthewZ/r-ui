// The component tables: one section per category, a row per addressable name,
// props as a document writes them, and the `classNames` keys.

import propDocs from "../contracts/generated/prop-docs.json";
import { dropReason, nameRole, refPropKinds } from "../spec/contract-facts";
import type { ComponentContract, ComponentContracts, PropDoc } from "../spec/types";
import { CATEGORY_TITLES } from "./categories";

export interface ComponentTableOptions {
  /** Props listed per row before "+n more"; `false` lists every one. */
  readonly propLimit: number | false;
  /** Each prop's one-sentence description beside it. */
  readonly describeProps: boolean;
}

const PROP_DOCS: { readonly [name: string]: readonly { readonly name: string; readonly description: string }[] } = propDocs;

const DATE_KIND_TEXT = { date: "ISO date", datetime: "ISO date-time", dateRange: "{ start, end } of ISO dates" } as const;
const INTL_TEXT = { currency: "ISO 4217 code", unit: "Intl unit" } as const;
const TYPE_TEXT_LIMIT = 72;

const byName = (a: string, b: string) => a.localeCompare(b);

/** Text safe inside a Markdown table cell. */
export function cell(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\|/g, "\\|");
}

const listValues = (values: readonly (string | number | boolean)[]) =>
  values.map((value) => (typeof value === "string" ? JSON.stringify(value) : String(value))).join(" | ");

function declaredType(type: string): string {
  const text = type
    .replace(/\s+/g, " ")
    .replace(/\breadonly /g, "")
    .trim();
  return text.length > TYPE_TEXT_LIMIT ? `${text.slice(0, TYPE_TEXT_LIMIT - 1)}…` : text;
}

/**
 * Whether a document can set `prop` at all: the renderer does not drop it
 * (`dropReason`, the rule the renderer and the validator read) and it is not
 * a ref that takes nothing JSON holds.
 */
export function isDocumentProp(contract: ComponentContract, prop: string): boolean {
  if (dropReason(contract, prop) !== undefined) return false;
  if (contract.formProps?.includes(prop)) return true;
  return refPropKinds(contract, prop)?.length !== 0;
}

/** What a document writes for `prop`, which is not always what the library declares. */
export function documentType(contract: ComponentContract, prop: PropDoc): string {
  const { name } = prop;
  if (/^on[A-Z]/.test(name)) return "handler";
  if (contract.formProps?.includes(name)) return "form name";
  if (name === "name" && nameRole(contract) === "field") return "field name";
  const refKinds = refPropKinds(contract, name);
  if (refKinds) return refKinds.join(" | ");
  const template = contract.templateProps?.[name];
  if (template) return `template (${template.join(", ")})`;
  if (contract.formatProps?.includes(name)) return "FormatSpec";
  if (contract.iconProps?.includes(name)) return "icon name";
  const date = contract.dateProps?.[name];
  if (date) return DATE_KIND_TEXT[date];
  if (contract.setProps?.includes(name)) return declaredType(prop.type.replace(/\b(?:Readonly)?Set<([^<>]+)>/g, "$1[]"));
  const allowed = contract.elementProps?.[name] ?? contract.headingLevelProps?.[name] ?? contract.propEnums?.[name];
  if (allowed) return listValues(allowed);
  const intl = contract.intlProps?.[name];
  if (intl) return INTL_TEXT[intl];
  if (contract.nodeProps?.includes(name)) return "node";
  return declaredType(prop.type);
}

function descriptionOf(name: string, prop: PropDoc): string | undefined {
  return prop.description ?? PROP_DOCS[name]?.find((doc) => doc.name === prop.name)?.description;
}

function propsCell(name: string, contract: ComponentContract, options: ComponentTableOptions): string {
  const props = (contract.props ?? [])
    .filter((prop) => isDocumentProp(contract, prop.name))
    .sort((a, b) => Number(b.required) - Number(a.required) || byName(a.name, b.name));
  if (props.length === 0) return "—";
  const shown = options.propLimit === false ? props : props.slice(0, options.propLimit);
  const rendered = shown.map((prop) => {
    const text = `\`${prop.name}${prop.required ? "" : "?"}\`: ${documentType(contract, prop)}`;
    const description = options.describeProps ? descriptionOf(name, prop) : undefined;
    return cell(description === undefined ? text : `${text} — ${description}`);
  });
  const hidden = props.length - shown.length;
  if (hidden > 0) rendered.push(`+${hidden} more`);
  return rendered.join(options.describeProps ? "<br>" : " · ");
}

/** The direct parts of `name` that `contracts` holds (`"Card"` → `["Header", "Title"]`). */
function directParts(contracts: ComponentContracts, name: string): string[] {
  const prefix = `${name}.`;
  return Object.keys(contracts)
    .filter((key) => key.startsWith(prefix) && !key.slice(prefix.length).includes("."))
    .map((key) => key.slice(prefix.length))
    .sort(byName);
}

/** The outermost name present in `contracts` that `name` belongs to (itself when its root is absent). */
function ownerOf(contracts: ComponentContracts, name: string): string {
  const segments = name.split(".");
  for (let end = 1; end < segments.length; end += 1) {
    const candidate = segments.slice(0, end).join(".");
    if (Object.hasOwn(contracts, candidate)) return candidate;
  }
  return name;
}

function row(contracts: ComponentContracts, name: string, options: ComponentTableOptions): string {
  const contract = contracts[name] as ComponentContract;
  const parts = directParts(contracts, name);
  return `| \`${name}\` | ${parts.length > 0 ? parts.map((part) => `\`.${part}\``).join(" ") : "—"} | ${propsCell(name, contract, options)} | ${cell(contract.note ?? "")} |`;
}

/** Category sections, each a table with every component followed by its parts. */
export function renderComponentTables(contracts: ComponentContracts, options: ComponentTableOptions): string {
  const groups = new Map<string, string[]>();
  for (const name of Object.keys(contracts).sort(byName)) {
    const owner = ownerOf(contracts, name);
    const category = (contracts[owner] as ComponentContract).category;
    groups.set(category, [...(groups.get(category) ?? []), name]);
  }
  const known = Object.keys(CATEGORY_TITLES).filter((category) => groups.has(category));
  const others = [...groups.keys()].filter((category) => !Object.hasOwn(CATEGORY_TITLES, category)).sort(byName);
  const sections = [...known, ...others].map((category) => {
    // Sorted by owner, then the owner before its parts.
    const names = (groups.get(category) as string[]).sort(
      (a, b) => byName(ownerOf(contracts, a), ownerOf(contracts, b)) || byName(a, b),
    );
    return [
      `### ${CATEGORY_TITLES[category] ?? category}`,
      "",
      "| Component | Parts | Props | Notes |",
      "| --- | --- | --- | --- |",
      ...names.map((name) => row(contracts, name, options)),
    ].join("\n");
  });
  return sections.join("\n\n");
}

/** Every component's `classNames` keys, or a sentence saying none takes any. */
export function renderSlotTable(contracts: ComponentContracts): string {
  const rows = Object.keys(contracts)
    .sort(byName)
    .flatMap((name) => {
      const slots = contracts[name]?.slots ?? [];
      return slots.length > 0 ? [`| \`${name}\` | ${slots.map((slot) => `\`${slot}\``).join(" ")} |`] : [];
    });
  const heading = "### `classNames` keys";
  if (rows.length === 0) return `${heading}\n\n_No component in this reference takes \`classNames\`._`;
  return [heading, "", "| Component | Keys |", "| --- | --- |", ...rows].join("\n");
}
