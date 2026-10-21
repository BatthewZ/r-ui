/**
 * Where an issue points in the editor's text: a JSON Pointer to the span of
 * the value it names, or a line and column to an offset. Built for jumping a
 * caret, so it is forgiving: a pointer to something absent lands on its
 * deepest present ancestor, and text that stops being JSON part-way keeps
 * whatever was found before that point.
 */
import { parsePointer } from "../src/spec/pointer";
import { stripCodeFence } from "../src/stream";

export interface Span {
  readonly start: number;
  readonly end: number;
}

class Stop extends Error {}

export function locatePointer(text: string, pointer: string): Span | undefined {
  const segments = parsePointer(pointer);
  if (segments === null) return undefined;
  const json = stripCodeFence(text);
  const base = text.indexOf(json);
  let at = 0;
  let found: Span | undefined;
  let depthFound = -1;

  const fail = (): never => {
    throw new Stop();
  };
  const skipSpace = () => {
    while (at < json.length && /\s/.test(json.charAt(at))) at += 1;
  };
  const expect = (char: string) => {
    if (json.charAt(at) !== char) fail();
    at += 1;
  };
  const record = (start: number, end: number, depth: number) => {
    // Deepest wins; at a tie the value, read after its key, replaces the key.
    if (depth >= depthFound) {
      found = { start: base + start, end: base + end };
      depthFound = depth;
    }
  };
  const readString = (): string => {
    const start = at;
    expect('"');
    while (at < json.length && json.charAt(at) !== '"') at += json.charAt(at) === "\\" ? 2 : 1;
    expect('"');
    try {
      return JSON.parse(json.slice(start, at)) as string;
    } catch {
      return fail();
    }
  };

  /** Reads one value; `depth` is how many segments its path has matched, or -1 off the path. */
  const readValue = (depth: number): void => {
    skipSpace();
    const start = at;
    const onPath = depth >= 0;
    const childDepth = (key: string) => (onPath && depth < segments.length && segments[depth] === key ? depth + 1 : -1);
    const char = json.charAt(at);
    if (char === "{") {
      at += 1;
      skipSpace();
      if (json.charAt(at) === "}") at += 1;
      else {
        for (;;) {
          skipSpace();
          const keyStart = at;
          const key = readString();
          const next = childDepth(key);
          if (next >= 0) record(keyStart, at, next);
          skipSpace();
          expect(":");
          readValue(next);
          skipSpace();
          if (json.charAt(at) === ",") at += 1;
          else {
            expect("}");
            break;
          }
        }
      }
    } else if (char === "[") {
      at += 1;
      skipSpace();
      if (json.charAt(at) === "]") at += 1;
      else {
        for (let index = 0; ; index += 1) {
          readValue(childDepth(String(index)));
          skipSpace();
          if (json.charAt(at) === ",") at += 1;
          else {
            expect("]");
            break;
          }
        }
      }
    } else if (char === '"') {
      readString();
    } else {
      while (at < json.length && /[^\s,\]}]/.test(json.charAt(at))) at += 1;
      if (at === start) fail();
    }
    if (onPath) record(start, at, depth);
  };

  try {
    readValue(0);
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
  }
  return found;
}

/** The offset of a 1-based line and column (as the validator reports `invalid-json`). */
export function offsetOf(text: string, line: number, column: number): number {
  let offset = 0;
  for (let current = 1; current < line; current += 1) {
    const next = text.indexOf("\n", offset);
    if (next === -1) return text.length;
    offset = next + 1;
  }
  return Math.min(text.length, offset + Math.max(0, column - 1));
}
