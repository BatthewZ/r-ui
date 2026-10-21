/**
 * What a contract says about a prop that the renderer (which acts on it) and
 * the validator (which warns about it) must read the same way.
 */

import { isForbiddenProp, isIdReferenceProp, lowerCaseProp } from "./policy";
import type { ComponentContract, PropDoc } from "./types";

/**
 * What `name` means on a component. `dom`: a form control's DOM name, dropped,
 * because two views on one page would merge their radio groups and
 * submissions (the library's Field wiring names a bound control). `field`: a
 * form field key, binding a Field. `own`: the component's own meaning (an
 * Avatar's person, the Icon's glyph), passed on as written. `own` is the
 * default: a miss there leaves a DOM name in place, while a default of `dom`
 * would silently drop the meaning of every component no table has seen.
 */
export type NameRole = "dom" | "field" | "own";

export function nameRole(contract: ComponentContract | undefined): NameRole {
  if (contract?.fieldName === true) return "field";
  if (contract?.domName === true) return "dom";
  return "own";
}

/** The contract's entry for `prop`, if it lists one. */
export function propDoc(contract: ComponentContract | undefined, prop: string): PropDoc | undefined {
  return contract?.props?.find((doc) => doc.name === prop);
}

/** A declared type's union members, split at the top level only (`RefObject<A | B>` stays whole). */
function unionMembers(type: string): string[] {
  const members: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < type.length; index += 1) {
    const char = type.charAt(index);
    if ("<([{".includes(char)) depth += 1;
    else if (">)]}".includes(char)) depth -= 1;
    else if (char === "|" && depth === 0) {
      members.push(type.slice(start, index).trim());
      start = index + 1;
    }
  }
  members.push(type.slice(start).trim());
  return members.filter((member) => member !== "");
}

function jsonKind(member: string): string | undefined {
  if (member === "number" || /^-?\d/.test(member)) return "number";
  if (member === "string" || /^["'`]/.test(member)) return "string";
  if (member === "boolean" || member === "true" || member === "false") return "boolean";
  return undefined;
}

/**
 * For a prop the library types with a `RefObject`, the `typeof` kinds a
 * document may give instead (`number | RefObject<…>` → `["number"]`; a
 * `RefObject` alone → none): a ref cannot come from JSON, and an object
 * shaped like one would reach the component as if it were. Undefined for a
 * prop that takes no ref.
 */
export function refPropKinds(contract: ComponentContract, prop: string): readonly string[] | undefined {
  const type = propDoc(contract, prop)?.type;
  if (type === undefined) return undefined;
  const members = unionMembers(type);
  if (!members.some((member) => member.startsWith("RefObject<"))) return undefined;
  return [...new Set(members.flatMap((member) => jsonKind(member) ?? []))];
}

/**
 * Whether `prop`, an id-reference name (`list`, `form`, `aria-labelledby`, …),
 * is the component's own prop rather than the DOM attribute: the contract
 * declares it with a type no id reference can have (MasonryGrid's boolean
 * `list`). A string-typed one reaches the attribute and is dropped.
 */
function ownsIdReference(contract: ComponentContract | undefined, prop: string): boolean {
  const type = propDoc(contract, prop)?.type;
  return type !== undefined && !unionMembers(type).some((member) => jsonKind(member) === "string");
}

/** Why the renderer drops a document's `prop`. */
export type DropReason = "forbidden" | "dom-name" | "id-reference" | "dropped" | "dialog-open";

/**
 * Why a document's `prop` never reaches the component, or undefined when it
 * may. The renderer drops, the validator warns (`forbidden-prop`) and the
 * contracts and reference leave out exactly these, in this order: forbidden
 * everywhere; a prop naming a form always passes; a DOM `name`; an id
 * reference the component does not own; the contract's drops; a dialog's
 * `open`, which the renderer holds.
 */
export function dropReason(contract: ComponentContract | undefined, prop: string): DropReason | undefined {
  if (isForbiddenProp(prop)) return "forbidden";
  if (contract?.formProps?.includes(prop)) return undefined;
  if (lowerCaseProp(prop) === "name" && nameRole(contract) === "dom") return "dom-name";
  if (isIdReferenceProp(prop) && !ownsIdReference(contract, prop)) return "id-reference";
  if (contract?.droppedProps?.includes(prop)) return "dropped";
  if (contract?.dialog === true && prop === "open") return "dialog-open";
  return undefined;
}

/**
 * Whether a document can set `prop` at all: the renderer does not drop it
 * (`dropReason`) and it is not a ref that takes nothing JSON holds. The
 * validator warns about exactly the props this refuses; the reference lists
 * exactly the props it accepts.
 */
export function isDocumentProp(contract: ComponentContract, prop: string): boolean {
  if (dropReason(contract, prop) !== undefined) return false;
  if (contract.formProps?.includes(prop)) return true;
  return refPropKinds(contract, prop)?.length !== 0;
}

const CONTROLLED_PROPS: ReadonlySet<string> = new Set(["value", "checked", "defaultValue", "defaultChecked"]);

/**
 * Whether `prop` fixes a control's value, which detaches a Field binding: a
 * value prop the contract does not require. A required `value` is the
 * component's identity (a Radio's, a SegmentedControl.Item's), not a control
 * being driven: a controlled value is always optional.
 */
export function isControlledValue(contract: ComponentContract | undefined, prop: string): boolean {
  return CONTROLLED_PROPS.has(prop) && propDoc(contract, prop)?.required !== true;
}
