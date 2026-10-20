import { Skeleton } from "@batthewz/r-ui-react-components";
import { createElement, Fragment, isValidElement, type ReactNode } from "react";

import { contractFor, exclusionFor } from "../contracts";
import { DIAGNOSTIC_CLASSES } from "../diagnostics";
import { lookupComponent } from "../registry/registry";
import { isFormatMarker, isPlainObject, isRefMarker, nodeKind } from "../spec/guards";
import { appendPointer } from "../spec/pointer";
import { LIMITS } from "../spec/policy";
import { walkSegments } from "../spec/ref-path";
import { type ComponentContract, NAME_PATTERN, REF_ROOTS } from "../spec/types";
import { isPending } from "../stream/pending";
import { Icon } from "./builtins/Icon";
import { fieldSegments } from "./coerce";
import { evaluateCondition } from "./conditions";
import { issueOf, placeDiagnostic, reportIssue } from "./diagnostic";
import { STRUCTURAL_ELEMENTS, STRUCTURAL_PARENTS } from "./host-policy";
import { memoised, type Slot } from "./memo";
import { NodeBoundary } from "./NodeBoundary";
import { buildProps, iconElement } from "./props";
import { PropResolver } from "./resolve";
import { childScope, refScopeOf, type Scope } from "./scope";
import { readValue, valueText } from "./text";

const ROOT_SLOT: Slot = { boundary: true, structural: false };
const EMPTY_CONTRACT: ComponentContract = { category: "custom" };
const RESERVED: ReadonlySet<string> = new Set<string>(REF_ROOTS);

/**
 * A document node (untrusted, possibly still streaming) as React elements:
 * the library's own elements built directly, with no wrapper component or
 * wrapper DOM between a parent and the children it reads. `$each` yields an
 * array of keyed siblings. Never throws: a bad node renders a diagnostic in
 * place, or reports one where its context allows no element.
 */
export function renderNode(node: unknown, scope: Scope): ReactNode {
  return renderAt(node, scope, ROOT_SLOT);
}

/** `result` carrying `key` (an `$each` item), wrapped in a keyed fragment when it is not one element. */
function keyed(result: ReactNode, key: string | undefined): ReactNode {
  if (key === undefined || result === null || result === undefined || typeof result === "boolean") return result;
  if (isValidElement(result) && result.key === key) return result;
  return createElement(Fragment, { key }, result);
}

/** What a node still arriving shows: nothing, or a Skeleton when the view opts in. */
function pendingFallback(scope: Scope, slot: Slot): ReactNode {
  const { streaming } = scope.ctx;
  if (streaming.complete || streaming.fallback === "none" || slot.structural) return null;
  return createElement(Skeleton, { key: slot.key, className: DIAGNOSTIC_CLASSES.pending });
}

function renderAt(node: unknown, scope: Scope, slot: Slot): ReactNode {
  if (scope.depth > LIMITS.depth) {
    return placeDiagnostic(
      scope,
      issueOf("limit-exceeded", scope.path, `Nodes nest deeper than ${LIMITS.depth} levels; the rest is not rendered.`),
      slot.structural,
      slot.key,
    );
  }
  if (isPending(node) || node === undefined) return pendingFallback(scope, slot);
  if (typeof node === "string") return keyed(node, slot.key);
  if (!isPlainObject(node)) {
    return placeDiagnostic(scope, issueOf("invalid-node", scope.path, "Not a node: text or an object."), slot.structural, slot.key);
  }
  return memoised(node, scope, slot, () => {
    try {
      return renderObject(node, scope, slot);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return placeDiagnostic(scope, issueOf("render-error", scope.path, message), slot.structural, slot.key);
    }
  });
}

