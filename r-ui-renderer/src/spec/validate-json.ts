/**
 * The validator's input: JSON text (a surrounding Markdown fence stripped) or
 * a value a host built. Text that does not parse becomes one `invalid-json`
 * issue placed by line and column in the text as given; a value that is not
 * JSON (a cycle, a function, a Date, `NaN`) becomes `invalid-type` at the first
 * place it stops being JSON.
 */

import { stripCodeFence } from "../stream/fence";
import { parsePartialViewSpec } from "../stream/parser";
import { isPlainObject } from "./guards";
import { appendPointer } from "./pointer";
import type { Issue } from "./types";
import { makeIssue } from "./issue";

export type ParsedInput = { readonly value: unknown; readonly issue?: undefined } | { readonly value?: undefined; readonly issue: Issue };

/** 1-based line and column (UTF-16 units) of `offset` in `text`. */
export function lineColumn(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  const end = Math.min(Math.max(offset, 0), text.length);
  for (let index = 0; index < end; index += 1) {
    if (text.charCodeAt(index) === 0x0a) {
      line += 1;
      lineStart = index + 1;
    }
  }
  return { line, column: end - lineStart + 1 };
}

/** Where the fence-stripped `json` starts inside `text`. */
function startOf(text: string, json: string): number {
  if (text.startsWith(json)) return 0;
  // A stripped opening fence ends at the first line break; the JSON follows it after whitespace only.
  return text.indexOf(json, text.indexOf("\n") + 1);
}

export function parseText(text: string): ParsedInput {
  const json = stripCodeFence(text);
  try {
    return { value: JSON.parse(json) as unknown };
  } catch {
    const base = startOf(text, json);
    const snapshot = parsePartialViewSpec(json);
    const located = snapshot.error?.code === "invalid-json" ? snapshot.error : undefined;
    const empty = json.trim() === "";
    const offset = empty ? 0 : base + (located?.offset ?? json.length);
    const message = empty
      ? "The text is empty: a document is one JSON object."
        : located !== undefined
          ? `Not JSON: ${located.message}`
          : "Not JSON: the text ends before the document closes.";
    return { issue: { ...makeIssue("invalid-json", "", message), ...lineColumn(text, offset) } };
  }
}

/**
 * The first place `value` is not JSON, or undefined. Iterative, so a deep
 * value cannot overflow the stack here; `undefined` members of an object count
 * as absent, as `JSON.stringify` treats them.
 */
export function findNonJson(value: unknown): Issue | undefined {
  const onPath = new Set<object>();
  const stack: { value: unknown; path: string; exit?: object }[] = [{ value, path: "" }];
  while (stack.length > 0) {
    const frame = stack.pop() as (typeof stack)[number];
    if (frame.exit !== undefined) {
      onPath.delete(frame.exit);
      continue;
    }
    const item = frame.value;
    if (item === null || typeof item === "string" || typeof item === "boolean") continue;
    if (typeof item === "number") {
      if (Number.isFinite(item)) continue;
      return makeIssue("invalid-type", frame.path, `${String(item)} is not a JSON number.`);
    }
    const isArray = Array.isArray(item);
    if (!isArray && !isPlainObject(item)) {
      const what = typeof item === "object" ? `a ${(item as object).constructor?.name ?? "non-plain"} object` : `a ${typeof item}`;
      return makeIssue("invalid-type", frame.path, `Not JSON: ${what}.`);
    }
    if (onPath.has(item)) return makeIssue("invalid-type", frame.path, "Not JSON: the value contains itself.");
    onPath.add(item);
    stack.push({ value: undefined, path: frame.path, exit: item });
    if (isArray) {
      for (let index = item.length - 1; index >= 0; index -= 1) {
        const element: unknown = item[index];
        if (element === undefined) return makeIssue("invalid-type", appendPointer(frame.path, index), "Not JSON: undefined.");
        stack.push({ value: element, path: appendPointer(frame.path, index) });
      }
    } else {
      const record = item as Record<string, unknown>;
      for (const key of Object.keys(record).reverse()) {
        if (record[key] !== undefined) stack.push({ value: record[key], path: appendPointer(frame.path, key) });
      }
    }
  }
  return undefined;
}
