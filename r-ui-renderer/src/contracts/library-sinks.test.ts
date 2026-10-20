// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { globSync } from "glob";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { URL_PROPS as UNIVERSAL_URL_PROPS } from "../spec/policy";
import type { ComponentContract, ComponentContracts } from "../spec/types";
import { type SinkClassification, SINK_FINDINGS } from "./curated/sink-findings";
import { defaultContracts, exclusionFor, LIBRARY_COMPONENTS } from "./index";

/**
 * The omission gate. A table of places to look for danger fails silently when
 * an entry was never written, so this reads the library's own source and
 * enumerates the sinks itself:
 * - a JSX attribute that becomes a URL (`href`, `src`, `srcSet`, `poster`,
 *   `action`, `formAction`, `cite`, `data`, any casing) given an expression,
 *   or such a key in an object spread onto an element, or a resource hint
 *   (`preload`, `preinit`, …);
 * - a heading element built by interpolation (`h${level}`);
 * - a read of a parent's children: `cloneElement`, `elementChildren`, an
 *   element's `.props`, or `.type` compared with a component.
 * Each finding must be classified in `SINK_FINDINGS`, and each classification
 * must hold in the assembled contracts.
 */

const URL_ATTRIBUTES = new Set(["href", "src", "srcset", "poster", "action", "formaction", "cite", "data"]);
const RESOURCE_HINTS = new Set(["preload", "preinit", "preloadModule", "preinitModule", "prefetchDNS", "preconnect"]);

interface Finding {
  readonly key: string;
  readonly at: string;
}