function renderObject(node: Record<string, unknown>, scope: Scope, slot: Slot): ReactNode {
  switch (nodeKind(node)) {
    case "component":
      if (typeof node.component === "string") return renderComponent(node, node.component, scope, slot);
      break;
    case "ref":
      if (isRefMarker(node)) return renderRef(node.$ref, scope, slot);
      break;
    case "format":
      if (isFormatMarker(node)) return keyed(new PropResolver(scope, renderAt).format(node, scope.path), slot.key);
      break;
    case "each":
      if (typeof node.$each === "string") return renderEach(node, node.$each, scope, slot);
      break;
    case "cond":
      return renderCond(node, scope, slot);
  }
  return placeDiagnostic(
    scope,
    issueOf("invalid-node", scope.path, "Not a node: a node has one of `component`, `$ref`, `$format`, `$each` or `$cond`."),
    slot.structural,
    slot.key,
  );
}

function renderRef(path: string, scope: Scope, slot: Slot): ReactNode {
  const value = readValue(path, refScopeOf(scope));
  const text = valueText(value);
  if (text !== null) return keyed(text, slot.key);
  if (value !== undefined && value !== null && value !== false) {
    reportIssue(scope, "not-renderable", scope.path, `\`${path}\` is not text or a number, so it renders nothing.`);
  }
  return null;
}

function renderEach(node: Record<string, unknown>, source: string, scope: Scope, slot: Slot): ReactNode {
  const alias = node.as;
  if (typeof alias !== "string" || !NAME_PATTERN.test(alias) || RESERVED.has(alias)) {
    return placeDiagnostic(scope, issueOf("invalid-name", appendPointer(scope.path, "as"), "`as` is a name that is not a scope root."), slot.structural, slot.key);
  }
  const items = readValue(source, refScopeOf(scope));
  if (!Array.isArray(items)) {
    if (items !== undefined && items !== null) {
      reportIssue(scope, "not-renderable", scope.path, `\`${source}\` is not an array, so the list renders nothing.`);
    }
    return null;
  }
  const keyPath = node.key === undefined ? null : fieldSegments(node.key);
  const seen = new Set<string>();
  const itemSlot = (index: number, item: unknown): Slot => {
    let key = `i${index}`;
    if (keyPath !== null) {
      const value = walkSegments(item, keyPath);
      if (typeof value === "string" || typeof value === "number") {
        const candidate = `k${String(value)}`;
        if (seen.has(candidate)) {
          reportIssue(scope, "duplicate-key", appendPointer(scope.path, "key"), `Two items share the key ${JSON.stringify(value)}; positions are used instead.`);
        } else {
          seen.add(candidate);
          key = candidate;
        }
      }
    }
    return { boundary: slot.boundary, structural: slot.structural, key };
  };
  const rendered = items.map((item: unknown, index) =>
    renderAt(node.node, childScope(scope, ["node"], { [alias]: item, [`${alias}Index`]: index }), itemSlot(index, item)),
  );
  return keyed(rendered, slot.key);
}

function renderCond(node: Record<string, unknown>, scope: Scope, slot: Slot): ReactNode {
  const branch = evaluateCondition(node.$cond, refScopeOf(scope)) ? "then" : "else";
  if (!Object.hasOwn(node, branch)) {
    return scope.ctx.streaming.pending.has(scope.path) ? pendingFallback(scope, slot) : null;
  }
  return renderAt(node[branch], childScope(scope, [branch]), slot);
}

function sensitiveAllowed(allow: boolean | readonly string[], name: string): boolean {
  return allow === true || (Array.isArray(allow) && allow.includes(name));
}

