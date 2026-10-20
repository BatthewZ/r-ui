/**
 * The warning tier: everything that needs the contracts, the registry, the
 * vocabularies, scope or a cross-reference. A warning means the document
 * conforms but something will be dropped, refused or will not work. Every
 * place a node can appear is walked (children, `$each`/`$cond` branches,
 * `$node` in props at any depth, row templates with their names in scope),
 * and every check here is defensive: it also runs on documents that failed
 * the structural check, and skips what that check already reported.
 */

import { contractFor, DECLARED_PATHS, exclusionFor, LIBRARY_COMPONENTS } from "../contracts";
import { nameRole, refPropKinds } from "./contract-facts";
import { makeIssue } from "./issue";
import { isFormatMarker, isHandler, isName, isNodeMarker, isPlainObject, isRefMarker, nodeKind } from "./guards";
import {
  CONSTRAINED_DATA_ATTRIBUTES,
  DATA_ATTRIBUTE_PATTERN,
  IMAGE_URL_PROPS,
  isAllowedDataAttribute,
  isAllowedDataValue,
  isForbiddenProp,
  isIdReferenceProp,
  LIMITS,
  lowerCaseProp,
  URL_PROPS,
} from "./policy";
import { appendPointer } from "./pointer";
import { parseRefPath } from "./ref-path";
import {
  COMPARISON_OPERATORS,
  COMPONENT_NODE_KEYS,
  COND_NODE_KEYS,
  type ComponentContract,
  type ComponentContracts,
  DOCUMENT_KEYS,
  EACH_NODE_KEYS,
  FIELD_TYPES,
  type FieldType,
  HANDLER_KEY_PATTERN,
  type Issue,
  type IssueCode,
  type PropPath,
  REF_ROOTS,
} from "./types";
import { defaultAllowImageUrl, defaultAllowUrl, NO_LOCATION_BASE, resolveUrl, safeUrl, srcSetUrls } from "./url-policy";
import { isNativeAttribute } from "./validate-attributes";
import { ADVISORY_DEFS, FORM_STATE_KEYS } from "./validate-schema";
import { SchemaInterpreter } from "./validate-structure";
import { closest } from "./validate-suggest";
import { ISO_SHAPED, isIsoDate, isIsoDateTime } from "./dates";
import { valuesAt } from "./prop-path";
import { digitsAccepted, isCurrencyCode, isIntlUnit } from "./validate-values";

/**
 * Components that throw or misbehave outside a given ancestor, beyond the
 * compound parts (which belong inside their root). Gated: every name is a
 * contract name.
 */
export const PLACEMENT: { readonly [name: string]: readonly string[] } = {
  Radio: ["RadioGroup"],
  ErrorSummary: ["Form", "Wizard"],
};

/** Props listing a form's field names, checked against the enclosing form. Gated like PLACEMENT. */
export const FIELD_LIST_PROPS: { readonly [name: string]: readonly string[] } = {
  "Wizard.Step": ["fields"],
};

/** Props that fix a control's value, which detaches a Field binding. */
const CONTROLLED_PROPS = new Set(["value", "checked", "defaultValue", "defaultChecked"]);

export interface AdviceOptions {
  readonly contracts: ComponentContracts;
  readonly components: readonly string[];
  readonly icons: readonly string[];
  readonly classes: readonly string[] | null;
  readonly allowSensitive: boolean | readonly string[];
  readonly origin?: string;
}

interface Scope {
  /** `$each` aliases (and their `Index` names) and template names in reach. */
  readonly vars: ReadonlySet<string>;
  readonly depth: number;
  /** Enclosing component names, innermost last. */
  readonly ancestors: readonly string[];
  /** The enclosing form: undefined outside any, null when its name is not a literal declared one. */
  readonly form: string | null | undefined;
  /** Inside a Field bound by `name`. */
  readonly boundField: boolean;
  readonly inHandler: boolean;
}

const ROOT_SCOPE: Scope = { vars: new Set(), depth: 0, ancestors: [], form: undefined, boundField: false, inHandler: false };

const URL_NAMES: ReadonlySet<string> = new Set(URL_PROPS);
const IMAGE_NAMES: ReadonlySet<string> = new Set(IMAGE_URL_PROPS);
const ADVISORY = new SchemaInterpreter(ADVISORY_DEFS);
const STATE_ROOT = "state";

function isMarker(value: unknown): boolean {
  return isRefMarker(value) || isNodeMarker(value) || isFormatMarker(value);
}

const quote = (value: unknown) => JSON.stringify(value);
const list = (items: readonly unknown[]) => items.map((item) => `\`${String(item)}\``).join(", ");

class Advisor {
  readonly issues: Issue[] = [];
  private readonly seen = new Set<string>();
  private readonly known: ReadonlySet<string>;
  private readonly icons: ReadonlySet<string>;
  private readonly classes: ReadonlySet<string> | null;
  private readonly base: string;
  private readonly data = new Set<string>();
  private readonly forms = new Map<string, ReadonlySet<string>>();
  private readonly state = new Set<string>();
  private readonly dialogs = new Set<string>();

  constructor(private readonly options: AdviceOptions) {
    this.known = new Set([...Object.keys(options.contracts), ...options.components]);
    this.icons = new Set(options.icons);
    this.classes = options.classes === null ? null : new Set(options.classes);
    this.base = originBase(options.origin);
  }

