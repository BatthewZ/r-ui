/**
 * The contracts every check reads: one record per addressable name, computed
 * from the library's generated facts (`generated/components.json`), the
 * curated tables beside this module and the built-ins. It is a view over
 * those sources, never a second copy of them. React-free.
 */

import { BUILTIN_CONTRACTS } from "../spec/builtins";
import type { ComponentContract, ComponentContracts, PropDoc, PropPath } from "../spec/types";
import { type Exclusion, NOT_ADDRESSABLE } from "./curated/not-addressable";
import { NOTES } from "./curated/notes";
import {
  ALWAYS_DROPPED,
  DROPPED_PROPS,
  ELEMENT_PROPS,
  HEADING_LEVEL_PROPS,
  IMAGE_PROPS,
  INTL_PROPS,
  NAMESPACED_PROPS,
  SENSITIVE,
  URL_PROPS,
} from "./curated/sinks";
import { CHILD_INSPECTION, DIALOGS, FIELD_NAMES, FORM_PROPS, TEXT_CHILDREN } from "./curated/structure";
import type { CuratedTable } from "./curated/table";
import {
  COERCIONS,
  DATE_PROPS,
  DOCUMENT_PROPS,
  EVENT_VALUES,
  FORMAT_PROPS,
  ICON_PROPS,
  SET_PROPS,
  TEMPLATE_PROPS,
} from "./curated/values";
import generated from "./generated/components.json";
import declaredPaths from "./generated/declared-paths.json";

export { EXCLUSION_REASONS, type Exclusion, type ExclusionReason, NOT_ADDRESSABLE } from "./curated/not-addressable";

/** What the deriver read off one library component or part. */
export interface GeneratedComponent {
  readonly category: string;
  readonly props: readonly PropDoc[];
  readonly propEnums?: { readonly [prop: string]: readonly (string | number)[] };
  readonly slots?: readonly string[];
  readonly nodeProps?: readonly PropPath[];
  readonly nativeAttributes?: boolean;
}

/** Every path the library's declarations allow for a component, and which of them hold what JSON cannot. */
export interface DeclaredPaths {
  readonly paths: readonly PropPath[];
  readonly functions?: readonly PropPath[];
  readonly dates?: readonly PropPath[];
  readonly sets?: readonly PropPath[];
  readonly regexps?: readonly PropPath[];
  readonly dateCallbacks?: readonly PropPath[];
  readonly setCallbacks?: readonly PropPath[];
}

/** The installed library's facts, every component and part its barrel exports, addressable or not. */
export const LIBRARY_COMPONENTS: { readonly [name: string]: GeneratedComponent } = generated.components;
export const LIBRARY: { readonly name: string; readonly version: string } = generated.library;
export const DECLARED_PATHS: { readonly [name: string]: DeclaredPaths } = declaredPaths;

/** The fields folded in from a curated table, field by field. The fold test walks this same map. */
export const CURATED_FIELDS = {
  note: NOTES,
  urlProps: URL_PROPS,
  imageProps: IMAGE_PROPS,
  dateProps: DATE_PROPS,
  iconProps: ICON_PROPS,
  templateProps: TEMPLATE_PROPS,
  setProps: SET_PROPS,
  formatProps: FORMAT_PROPS,
  eventValue: EVENT_VALUES,
  coercions: COERCIONS,
  childInspection: CHILD_INSPECTION,
  elementProps: ELEMENT_PROPS,
  headingLevelProps: HEADING_LEVEL_PROPS,
  sensitive: SENSITIVE,
  textChildren: TEXT_CHILDREN,
  dialog: DIALOGS,
  fieldName: FIELD_NAMES,
  formProps: FORM_PROPS,
  namespacedProps: NAMESPACED_PROPS,
  intlProps: INTL_PROPS,
} as const satisfies { readonly [K in keyof ComponentContract]?: CuratedTable<K> };

/** The exclusion that covers `name`: its own, or its root's for a part. */
export function exclusionFor(name: string): Exclusion | undefined {
  if (Object.hasOwn(NOT_ADDRESSABLE, name)) return NOT_ADDRESSABLE[name];
  const dot = name.indexOf(".");
  if (dot === -1) return undefined;
  const root = name.slice(0, dot);
  return Object.hasOwn(NOT_ADDRESSABLE, root) ? NOT_ADDRESSABLE[root] : undefined;
}

/** `path` is `ancestor` or lies under it. */
export function isWithin(path: PropPath, ancestor: PropPath): boolean {
  return path === ancestor || path.startsWith(`${ancestor}.`) || path.startsWith(`${ancestor}[]`);
}

