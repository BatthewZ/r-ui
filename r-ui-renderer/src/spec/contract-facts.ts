/**
 * What a contract says about a prop that the renderer (which acts on it) and
 * the validator (which warns about it) must read the same way.
 */

import type { ComponentContract } from "./types";

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
  const type = contract.props?.find((doc) => doc.name === prop)?.type;
  if (type === undefined) return undefined;
  const members = unionMembers(type);
  if (!members.some((member) => member.startsWith("RefObject<"))) return undefined;
  return [...new Set(members.flatMap((member) => jsonKind(member) ?? []))];
}