function renderComponent(node: Record<string, unknown>, name: string, scope: Scope, slot: Slot): ReactNode {
  const { ctx } = scope;
  const place = (code: "unknown-component" | "not-addressable" | "sensitive-component", message: string) =>
    placeDiagnostic(scope, issueOf(code, appendPointer(scope.path, "component"), message), slot.structural, slot.key);
  const Component = lookupComponent(ctx.registry, name);
  if (Component === undefined) {
    const exclusion = exclusionFor(name);
    return exclusion === undefined
      ? place("unknown-component", `No component is named "${name}".`)
      : place("not-addressable", `${name} is not available to documents: ${exclusion.why}`);
  }
  const contract = contractFor(ctx.contracts, name) ?? EMPTY_CONTRACT;
  if (contract.sensitive === true && !sensitiveAllowed(ctx.allowSensitive, name)) {
    return place("sensitive-component", `${name} renders only where the host allows it.`);
  }

  const built = buildProps(name, contract, node.props, scope, renderAt);
  if (built.failure !== undefined) return placeDiagnostic(scope, built.failure, slot.structural, slot.key);
  if (built.waiting) return pendingFallback(scope, slot);
  const { props } = built;
  if (Component === Icon) {
    const iconName = props.name;
    if (typeof iconName !== "string" || ctx.icons === undefined || !Object.hasOwn(ctx.icons, iconName)) {
      return keyed(iconElement(scope, String(iconName), appendPointer(appendPointer(scope.path, "props"), "name")), slot.key);
    }
  }

  const structural = STRUCTURAL_PARENTS.has(name) || (typeof props.as === "string" && STRUCTURAL_ELEMENTS.has(props.as));
  const children = renderChildren(node, contract, scope, structural);
  const all = built.leading.length > 0 ? [...built.leading, ...(children ?? [])] : children;
  const elementKey = slot.boundary ? undefined : slot.key;
  const element =
    all === undefined || all.length === 0
      ? createElement(Component, { ...props, key: elementKey })
      : createElement(Component, { ...props, key: elementKey }, ...all);
  if (!slot.boundary) return element;
  const pending = !ctx.streaming.complete && ctx.streaming.pending.has(scope.path);
  return createElement(
    NodeBoundary,
    {
      key: slot.key,
      path: scope.path,
      report: ctx.report,
      structural: slot.structural,
      pending: pending ? pendingFallback(scope, { ...slot, key: undefined }) : undefined,
    },
    element,
  );
}

/** The node's children, or undefined when it has none (a `children` prop then stands). */
function renderChildren(node: Record<string, unknown>, contract: ComponentContract, scope: Scope, structural: boolean): ReactNode[] | undefined {
  const { children } = node;
  if (children === undefined) return undefined;
  if (!Array.isArray(children)) {
    reportIssue(scope, "invalid-type", appendPointer(scope.path, "children"), "`children` is an array of nodes.");
    return undefined;
  }
  if (children.length === 0) return undefined;
  if (contract.textChildren === true) return [childrenText(children, scope)];
  const slot: Slot = { boundary: contract.childInspection === undefined, structural };
  return children.map((child: unknown, index) => renderAt(child, childScope(scope, ["children", index]), slot));
}

/** Children joined verbatim into the source text a parsing component (Markdown, Chip) takes. */
function childrenText(children: readonly unknown[], scope: Scope): string {
  return children.map((child: unknown, index) => nodeText(child, childScope(scope, ["children", index]))).join("");
}

function nodeText(node: unknown, scope: Scope): string {
  if (typeof node === "string") return node;
  if (scope.depth > LIMITS.depth || !isPlainObject(node)) return "";
  const refs = refScopeOf(scope);
  if (typeof node.$ref === "string") return valueText(readValue(node.$ref, refs)) ?? "";
  if (isFormatMarker(node)) return new PropResolver(scope, renderAt).format(node, scope.path);
  if (typeof node.$each === "string" && typeof node.as === "string") {
    const items = readValue(node.$each, refs);
    if (!Array.isArray(items)) return "";
    const alias = node.as;
    return items
      .map((item: unknown, index) => nodeText(node.node, childScope(scope, ["node"], { [alias]: item, [`${alias}Index`]: index })))
      .join("");
  }
  if (Object.hasOwn(node, "$cond")) {
    const branch = evaluateCondition(node.$cond, refs) ? "then" : "else";
    return nodeText(node[branch], childScope(scope, [branch]));
  }
  reportIssue(scope, "not-renderable", scope.path, "This component's children are text; a component here renders nothing.");
  return "";
}
