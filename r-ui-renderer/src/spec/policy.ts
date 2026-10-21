/**
 * The renderer's safety and size policy as data, shared by the renderer (which
 * enforces it) and the validator (which warns about it). Prop names compare
 * case-insensitively: `lowerCaseProp` before any lookup.
 */

import { isOneOf, ownValue } from "./guards";
import { DENSITIES } from "./types";

export const LIMITS = {
  /** Node nesting; deeper nodes render a diagnostic instead. */
  depth: 50,
  /** `onSuccess`/`onError` nesting; deeper handlers do not run. */
  actionDepth: 5,
  /** Actions in one handler list. */
  actionsPerHandler: 10,
  /**
   * Characters a `pattern` rule tests; a longer value fails the rule. This
   * bounds polynomial backtracking only: exponential patterns are refused
   * outright (`patternProblem`).
   */
  patternInput: 1000,
  /** `title` length. */
  title: 200,
  /** JSON nesting (arrays and objects) a document, a value or a stream may reach; deeper is refused. */
  jsonDepth: 256,
} as const;

/**
 * Dropped everywhere, in any casing, as is any name with a `:` (a namespaced
 * attribute such as `xlink:href`). `on…` props that are not handlers are
 * dropped too. `ping` sends a request to its URLs on every click, so no
 * document may set it.
 */
export const FORBIDDEN_PROPS = [
  "dangerouslysetinnerhtml",
  "srcdoc",
  "style",
  "formaction",
  "formmethod",
  "formtarget",
  "formenctype",
  "formnovalidate",
  "ping",
  "ref",
  "key",
  "__proto__",
  "constructor",
  "prototype",
] as const;

/**
 * DOM ids and the props that point at one. A document cannot author them: two
 * views on one page would collide, and the library's Field wiring supplies
 * every id a control needs. `name` is not here: what it means is each
 * contract's (`nameRole`).
 */
export const ID_REFERENCE_PROPS = [
  "id",
  "htmlfor",
  "for",
  "form",
  "list",
  "headers",
  "popovertarget",
  "commandfor",
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-owns",
  "aria-activedescendant",
  "aria-details",
  "aria-errormessage",
  "aria-flowto",
] as const;

/** Props that are URLs on every component (contracts add renamed and nested ones). */
export const URL_PROPS = ["href", "src", "srcset", "poster", "cite", "action", "background", "ping", "xlinkhref", "to"] as const;

/** Of those, the ones a browser fetches as an image. */
export const IMAGE_URL_PROPS = ["src", "srcset", "poster"] as const;

/** `data-*` attributes pass through when they match, with a string, number or boolean value. */
export const DATA_ATTRIBUTE_PATTERN = /^data-[a-z][a-z0-9-]*$/;

/** `data-*` attributes that would move a host axis: dropped. */
export const DROPPED_DATA_ATTRIBUTES = ["data-theme", "data-input"] as const;

/** `data-*` attributes with a closed set of values; any other value is dropped. */
export const CONSTRAINED_DATA_ATTRIBUTES: { readonly [attribute: string]: readonly string[] } = {
  "data-density": DENSITIES,
};

export function lowerCaseProp(name: string): string {
  return name.toLowerCase();
}

const FORBIDDEN = new Set<string>(FORBIDDEN_PROPS);
const ID_REFERENCES = new Set<string>(ID_REFERENCE_PROPS);

export function isForbiddenProp(name: string): boolean {
  return name.includes(":") || FORBIDDEN.has(lowerCaseProp(name));
}

export function isIdReferenceProp(name: string): boolean {
  return ID_REFERENCES.has(lowerCaseProp(name));
}

/** A `data-*` name a document may set: it matches the pattern and moves no host axis. */
export function isAllowedDataAttribute(name: string): boolean {
  return DATA_ATTRIBUTE_PATTERN.test(name) && !isOneOf(DROPPED_DATA_ATTRIBUTES, name);
}

/** A `data-*` value that passes on: a string, number or boolean, within the attribute's set when it has one. */
export function isAllowedDataValue(name: string, value: unknown): boolean {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return false;
  const allowed = ownValue(CONSTRAINED_DATA_ATTRIBUTES, name);
  return allowed === undefined || isOneOf(allowed, value);
}
