import * as library from "@batthewz/r-ui-react-components";
import type { ElementType } from "react";

import { defaultContracts } from "../contracts";
import { Heading } from "../render/builtins/Heading";
import { Icon } from "../render/builtins/Icon";
import { Text } from "../render/builtins/Text";

export interface RegistryEntry {
  readonly component: ElementType;
  /** Compound parts, addressed `"Parent.Part"`. */
  readonly parts?: { readonly [part: string]: ElementType };
}

/** Name → entry, null-prototype: `"__proto__"` or `"toString"` names nothing. */
export type ComponentRegistry = { readonly [name: string]: RegistryEntry };

const FORWARD_REF = Symbol.for("react.forward_ref");
const MEMO = Symbol.for("react.memo");

function isComponentLike(value: unknown): value is ElementType {
  if (typeof value === "function") return true;
  if (typeof value !== "object" || value === null || !("$$typeof" in value)) return false;
  return value.$$typeof === FORWARD_REF || value.$$typeof === MEMO;
}

/** A PascalCase export that React can render: hooks, utilities and constants are not. */
export function isExportedComponent(name: string, value: unknown): value is ElementType {
  return /^[A-Z]/.test(name) && isComponentLike(value);
}

type NameFilter = (name: string) => boolean;

const everything: NameFilter = () => true;

/** Parts attached as static members (`Object.assign(Card, { Header })`), as `include` allows them. */
function collectParts(name: string, component: ElementType, include: NameFilter): Record<string, ElementType> | undefined {
  if (typeof component !== "function" && typeof component !== "object") return undefined;
  const parts = Object.create(null) as Record<string, ElementType>;
  let found = false;
  for (const key of Object.keys(component)) {
    const value: unknown = (component as unknown as Record<string, unknown>)[key];
    if (isExportedComponent(key, value) && include(`${name}.${key}`)) {
      parts[key] = value;
      found = true;
    }
  }
  return found ? parts : undefined;
}

function entryFor(name: string, component: ElementType, include: NameFilter = everything): RegistryEntry {
  const parts = collectParts(name, component, include);
  return parts ? { component, parts } : { component };
}

/**
 * Every component a module namespace exports, with its parts; `include`
 * narrows both by the name a document would write (`"Card"`, `"Card.Header"`).
 */
export function createRegistryFromModule(
  namespace: { readonly [name: string]: unknown },
  include: NameFilter = everything,
): ComponentRegistry {
  const registry = Object.create(null) as Record<string, RegistryEntry>;
  for (const [name, value] of Object.entries(namespace)) {
    if (isExportedComponent(name, value) && include(name)) registry[name] = entryFor(name, value, include);
  }
  return registry;
}

/** `base` plus `extra` (components or entries); never mutates `base`. */
export function extendRegistry(
  base: ComponentRegistry,
  extra: { readonly [name: string]: RegistryEntry | ElementType },
): ComponentRegistry {
  const next = Object.create(null) as Record<string, RegistryEntry>;
  for (const name of Object.keys(base)) next[name] = base[name] as RegistryEntry;
  for (const [name, value] of Object.entries(extra)) {
    next[name] = isComponentLike(value) ? entryFor(name, value) : value;
  }
  return next;
}

/** The component for `"Card"` or `"Card.Header"`, own properties only. */
export function lookupComponent(registry: ComponentRegistry, name: string): ElementType | undefined {
  const dot = name.indexOf(".");
  const root = dot === -1 ? name : name.slice(0, dot);
  if (!Object.hasOwn(registry, root)) return undefined;
  const entry = registry[root] as RegistryEntry;
  if (dot === -1) return entry.component;
  const part = name.slice(dot + 1);
  return entry.parts && Object.hasOwn(entry.parts, part) ? entry.parts[part] : undefined;
}

/** The library's addressable components (those `defaultContracts` holds) and the renderer's built-ins. */
export const defaultRegistry: ComponentRegistry = extendRegistry(
  createRegistryFromModule(library, (name) => Object.hasOwn(defaultContracts, name)),
  {
    Text,
    Heading,
    Icon,
  },
);

/** Every name in `registry`, parts included (`"Card.Header"`), sorted. */
export function listRegistryNames(registry: ComponentRegistry): string[] {
  const names: string[] = [];
  for (const name of Object.keys(registry)) {
    names.push(name);
    for (const part of Object.keys(registry[name]?.parts ?? {})) names.push(`${name}.${part}`);
  }
  return names.sort();
}