const isHandlerPath = (path: PropPath) => /(^|\.)on[A-Z][^.[]*$/.test(path);

/** Props the renderer builds the library's value for itself: formatters, row templates, coerced props and form handles. */
export function bridgedPaths(name: string): PropPath[] {
  return [
    ...(FORMAT_PROPS[name] ?? []),
    ...Object.keys(TEMPLATE_PROPS[name] ?? {}),
    ...Object.keys(COERCIONS[name] ?? {}),
    ...(FORM_PROPS[name] ?? []),
  ];
}

/** Library props a coercion writes (`rowKey` → `getRowKey`): the document writes the coerced prop instead. */
function coercionTargets(name: string): PropPath[] {
  return Object.values(COERCIONS[name] ?? {}).flatMap((c) => (c.kind === "accessor" ? [c.to] : []));
}

/**
 * Everything a document may not set on `name`: the curated decisions, the
 * props no component takes from a document, the library props a coercion
 * writes, and every function-only prop and
 * function-valued `labels` member the renderer does not bridge (JSON cannot
 * hold a function). Nested function fields are the curated table's to decide.
 */
export function droppedPropsFor(name: string): PropPath[] {
  const declared = DECLARED_PATHS[name];
  const bridged = bridgedPaths(name);
  const dropped = new Set<PropPath>([...(DROPPED_PROPS[name] ?? []), ...coercionTargets(name)]);
  for (const prop of ALWAYS_DROPPED) if (declared?.paths.includes(prop)) dropped.add(prop);
  for (const path of declared?.functions ?? []) {
    if (isHandlerPath(path) || bridged.some((b) => isWithin(path, b))) continue;
    if (!path.includes(".") && !path.includes("[")) dropped.add(path);
    else if (path.startsWith("labels.")) dropped.add(path);
  }
  return [...dropped].sort();
}

function propsFor(name: string, library: GeneratedComponent, dropped: readonly PropPath[]): PropDoc[] {
  const extra = DOCUMENT_PROPS[name] ?? [];
  const replaced = new Set(extra.map((p) => p.name));
  const own = library.props.filter((p) => !dropped.includes(p.name) && !replaced.has(p.name));
  return [...own, ...extra].sort((a, b) => a.name.localeCompare(b.name));
}

function assemble(name: string, library: GeneratedComponent): ComponentContract {
  const dropped = droppedPropsFor(name);
  const record: Record<string, unknown> = { category: library.category };
  const props = propsFor(name, library, dropped);
  if (props.length > 0) record.props = props;
  if (library.slots) record.slots = library.slots;
  const enums = Object.entries(library.propEnums ?? {}).filter(([prop]) => !dropped.includes(prop));
  if (enums.length > 0) record.propEnums = Object.fromEntries(enums);
  const nodes = (library.nodeProps ?? []).filter((path) => !dropped.some((d) => isWithin(path, d)));
  if (nodes.length > 0) record.nodeProps = nodes;
  if (dropped.length > 0) record.droppedProps = dropped;
  if (library.nativeAttributes) record.nativeAttributes = true;
  for (const [field, table] of Object.entries(CURATED_FIELDS)) {
    if (Object.hasOwn(table, name)) record[field] = (table as Record<string, unknown>)[name];
  }
  return record as unknown as ComponentContract;
}

function assembleAll(): ComponentContracts {
  const contracts = Object.create(null) as Record<string, ComponentContract>;
  for (const name of Object.keys(LIBRARY_COMPONENTS).sort()) {
    if (exclusionFor(name)) continue;
    contracts[name] = assemble(name, LIBRARY_COMPONENTS[name] as GeneratedComponent);
  }
  for (const name of Object.keys(BUILTIN_CONTRACTS)) contracts[name] = BUILTIN_CONTRACTS[name] as ComponentContract;
  return contracts;
}

/** Every addressable library component and part, and the built-ins. Null-prototype. */
export const defaultContracts: ComponentContracts = assembleAll();

/** The contract for `name`, own properties only (`"toString"` names nothing). */
export function contractFor(contracts: ComponentContracts, name: string): ComponentContract | undefined {
  return Object.hasOwn(contracts, name) ? contracts[name] : undefined;
}

/**
 * `base` with `extra` laid over it, field by field: a field `extra` sets
 * replaces that field whole (a partial set is indistinguishable from a
 * complete one), the rest of `base`'s record stays. A new name without a
 * `category` is filed under `"custom"`. Never mutates either; the result has
 * a null prototype, so `"__proto__"` or `"toString"` names nothing.
 */
export function extendContracts(
  base: ComponentContracts,
  extra: { readonly [name: string]: Partial<ComponentContract> },
): ComponentContracts {
  const next = Object.create(null) as Record<string, ComponentContract>;
  for (const name of Object.keys(base)) next[name] = base[name] as ComponentContract;
  for (const name of Object.keys(extra)) {
    const over = extra[name] as Partial<ComponentContract>;
    const under = contractFor(base, name);
    next[name] = { category: "custom", ...under, ...over };
  }
  return next;
}