function scanSource(file: string, text: string): Finding[] {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const findings: Finding[] = [];
  const at = (node: ts.Node) => `${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`;
  const code = (node: ts.Node) => node.getText(source).replace(/\s+/g, " ");
  const add = (what: string, node: ts.Node) => findings.push({ key: `${file} ${what} ${code(node)}`, at: at(node) });
  const readsChildren = (node: ts.Node) => findings.push({ key: `${file} children`, at: `${at(node)} ${code(node).slice(0, 80)}` });
  const insideSpread = (node: ts.Node) => {
    for (let up = node.parent; up; up = up.parent) if (ts.isJsxSpreadAttribute(up)) return true;
    return false;
  };
  const named = (node: ts.PropertyName | ts.JsxAttributeName) => URL_ATTRIBUTES.has(node.getText(source).toLowerCase());

  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && named(node.name) && node.initializer && ts.isJsxExpression(node.initializer)) {
      add("url", node);
    } else if ((ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) && named(node.name) && insideSpread(node)) {
      add("url", node);
    } else if (ts.isCallExpression(node)) {
      const callee = ts.isIdentifier(node.expression)
        ? node.expression.text
        : ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : "";
      if (RESOURCE_HINTS.has(callee)) add("url", node);
      if (callee === "cloneElement" || callee === "elementChildren") readsChildren(node);
    } else if (ts.isTemplateExpression(node) && node.head.text === "h") {
      add("heading", node);
    } else if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
        node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken)
    ) {
      // An element's type against a component: comparing a data `type` field with a string is not one.
      const sides = [node.left, node.right];
      const readsType = sides.some((side) => ts.isPropertyAccessExpression(side) && side.name.text === "type");
      const component = sides.some((side) => ts.isIdentifier(side) && /^[A-Z]/.test(side.text));
      if (readsType && component) readsChildren(node);
    } else if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "props" &&
      node.expression.kind !== ts.SyntaxKind.ThisKeyword &&
      !(ts.isIdentifier(node.expression) && node.expression.text === "props")
    ) {
      // `child.props`: a component reading another element's props (its own are `this.props` or `props`).
      readsChildren(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
}

function libraryFindings(): Map<string, string[]> {
  const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json"));
  const root = join(dirname(dirname(require.resolve("@batthewz/r-ui-react-components/styles"))), "src");
  const files = globSync("**/*.{ts,tsx}", { cwd: root, ignore: ["**/*.test.*", "**/*.d.ts"] }).sort();
  const found = new Map<string, string[]>();
  for (const file of files) {
    for (const finding of scanSource(file.split("\\").join("/"), readFileSync(join(root, file), "utf8"))) {
      found.set(finding.key, [...(found.get(finding.key) ?? []), finding.at]);
    }
  }
  return found;
}

const universal = new Set<string>(UNIVERSAL_URL_PROPS);

/** What is wrong with one classification of one finding, or null when it holds. */
function classificationProblem(key: string, entry: SinkClassification, contracts: ComponentContracts): string | null {
  if ("library" in entry) return entry.library.trim() === "" ? `${key}: a library classification needs its reason` : null;
  if ("excluded" in entry) {
    if (!Object.hasOwn(LIBRARY_COMPONENTS, entry.excluded)) return `${key}: ${entry.excluded} is no library component`;
    return exclusionFor(entry.excluded) ? null : `${key}: ${entry.excluded} is addressable, not excluded`;
  }
  const contract = Object.hasOwn(contracts, entry.component) ? contracts[entry.component] : undefined;
  if (!contract) return `${key}: ${entry.component} is not addressable`;
  const dropped = contract.droppedProps ?? [];
  const kind = key.split(" ")[1];
  if (entry.prop !== undefined && dropped.includes(entry.prop)) return null;
  if (kind === "children") {
    if (entry.prop !== undefined) return `${key}: ${entry.component}.${entry.prop} opts into it but is not dropped`;
    return contract.childInspection ? null : `${key}: ${entry.component} reads its children but has no childInspection`;
  }
  if (entry.prop === undefined) return `${key}: name the prop of ${entry.component} that reaches it`;
  if (kind === "heading") {
    return Object.hasOwn(contract.headingLevelProps ?? {}, entry.prop)
      ? null
      : `${key}: ${entry.component}.${entry.prop} picks a heading but has no headingLevelProps entry`;
  }
  const routed =
    universal.has(entry.prop.toLowerCase()) ||
    (contract.urlProps ?? []).includes(entry.prop) ||
    (contract.imageProps ?? []).includes(entry.prop);
  return routed ? null : `${key}: ${entry.component}.${entry.prop} becomes a URL but no URL rule covers it`;
}

function auditFindings(
  found: ReadonlyMap<string, readonly string[]>,
  table: { readonly [key: string]: readonly SinkClassification[] },
  contracts: ComponentContracts,
): string[] {
  const problems: string[] = [];
  for (const [key, where] of found) {
    if (!Object.hasOwn(table, key)) problems.push(`unclassified: ${key}  (${where.join(", ")})`);
  }
  for (const [key, entries] of Object.entries(table)) {
    if (!found.has(key)) problems.push(`classifies nothing the scan finds: ${key}`);
    if (entries.length === 0) problems.push(`${key}: no classification`);
    for (const entry of entries) {
      const problem = classificationProblem(key, entry, contracts);
      if (problem) problems.push(problem);
    }
  }
  return problems;
}

describe("the library sink scan (omission gate)", () => {
  it("finds each sink shape in a fixture, and nothing in look-alikes", () => {
    const fixture = [
      "const a = <a href={item.link} />;",
      'const b = <a href="/static" title={x} />;',
      "const c = <img SRC={pic} />;",
      "const d = <div {...(ok ? { href: safe } : {})} />;",
      "preload(item.src, { as: 'image' });",
      "const H = `h${level}`;",
      "const path = `M${x}h${y}`;",
      "const k = cloneElement(child, extra);",
      "if (node.type === CardActions) {}",
      'if (part.type === "literal") {}',
      "const p = slide.props;",
      "const q = props.children; const r = this.props;",
    ].join("\n");
    expect(scanSource("x.tsx", fixture).map((f) => (f.key.endsWith(" children") ? f.at : f.key))).toEqual([
      "x.tsx url href={item.link}",
      "x.tsx url SRC={pic}",
      "x.tsx url href: safe",
      "x.tsx url preload(item.src, { as: 'image' })",
      "x.tsx heading `h${level}`",
      "x.tsx:8 cloneElement(child, extra)",
      "x.tsx:9 node.type === CardActions",
      "x.tsx:11 slide.props",
    ]);
  });

  it("goes red on an unclassified sink, a stale entry and a classification the contracts do not keep", () => {
    const found = new Map([
      ["components/aurora/Gauge.tsx url src={item.src}", ["Gauge.tsx:3"]],
      ["components/marketing/Testimonial.tsx url cite={sourceUrl}", ["Testimonial.tsx:9"]],
      ["components/marketing/Hero.tsx heading `h${headingLevel}`", ["Hero.tsx:4"]],
      ["components/primitives/Card.tsx children", ["Card.tsx:5"]],
      ["components/overlays/internal.tsx children", ["internal.tsx:2"]],
    ]);
    const bare = Object.assign(Object.create(null) as Record<string, ComponentContract>, {
      Testimonial: { category: "marketing" },
      Hero: { category: "marketing" },
      "Card.Header": { category: "primitives" },
      "Dialog.Trigger": { category: "overlays" },
    });
    expect(
      auditFindings(
        found,
        {
          "components/marketing/Testimonial.tsx url cite={sourceUrl}": [{ component: "Testimonial", prop: "sourceUrl" }],
          "components/marketing/Hero.tsx heading `h${headingLevel}`": [{ component: "Hero", prop: "headingLevel" }],
          "components/primitives/Card.tsx children": [{ component: "Card.Header" }],
          "components/overlays/internal.tsx children": [{ component: "Dialog.Trigger", prop: "asChild" }],
          "components/gone/Old.tsx url href={x}": [{ excluded: "Kanban" }],
        },
        bare,
      ),
    ).toEqual([
      "unclassified: components/aurora/Gauge.tsx url src={item.src}  (Gauge.tsx:3)",
      "components/marketing/Testimonial.tsx url cite={sourceUrl}: Testimonial.sourceUrl becomes a URL but no URL rule covers it",
      "components/marketing/Hero.tsx heading `h${headingLevel}`: Hero.headingLevel picks a heading but has no headingLevelProps entry",
      "components/primitives/Card.tsx children: Card.Header reads its children but has no childInspection",
      "components/overlays/internal.tsx children: Dialog.Trigger.asChild opts into it but is not dropped",
      "classifies nothing the scan finds: components/gone/Old.tsx url href={x}",
    ]);
  });

  it("finds every sink in the installed library classified, and every classification kept", () => {
    const found = libraryFindings();
    const kinds = new Set([...found.keys()].map((key) => key.split(" ")[1]));
    expect(kinds).toEqual(new Set(["url", "heading", "children"]));
    expect(found.size).toBeGreaterThan(50);
    expect(auditFindings(found, SINK_FINDINGS, defaultContracts)).toEqual([]);
  });
});
