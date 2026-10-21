// The regions that are lists rather than component tables: issue codes, the
// components documents cannot use, icon names and the class vocabulary.

import { NOT_ADDRESSABLE } from "../contracts";
import { ISSUE_CODE_INFO, ISSUE_CODES, RUNTIME_ISSUE_CODES } from "../spec/types";
import { cell } from "./components";

const byName = (a: string, b: string) => a.localeCompare(b);
const code = (text: string) => `\`${text}\``;

export function renderIssueCodes(): string {
  const runtime = new Set<string>(RUNTIME_ISSUE_CODES);
  const rows = ISSUE_CODES.map((name) => {
    const { severity, summary } = ISSUE_CODE_INFO[name];
    const when = runtime.has(name) ? " Reported only while rendering." : "";
    return `| ${code(name)} | ${severity} | ${cell(summary + when)} |`;
  });
  return ["| Code | Severity | Meaning |", "| --- | --- | --- |", ...rows].join("\n");
}

/** Never scoped: these are absent from the format, so a narrow reference needs the warning most. */
export function renderNotAddressable(): string {
  const rows = Object.entries(NOT_ADDRESSABLE)
    .sort(([a], [b]) => byName(a, b))
    .map(([name, { why }]) => `| ${code(name)} | ${cell(why)} |`);
  return ["| Component | Why not, and what to use instead |", "| --- | --- |", ...rows].join("\n");
}

export function renderIcons(icons: readonly string[]): string {
  if (icons.length === 0) return "_This icon set is empty: every icon name renders a missing-icon diagnostic._";
  return [...icons].sort(byName).map(code).join(" ");
}

/** One line per utility family (the class's first segment); single-member families share the last line. */
export function renderClasses(classes: readonly string[]): string {
  if (classes.length === 0) return "_The class vocabulary is empty: no class styles anything._";
  const families = new Map<string, string[]>();
  for (const name of [...classes].sort(byName)) {
    const family = name.split("-")[0] as string;
    families.set(family, [...(families.get(family) ?? []), name]);
  }
  const lines = [...families.values()].filter((names) => names.length > 1).map((names) => names.map(code).join(" "));
  const single = [...families.values()].filter((names) => names.length === 1).flat();
  if (single.length > 0) lines.push(single.map(code).join(" "));
  return lines.map((line) => `- ${line}`).join("\n");
}