  private warn(code: IssueCode, path: string, message: string, suggestion?: string): void {
    const key = `${code}\u0000${path}\u0000${message}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.issues.push(makeIssue(code, path, message, suggestion));
  }

  // -------------------------------------------------------------------------
  // The document

  run(doc: unknown): void {
    if (!isPlainObject(doc)) return;
    this.declare(doc);
    this.keyOrder(doc, DOCUMENT_KEYS, "", "Write the document's keys in this order, `root` last");
    if (isPlainObject(doc.data)) {
      for (const [name, binding] of Object.entries(doc.data)) this.binding(binding, appendPointer("/data", name));
    }
    if (isPlainObject(doc.forms)) {
      for (const [name, def] of Object.entries(doc.forms)) this.form(def, appendPointer("/forms", name));
    }
    if (doc.root !== undefined) this.node(doc.root, "/root", ROOT_SCOPE);
  }

  /** What the document declares, before any reference to it is judged. */
  private declare(doc: Record<string, unknown>): void {
    if (isPlainObject(doc.data)) for (const name of Object.keys(doc.data)) this.data.add(name);
    if (isPlainObject(doc.state)) for (const name of Object.keys(doc.state)) this.state.add(name);
    if (isPlainObject(doc.forms)) {
      for (const [name, def] of Object.entries(doc.forms)) {
        this.forms.set(name, new Set(isPlainObject(def) && isPlainObject(def.fields) ? Object.keys(def.fields) : []));
      }
    }
    // Every state key a handler writes, and every dialog id a dialog component carries, wherever they sit.
    const stack: unknown[] = [doc];
    const visited = new Set<object>();
    while (stack.length > 0) {
      const value = stack.pop();
      if (typeof value !== "object" || value === null || visited.has(value)) continue;
      visited.add(value);
      if (Array.isArray(value)) {
        stack.push(...(value as unknown[]));
        continue;
      }
      const record = value as Record<string, unknown>;
      if (isPlainObject(record.payload) && (record.action === "setState" || record.action === "apiCall")) {
        const target = record.action === "setState" ? record.payload.path : record.payload.into;
        const parsed = typeof target === "string" ? parseRefPath(target) : null;
        if (parsed?.root === STATE_ROOT && parsed.segments[0] !== undefined) this.state.add(parsed.segments[0]);
      }
      if (typeof record.component === "string" && isPlainObject(record.props) && typeof record.props.dialogId === "string") {
        if (contractFor(this.options.contracts, record.component)?.dialog) this.dialogs.add(record.props.dialogId);
      }
      stack.push(...Object.values(record));
    }
  }

  private keyOrder(value: Record<string, unknown>, order: readonly string[], path: string, what: string): void {
    const positions = Object.keys(value)
      .map((key) => order.indexOf(key))
      .filter((position) => position !== -1);
    if (positions.every((position, index) => index === 0 || (positions[index - 1] as number) <= position)) return;
    this.warn("key-order", path, `${what}: ${list(order)}. Out of order, it renders only once it has closed.`);
  }

  private binding(binding: unknown, path: string): void {
    if (!isPlainObject(binding)) return;
    if (binding.type === "api" && typeof binding.endpoint === "string") this.endpoint(binding.endpoint, appendPointer(path, "endpoint"));
    const stateOnly: Scope = { ...ROOT_SCOPE, inHandler: false };
    for (const key of ["query", "body", "params"]) {
      if (binding[key] !== undefined) this.value(binding[key], appendPointer(path, key), stateOnly, { stateOnly: true });
    }
  }

  private form(def: unknown, path: string): void {
    if (!isPlainObject(def)) return;
    if (isPlainObject(def.fields)) {
      for (const [name, field] of Object.entries(def.fields)) this.field(field, appendPointer(appendPointer(path, "fields"), name));
    }
    for (const key of ["onSubmit", "onInvalid"]) {
      if (isHandler(def[key])) this.handler(def[key], appendPointer(path, key), { ...ROOT_SCOPE, inHandler: true }, 0);
    }
  }

  private field(field: unknown, path: string): void {
    if (!isPlainObject(field)) return;
    const type: FieldType = FIELD_TYPES.find((name) => name === field.type) ?? "text";
    const rules = isPlainObject(field.rules) ? field.rules : {};
    const rulesPath = appendPointer(path, "rules");
    const lengthy = type === "text" || type === "list";
    const dated = type === "date" || type === "dateRange";
    for (const rule of ["minLength", "maxLength"]) {
      if (rules[rule] !== undefined && !lengthy) {
        this.warn("unusable-value", appendPointer(rulesPath, rule), `\`${rule}\` applies to text and list fields; this is a ${type} field.`);
      }
    }
    if (typeof rules.pattern === "string") {
      if (type !== "text") this.warn("unusable-value", appendPointer(rulesPath, "pattern"), `\`pattern\` applies to text fields; this is a ${type} field.`);
      else if (!compiles(rules.pattern)) this.warn("unusable-value", appendPointer(rulesPath, "pattern"), "Not a regular expression JavaScript can compile.");
    }
    for (const rule of ["min", "max"]) {
      const bound = rules[rule];
      if (bound === undefined) continue;
      const at = appendPointer(rulesPath, rule);
      if (type === "number" && typeof bound !== "number") this.warn("unusable-value", at, `A number field's \`${rule}\` is a number.`);
      else if (dated && (typeof bound !== "string" || !isIsoDate(bound))) this.warn("unusable-value", at, `A date field's \`${rule}\` is an ISO date ("2026-11-02").`);
      else if (type !== "number" && !dated) this.warn("unusable-value", at, `\`${rule}\` applies to number and date fields; this is a ${type} field.`);
    }
    const initial = field.initialValue;
    const at = appendPointer(path, "initialValue");
    if (isRefMarker(initial)) this.ref(initial.$ref, appendPointer(at, "$ref"), ROOT_SCOPE);
    else if (initial !== undefined && !fitsField(type, initial)) {
      this.warn("unusable-value", at, `Not a ${type} field's value (${FIELD_VALUE_WORDS[type]}).`);
    }
  }

  // -------------------------------------------------------------------------
  // Nodes

  private node(node: unknown, path: string, scope: Scope): void {
    if (scope.depth > LIMITS.depth) {
      this.warn("limit-exceeded", path, `Nested deeper than ${LIMITS.depth} nodes; the renderer shows a diagnostic here instead.`);
      return;
    }
    if (!isPlainObject(node)) return;
    switch (nodeKind(node)) {
      case "component":
        this.keyOrder(node, COMPONENT_NODE_KEYS, path, "Write a component node's keys in this order");
        this.component(node, path, scope);
        return;
      case "ref":
        if (typeof node.$ref === "string") this.ref(node.$ref, appendPointer(path, "$ref"), scope);
        return;
      case "format":
        this.format(node.$format, appendPointer(path, "$format"), scope);
        return;
      case "each": {
        this.keyOrder(node, EACH_NODE_KEYS, path, "Write a `$each` node's keys in this order");
        if (typeof node.$each === "string") this.ref(node.$each, appendPointer(path, "$each"), scope);
        const alias = isName(node.as) ? node.as : undefined;
        const vars = alias === undefined ? scope.vars : new Set([...scope.vars, alias, `${alias}Index`]);
        this.node(node.node, appendPointer(path, "node"), { ...scope, vars, depth: scope.depth + 1 });
        return;
      }
      case "cond":
        this.keyOrder(node, COND_NODE_KEYS, path, "Write a `$cond` node's keys in this order");
        this.condition(node.$cond, appendPointer(path, "$cond"), scope);
        for (const branch of ["then", "else"]) {
          if (node[branch] !== undefined) this.node(node[branch], appendPointer(path, branch), { ...scope, depth: scope.depth + 1 });
        }
        return;
      default:
        return;
    }
  }

  private component(node: Record<string, unknown>, path: string, scope: Scope): void {
    const name = node.component;
    if (typeof name !== "string") return;
    const contract = contractFor(this.options.contracts, name);
    const at = appendPointer(path, "component");
    const props = isPlainObject(node.props) ? node.props : undefined;

    if (!this.known.has(name)) this.unknownComponent(name, at);
    else this.placement(name, contract, at, scope);
    if (contract?.sensitive && !this.sensitiveAllowed(name)) {
      this.warn("sensitive-component", at, `${name} asks for a secret and renders only where the host allows it (\`allowSensitive\`).`);
    }

    const inner = this.innerScope(name, contract, props, path, scope);
    if (props !== undefined) this.props(name, contract, props, appendPointer(path, "props"), scope, inner);
    if (Array.isArray(node.children)) {
      const children = appendPointer(path, "children");
      node.children.forEach((child: unknown, index) => this.node(child, appendPointer(children, index), inner));
    }
  }

  private unknownComponent(name: string, at: string): void {
    const exclusion = Object.hasOwn(LIBRARY_COMPONENTS, name) ? exclusionFor(name) : undefined;
    if (exclusion !== undefined) {
      this.warn("not-addressable", at, `${name} is not available to documents: ${exclusion.why}`);
      return;
    }
    const isPart = name.includes(".");
    const candidates = [...this.known].filter((known) => known.includes(".") === isPart);
    const suggestion = closest(name, candidates);
    this.warn("unknown-component", at, `No component is registered as \`${name}\`.`, suggestion === undefined ? undefined : quote(suggestion));
  }

  private placement(name: string, contract: ComponentContract | undefined, at: string, scope: Scope): void {
    const dot = name.indexOf(".");
    if (dot !== -1) {
      const root = name.slice(0, dot);
      if (this.known.has(root) && !scope.ancestors.includes(root)) {
        this.warn("misplaced-part", at, `\`${name}\` belongs inside a \`${root}\`.`);
      }
    }
    const parents = Object.hasOwn(PLACEMENT, name) ? PLACEMENT[name] : undefined;
    if (parents !== undefined && !parents.some((parent) => scope.ancestors.includes(parent))) {
      this.warn("misplaced-part", at, `\`${name}\` works only inside ${parents.map((parent) => `a \`${parent}\``).join(" or ")}.`);
    }
    if ((contract?.formProps?.length ?? 0) > 0 && scope.form !== undefined) {
      this.warn("misplaced-part", at, "Forms do not nest: this sits inside another Form or Wizard.");
    }
  }

  private sensitiveAllowed(name: string): boolean {
    const allowed = this.options.allowSensitive;
    return allowed === true || (Array.isArray(allowed) && allowed.includes(name));
  }

  /** The scope a component's children and its props' nodes see. */
  private innerScope(
    name: string,
    contract: ComponentContract | undefined,
    props: Record<string, unknown> | undefined,
    path: string,
    scope: Scope,
  ): Scope {
    let form = scope.form;
    let boundField = scope.boundField;
    for (const prop of contract?.formProps ?? []) {
      const value = props?.[prop];
      form = typeof value === "string" && this.forms.has(value) ? value : null;
    }
    if (nameRole(contract) === "field" && typeof props?.name === "string") {
      boundField = true;
      this.fieldBinding(props.name, appendPointer(appendPointer(path, "props"), "name"), scope.form);
    }
    const fieldLists = Object.hasOwn(FIELD_LIST_PROPS, name) ? FIELD_LIST_PROPS[name] : undefined;
    for (const prop of fieldLists ?? []) {
      const names = props?.[prop];
      if (!Array.isArray(names)) continue;
      const at = appendPointer(appendPointer(path, "props"), prop);
      names.forEach((field: unknown, index) => {
        if (typeof field === "string") this.fieldBinding(field, appendPointer(at, index), scope.form);
      });
    }
    return { ...scope, form, boundField, depth: scope.depth + 1, ancestors: [...scope.ancestors, name] };
  }

  private fieldBinding(field: string, at: string, form: string | null | undefined): void {
    if (form === null) return;
    if (form === undefined) {
      this.warn("undeclared-name", at, `Field \`${field}\` binds to no form: put it inside a Form whose \`form\` names a declared form.`);
      return;
    }
    const fields = this.forms.get(form) ?? new Set<string>();
    if (fields.has(field)) return;
    const suggestion = closest(field, fields);
    this.warn("undeclared-name", at, `Form \`${form}\` declares no field \`${field}\`.`, suggestion === undefined ? undefined : quote(suggestion));
  }

  // -------------------------------------------------------------------------
  // Props

  private props(
    name: string,
    contract: ComponentContract | undefined,
    props: Record<string, unknown>,
    path: string,
    own: Scope,
    inner: Scope,
  ): void {
    const templates = new Set<string>();
    if (contract !== undefined) {
      for (const [propPath, names] of Object.entries(contract.templateProps ?? {})) {
        for (const found of valuesAt(props, propPath, path)) {
          templates.add(found.path);
          if (!isNodeMarker(found.value)) {
            this.warn("invalid-prop-value", found.path, `A row template is a \`{ "$node": … }\`; ${list(names)} are in scope inside it.`);
            continue;
          }
          const vars = new Set([...inner.vars, ...names]);
          this.node(found.value.$node, appendPointer(found.path, "$node"), { ...inner, vars });
        }
      }
      this.contractPaths(contract, props, path);
    }

    for (const key of Object.keys(props)) {
      const value = props[key];
      if (value === undefined) continue;
      const at = appendPointer(path, key);
      if (contract !== undefined && !this.prop(name, contract, key, value, at, own, inner)) continue;
      this.entry(key, value, at, inner, { templates });
    }
  }

  /** Contract checks on one top-level prop; false when the prop is dropped and its value need not be walked. */
  private prop(
    name: string,
    contract: ComponentContract,
    key: string,
    value: unknown,
    at: string,
    own: Scope,
    inner: Scope,
  ): boolean {
    const lower = lowerCaseProp(key);
    if (isForbiddenProp(key)) {
      this.warn("forbidden-prop", at, `\`${key}\` is dropped everywhere.`);
      return false;
    }
    if (contract.formProps?.includes(key)) {
      if (typeof value !== "string") this.warn("invalid-prop-value", at, `\`${key}\` names a declared form: a string.`);
      else if (!this.forms.has(value)) this.undeclared(at, `No form \`${value}\` is declared in \`forms\`.`, value, this.forms.keys());
      return false;
    }
    const role = lower === "name" ? nameRole(contract) : undefined;
    if (role === "field" && key === "name") {
      if (!isMarker(value) && !isName(value)) this.warn("invalid-prop-value", at, "`name` is a field name: letters, digits and `_`, not starting with a digit.");
      return false;
    }
    if (role === "dom") {
      this.warn("forbidden-prop", at, `\`${key}\` is dropped: ${name}'s \`name\` is a DOM name, which documents never set (a Field names its control).`);
      return false;
    }
    if (isIdReferenceProp(key)) {
      this.warn("forbidden-prop", at, `\`${key}\` is dropped: ids and what points at them are wired by the renderer.`);
      return false;
    }
    if (contract.droppedProps?.includes(key)) {
      this.warn("forbidden-prop", at, `\`${key}\` is dropped: a document cannot set it on ${name}.`);
      return false;
    }
    if (contract.dialog && key === "open") {
      this.warn("forbidden-prop", at, "The renderer owns `open`; seed it with `defaultOpen` and change it with `openDialog`/`closeDialog`.");
      return false;
    }
    if (lower.startsWith("data-")) {
      this.dataAttribute(key, value, at);
      return isMarker(value);
    }
    if (key === "children") {
      this.warn("unknown-prop", at, "Children go in the node's `children` array, not in `props`.");
      return false;
    }

    if (!this.takes(name, contract, key)) {
      const candidates = (contract.props ?? []).map((prop) => prop.name);
      const suggestion = closest(key, candidates);
      this.warn("unknown-prop", at, `${name} takes no prop \`${key}\`.`, suggestion === undefined ? undefined : quote(suggestion));
    }

    if (key === "className") {
      if (typeof value === "string") this.classList(value, at);
      return !(typeof value === "string");
    }
    if (key === "classNames") {
      this.slotClasses(name, contract, value, at);
      return false;
    }
    if (own.boundField && CONTROLLED_PROPS.has(key) && !name.startsWith("Field.")) {
      this.warn("controlled-in-field", at, `\`${key}\` on a control inside a bound Field detaches it from the form; leave it out.`);
    }
    if (!isMarker(value)) this.literal(name, contract, key, value, at, inner);
    return true;
  }

  /** Whether `name` takes `key`: its own props, its element's attributes, its declared `className`. */
  private takes(name: string, contract: ComponentContract, key: string): boolean {
    if (contract.props?.some((prop) => prop.name === key)) return true;
    if (contract.nativeAttributes && isNativeAttribute(key)) return true;
    const declared = Object.hasOwn(DECLARED_PATHS, name) ? DECLARED_PATHS[name] : undefined;
    if (key === "className") return contract.nativeAttributes === true || declared?.paths.includes("className") === true;
    if (key === "classNames") return (contract.slots?.length ?? 0) > 0;
    // A host's own contract that lists no props is unchecked.
    return contract.props === undefined && declared === undefined && contract.category === "custom";
  }

  /** Checks on a prop's literal (non-marker) value. */
  private literal(name: string, contract: ComponentContract, key: string, value: unknown, at: string, inner: Scope): void {
    const enums = contract.propEnums?.[key];
    const elements = contract.elementProps?.[key];
    const levels = contract.headingLevelProps?.[key];
    if (elements !== undefined && !elements.includes(value as string)) {
      this.outside(at, `\`${key}\` chooses the element: one of ${elements.map(quote).join(", ")}.`, value, elements);
    } else if (levels !== undefined && !levels.includes(value as number)) {
      this.warn("invalid-prop-value", at, `\`${key}\` is a heading level: one of ${levels.join(", ")}.`);
    } else if (enums !== undefined && !enums.includes(value as string | number | boolean)) {
      this.outside(at, `${name}'s \`${key}\` is one of ${enums.map(quote).join(", ")}.`, value, enums);
    }
    const refKinds = refPropKinds(contract, key);
    if (refKinds !== undefined && !refKinds.includes(typeof value)) {
      const takes = refKinds.length === 0 ? "nothing a document can write" : refKinds.join(" or ");
      this.warn("invalid-prop-value", at, `\`${key}\` takes ${takes} here; a ref cannot come from a document.`);
    }
    const intl = contract.intlProps?.[key];
    if (intl !== undefined && typeof value === "string" && !(intl === "currency" ? isCurrencyCode(value) : isIntlUnit(value))) {
      this.warn("invalid-prop-value", at, `Not ${intl === "currency" ? "an ISO 4217 currency code (\"EUR\")" : "a unit Intl formats"}; the renderer drops it.`);
    }
    if (contract.setProps?.includes(key) && !Array.isArray(value)) {
      this.warn("invalid-prop-value", at, `\`${key}\` is a list (an array).`);
    }
    if (contract.iconProps?.includes(key) || (name === "Icon" && key === "name")) {
      if (typeof value === "string") this.icon(value, at);
    }
    if (contract.formatProps?.includes(key)) this.formatSpec(value, at);
    if (contract.dialog && key === "dialogId" && !isName(value)) {
      this.warn("invalid-prop-value", at, "`dialogId` is a name (letters, digits and `_`).");
    }
    const coercion = contract.coercions?.[key];
    if (coercion?.kind === "columns") this.columns(value, at, inner);
    else if (coercion?.kind === "options") this.advisory("SelectOptions", value, at);
    else if (coercion !== undefined && typeof value !== "string") {
      this.warn("invalid-prop-value", at, coercion.kind === "accessor" ? `\`${key}\` is a field path (a string).` : `\`${key}\` is a string of characters.`);
    }
  }

  private outside(at: string, message: string, value: unknown, allowed: readonly unknown[]): void {
    const suggestion =
      typeof value === "string" ? closest(value, allowed.filter((item): item is string => typeof item === "string")) : undefined;
    this.warn("invalid-prop-value", at, message, suggestion === undefined ? undefined : quote(suggestion));
  }

  /** Path-addressed contract fields: dates, URLs, images, nested drops and node props. */
  private contractPaths(contract: ComponentContract, props: Record<string, unknown>, path: string): void {
    for (const [propPath, kind] of Object.entries(contract.dateProps ?? {})) {
      for (const { path: at, value } of valuesAt(props, propPath, path)) this.date(value, kind, at);
    }
    for (const propPath of contract.urlProps ?? []) {
      for (const { path: at, value } of valuesAt(props, propPath, path)) if (typeof value === "string") this.url(value, at, false);
    }
    for (const propPath of contract.imageProps ?? []) {
      for (const { path: at, value } of valuesAt(props, propPath, path)) if (typeof value === "string") this.url(value, at, true);
    }
    for (const propPath of contract.droppedProps ?? []) {
      if (!propPath.includes(".") && !propPath.includes("[")) continue;
      for (const { path: at } of valuesAt(props, propPath, path)) {
        this.warn("forbidden-prop", at, `\`${propPath}\` is dropped: a document cannot set it.`);
      }
    }
    for (const propPath of contract.nodeProps ?? []) {
      for (const { path: at, value } of valuesAt(props, propPath, path)) {
        if (isPlainObject(value) && !isMarker(value)) {
          this.warn("invalid-prop-value", at, 'Takes text or a node: `{ "$node": … }`. A bare object is not a node.');
        }
      }
    }
  }

  private date(value: unknown, kind: string, at: string): void {
    if (typeof value === "string") {
      if (ISO_SHAPED.test(value) && !isIsoDateTime(value)) this.warn("invalid-prop-value", at, `Not a real date: ${quote(value)}.`);
      return;
    }
    if (kind !== "dateRange" || !isPlainObject(value)) return;
    for (const end of ["start", "end"]) {
      const item = value[end];
      if (item !== null && item !== undefined && (typeof item !== "string" || !isIsoDateTime(item))) {
        this.warn("invalid-prop-value", appendPointer(at, end), 'A date range\'s ends are ISO dates ("2026-11-02").');
      }
    }
  }

  private dataAttribute(key: string, value: unknown, at: string): void {
    if (!isAllowedDataAttribute(key)) {
      const why = DATA_ATTRIBUTE_PATTERN.test(key) ? "the host owns that axis" : "`data-*` names are lower-case letters, digits and hyphens";
      this.warn("forbidden-prop", at, `\`${key}\` is dropped: ${why}.`);
      return;
    }
    if (isMarker(value) || isAllowedDataValue(key, value)) return;
    const allowed = Object.hasOwn(CONSTRAINED_DATA_ATTRIBUTES, key) ? CONSTRAINED_DATA_ATTRIBUTES[key] : undefined;
    if (allowed === undefined) this.warn("invalid-prop-value", at, `\`${key}\` is dropped: a \`data-*\` value is a string, number or boolean.`);
    else this.outside(at, `\`${key}\` is one of ${allowed.map(quote).join(", ")}.`, value, allowed);
  }

  private classList(text: string, at: string): void {
    if (this.classes === null) return;
    for (const name of text.split(/\s+/)) {
      if (name === "" || this.classes.has(name)) continue;
      const suggestion = closest(name, this.classes);
      this.warn(
        "unknown-class",
        at,
        `\`${name}\` is not in the class vocabulary, so it would style nothing.`,
        suggestion === undefined ? undefined : quote(suggestion),
      );
    }
  }

  private slotClasses(name: string, contract: ComponentContract, value: unknown, at: string): void {
    if (!isPlainObject(value)) return;
    const slots = contract.slots ?? [];
    for (const [slot, classes] of Object.entries(value)) {
      const slotAt = appendPointer(at, slot);
      if (!slots.includes(slot)) {
        const suggestion = closest(slot, slots);
        const takes = slots.length === 0 ? "no slots" : `the slots ${list(slots)}`;
        this.warn("unknown-prop", slotAt, `${name} has ${takes}, not \`${slot}\`.`, suggestion === undefined ? undefined : quote(suggestion));
      }
      if (typeof classes === "string") this.classList(classes, slotAt);
    }
  }

  private icon(name: string, at: string): void {
    if (this.icons.has(name)) return;
    const suggestion = closest(name, this.icons);
    this.warn("unknown-icon", at, `No icon \`${name}\` in the icon set.`, suggestion === undefined ? undefined : quote(suggestion));
  }

  /** A shape the contract decides, checked against the advisory schema and reported as a prop warning (a key it lacks: `unknown-prop`). */
  private advisory(def: string, value: unknown, at: string): void {
    const schema = ADVISORY_DEFS[def];
    if (schema === undefined) throw new Error(`No advisory definition ${def}.`);
    for (const issue of ADVISORY.validate(schema, value, at)) {
      this.warn(issue.code === "unknown-key" ? "unknown-prop" : "invalid-prop-value", issue.path, issue.message, issue.suggestion);
    }
  }

  private formatSpec(value: unknown, at: string): void {
    this.advisory("FormatSpec", value, at);
    if (isPlainObject(value)) this.formatOptions(value, at);
  }

  private formatOptions(options: Record<string, unknown>, at: string): void {
    if (options.style === "currency" && typeof options.currency === "string" && !isCurrencyCode(options.currency)) {
      this.warn("unusable-value", appendPointer(at, "currency"), 'Not an ISO 4217 currency code ("EUR").');
    }
    if (options.style === "unit" && typeof options.unit === "string" && !isIntlUnit(options.unit)) {
      this.warn("unusable-value", appendPointer(at, "unit"), 'Not a unit Intl formats ("millisecond", "kilometer-per-hour").');
    }
    if (!digitsAccepted(options)) {
      this.warn("unusable-value", at, "`minimumFractionDigits` is more than `maximumFractionDigits`.");
    }
  }

  private columns(value: unknown, at: string, scope: Scope): void {
    if (!Array.isArray(value)) {
      this.warn("invalid-prop-value", at, "`columns` is an array of column objects.");
      return;
    }
    const ids = new Set<string>();
    value.forEach((column: unknown, index) => {
      const columnAt = appendPointer(at, index);
      this.advisory("Column", column, columnAt);
      if (!isPlainObject(column)) return;
      if (typeof column.id === "string") {
        if (ids.has(column.id)) this.warn("invalid-prop-value", appendPointer(columnAt, "id"), `Two columns share the id ${quote(column.id)}.`);
        ids.add(column.id);
      }
      if (isPlainObject(column.format)) this.formatOptions(column.format, appendPointer(columnAt, "format"));
      if (isNodeMarker(column.header)) {
        this.node(column.header.$node, appendPointer(appendPointer(columnAt, "header"), "$node"), scope);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Values anywhere in props

  /** One key and its value inside props, at any depth. */
  private entry(key: string, value: unknown, at: string, scope: Scope, walk: Walk): void {
    if (HANDLER_KEY_PATTERN.test(key) && !walk.stateOnly) {
      if (isHandler(value)) this.handler(value, at, { ...scope, inHandler: true }, 0);
      else this.warn("forbidden-prop", at, `\`${key}\` holds no handler (an action or a list of actions), so it is dropped.`);
      return;
    }
    const lower = lowerCaseProp(key);
    if (typeof value === "string" && URL_NAMES.has(lower) && !walk.stateOnly) this.url(value, at, IMAGE_NAMES.has(lower));
    this.value(value, at, scope, walk);
  }

  private value(value: unknown, at: string, scope: Scope, walk: Walk = {}): void {
    if (isRefMarker(value)) {
      this.ref(value.$ref, appendPointer(at, "$ref"), scope, walk.stateOnly);
    } else if (isNodeMarker(value)) {
      if (walk.templates?.has(at) || walk.stateOnly) return;
      this.node(value.$node, appendPointer(at, "$node"), { ...scope, depth: scope.depth + 1 });
    } else if (isFormatMarker(value)) {
      this.format(value.$format, appendPointer(at, "$format"), scope);
    } else if (Array.isArray(value)) {
      value.forEach((item: unknown, index) => this.value(item, appendPointer(at, index), scope, walk));
    } else if (isPlainObject(value)) {
      for (const [key, item] of Object.entries(value)) {
        if (item !== undefined) this.entry(key, item, appendPointer(at, key), scope, walk);
      }
    }
  }

  private format(body: unknown, at: string, scope: Scope): void {
    if (!isPlainObject(body)) return;
    if (body.value !== undefined) this.value(body.value, appendPointer(at, "value"), scope);
    this.formatOptions(body, at);
  }

  private condition(condition: unknown, at: string, scope: Scope): void {
    if (typeof condition === "string") {
      this.ref(condition, at, scope);
      return;
    }
    if (!isPlainObject(condition)) return;
    if (condition.not !== undefined) this.condition(condition.not, appendPointer(at, "not"), scope);
    if (typeof condition.ref === "string") this.ref(condition.ref, appendPointer(at, "ref"), scope);
    for (const op of COMPARISON_OPERATORS) {
      const operand = condition[op];
      if (isRefMarker(operand)) this.ref(operand.$ref, appendPointer(appendPointer(at, op), "$ref"), scope);
    }
  }

  // -------------------------------------------------------------------------
  // References, handlers, URLs

  private undeclared(at: string, message: string, name: string, candidates: Iterable<string>, rewrite?: (name: string) => string): void {
    const suggestion = closest(name, candidates);
    this.warn("undeclared-name", at, message, suggestion === undefined ? undefined : quote(rewrite ? rewrite(suggestion) : suggestion));
  }

  private ref(path: string, at: string, scope: Scope, stateOnly = false): void {
    const parsed = parseRefPath(path);
    if (parsed === null) return;
    const { root, segments } = parsed;
    const [first, second, third] = segments;
    const rewrite = (index: number) => (name: string) => [root, ...segments.slice(0, index), name, ...segments.slice(index + 1)].join(".");
    if (stateOnly) {
      if (root !== STATE_ROOT) this.warn("undeclared-name", at, "A binding's `query`, `body` and `params` may read `state.…` only.");
      else if (first !== undefined && !this.state.has(first)) this.undeclared(at, `Nothing seeds or sets \`state.${first}\`.`, first, this.state, rewrite(0));
      return;
    }
    if (scope.vars.has(root)) return;
    switch (root) {
      case "data":
      case "status":
        if (first !== undefined && !this.data.has(first)) this.undeclared(at, `No data binding \`${first}\` is declared in \`data\`.`, first, this.data, rewrite(0));
        return;
      case "state":
        if (first !== undefined && !this.state.has(first)) {
          this.undeclared(at, `Nothing seeds or sets \`state.${first}\`: seed it in \`state\` or write it with \`setState\`.`, first, this.state, rewrite(0));
        }
        return;
      case "forms": {
        if (first === undefined) return;
        const fields = this.forms.get(first);
        if (fields === undefined) {
          this.undeclared(at, `No form \`${first}\` is declared in \`forms\`.`, first, this.forms.keys(), rewrite(0));
          return;
        }
        if (second === undefined) return;
        if (!(FORM_STATE_KEYS as readonly string[]).includes(second)) {
          this.undeclared(at, `A form reads ${list(FORM_STATE_KEYS)}, not \`${second}\`.`, second, FORM_STATE_KEYS, rewrite(1));
        } else if ((second === "values" || second === "errors") && third !== undefined && !fields.has(third)) {
          this.undeclared(at, `Form \`${first}\` declares no field \`${third}\`.`, third, fields, rewrite(2));
        }
        return;
      }
      case "event":
        if (!scope.inHandler) this.warn("undeclared-name", at, "`event` exists only inside a handler.");
        else if (first !== undefined && first !== "value" && first !== "args") {
          this.undeclared(at, "A handler's `event` has `value` and `args`.", first, ["value", "args"], rewrite(0));
        }
        return;
      default:
        this.undeclared(
          at,
          `\`${root}\` is neither a root (${REF_ROOTS.join(", ")}) nor a name in scope here.`,
          root,
          [...REF_ROOTS, ...scope.vars],
          (name) => [name, ...segments].join("."),
        );
    }
  }

  private handler(handler: unknown, at: string, scope: Scope, chain: number): void {
    const actions = Array.isArray(handler) ? (handler as unknown[]) : [handler];
    if (Array.isArray(handler) && handler.length > LIMITS.actionsPerHandler) {
      this.warn("limit-exceeded", at, `A handler runs at most ${LIMITS.actionsPerHandler} actions; the rest would not run.`);
    }
    actions.forEach((action, index) => {
      if (!isPlainObject(action) || !isPlainObject(action.payload)) return;
      const payload = action.payload;
      const pat = appendPointer(Array.isArray(handler) ? appendPointer(at, index) : at, "payload");
      const field = (key: string) => appendPointer(pat, key);
      switch (action.action) {
        case "setState":
          this.value(payload.value, field("value"), scope);
          return;
        case "submitForm":
        case "resetForm":
          if (typeof payload.form === "string" && !this.forms.has(payload.form)) {
            this.undeclared(field("form"), `No form \`${payload.form}\` is declared in \`forms\`.`, payload.form, this.forms.keys());
          }
          return;
        case "navigate":
          if (typeof payload.to === "string") this.url(payload.to, field("to"), false);
          else this.value(payload.to, field("to"), scope);
          return;
        case "showToast":
          for (const key of ["title", "description"]) this.value(payload[key], field(key), scope);
          return;
        case "apiCall":
          if (typeof payload.endpoint === "string") this.endpoint(payload.endpoint, field("endpoint"));
          this.value(payload.query, field("query"), scope);
          this.value(payload.body, field("body"), scope);
          for (const key of ["onSuccess", "onError"]) {
            if (!isHandler(payload[key])) continue;
            if (chain + 1 > LIMITS.actionDepth) {
              this.warn("limit-exceeded", field(key), `\`onSuccess\`/\`onError\` nest at most ${LIMITS.actionDepth} deep; this one would not run.`);
            } else this.handler(payload[key], field(key), scope, chain + 1);
          }
          return;
        case "openDialog":
        case "closeDialog":
          if (typeof payload.dialogId === "string" && !this.dialogs.has(payload.dialogId)) {
            this.undeclared(field("dialogId"), `No dialog component has \`"dialogId": ${quote(payload.dialogId)}\`.`, payload.dialogId, this.dialogs);
          }
          return;
        default:
          return;
      }
    });
  }

  private url(raw: string, at: string, image: boolean): void {
    if (safeUrl(raw) === "") {
      this.warn("refused-url", at, "Refused: a URL is relative, http(s), mailto, tel or a data: raster image.");
      return;
    }
    if (!image) return;
    const candidates = lowerCaseLast(at) === "srcset" ? srcSetUrls(raw) : [raw];
    for (const candidate of candidates) {
      const url = resolveUrl(candidate, this.base);
      if (url === null || !defaultAllowImageUrl(url, this.base)) {
        this.warn("refused-url", at, "An image from another origin: the default image policy loads same-origin and data: raster images only (the host may allow more).");
        return;
      }
    }
  }

  private endpoint(raw: string, at: string): void {
    const url = safeUrl(raw) === "" ? null : resolveUrl(raw, this.base);
    if (url === null) {
      this.warn("refused-url", at, "Refused: an endpoint is a relative or same-origin http(s) URL.");
    } else if (!defaultAllowUrl(url, this.base)) {
      this.warn("refused-url", at, "Another origin: requests go to the view's own origin unless the host's `allowUrl` allows more.");
    }
  }
}

interface Walk {
  /** Pointers of row templates, already walked with their names in scope. */
  readonly templates?: ReadonlySet<string>;
  /** Inside a data binding: references may read `state.…` only, and nothing renders. */
  readonly stateOnly?: boolean;
}

function lowerCaseLast(pointer: string): string {
  return lowerCaseProp(pointer.slice(pointer.lastIndexOf("/") + 1));
}

function originBase(origin: string | undefined): string {
  if (origin === undefined) return NO_LOCATION_BASE;
  try {
    return `${new URL(origin).origin}/`;
  } catch {
    return NO_LOCATION_BASE;
  }
}

function compiles(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

const FIELD_VALUE_WORDS: { readonly [T in FieldType]: string } = {
  text: "a string",
  number: "a number or null",
  boolean: "true or false",
  date: 'an ISO date ("2026-11-02") or null',
  dateRange: '{ "start", "end" } of ISO dates, or null',
  list: "an array of strings",
};

function fitsField(type: FieldType, value: unknown): boolean {
  switch (type) {
    case "text":
      return typeof value === "string";
    case "number":
      return value === null || typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "date":
      return value === null || (typeof value === "string" && isIsoDate(value));
    case "dateRange":
      return (
        value === null ||
        (isPlainObject(value) &&
          ["start", "end"].every((end) => value[end] === null || (typeof value[end] === "string" && isIsoDate(value[end] as string))))
      );
    case "list":
      return Array.isArray(value) && value.every((item) => typeof item === "string");
  }
}

/** Every warning `doc` raises. */
export function adviseDocument(doc: unknown, options: AdviceOptions): Issue[] {
  const advisor = new Advisor(options);
  advisor.run(doc);
  return advisor.issues;
}
