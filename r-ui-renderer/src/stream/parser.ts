import { isPlainObject } from "../spec/guards";
import { LIMITS } from "../spec/policy";
import { COMPONENT_NODE_KEYS, COND_NODE_KEYS, EACH_NODE_KEYS } from "../spec/types";
import { isJsonWhitespace } from "./fence";
import { OpenPointers } from "./open-pointers";
import { PENDING } from "./pending";
import {
  EMPTY_SNAPSHOT,
  NOTHING_PENDING,
  type PartialDocument,
  stampRun,
  type StreamError,
  type StreamRun,
  type StreamSnapshot,
} from "./snapshot";

/**
 * A stateful, incremental ViewSpec parser. `push` takes the next chunk and
 * returns the new snapshot; closed subtrees keep their identity across
 * snapshots. A leading Markdown fence (```json) and a closing one are skipped.
 */
export interface ViewSpecParser {
  push(chunk: string): StreamSnapshot;
  /** No more text: an open document becomes a `stream-incomplete` error. */
  end(): StreamSnapshot;
  /** Back to an empty document, for text that changed rather than grew. */
  reset(): void;
  readonly snapshot: StreamSnapshot;
}

export function createViewSpecParser(): ViewSpecParser {
  return new Parser();
}

/** The snapshot for `text` as a prefix of a document (no `end()`). */
export function parsePartialViewSpec(text: string): StreamSnapshot {
  return new Parser().push(text);
}

// ---------------------------------------------------------------------------
// Grammar: where nodes sit, and when an open one may be shown.

/**
 * `document`: the top object. `node`: an object where a ViewNode goes.
 * `children`: a component node's `children` array (its strings are text
 * children). `value`: anything else.
 */
type Role = "document" | "node" | "children" | "value";

/**
 * An open node is shown once its required head keys have closed and either
 * every head key has closed or a body key has begun; the body then streams.
 * Keys out of `order` (or unknown) hold the node back until it closes.
 */
interface NodeGrammar {
  readonly order: readonly string[];
  readonly required: readonly string[];
  readonly head: readonly string[];
  readonly body: ReadonlySet<string>;
}

function grammar(order: readonly string[], required: number, head: number): NodeGrammar {
  return { order, required: order.slice(0, required), head: order.slice(0, head), body: new Set(order.slice(head)) };
}

/** By a node's first key. A node led by anything else (`$ref`, `$format`) shows only once closed. */
const GRAMMARS: ReadonlyMap<string, NodeGrammar> = new Map([
  ["component", grammar(COMPONENT_NODE_KEYS, 1, 2)],
  ["$each", grammar(EACH_NODE_KEYS, 2, 3)],
  ["$cond", grammar(COND_NODE_KEYS, 1, 1)],
]);

/** Keys whose object value sits in a node position, by the node's first key. */
const NODE_POSITIONS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["$each", new Set(["node"])],
  ["$cond", new Set(["then", "else"])],
]);

interface Frame {
  readonly array: boolean;
  readonly role: Role;
  /** Objects: every key so far; the last one's value is open while `keys` outruns `values`. */
  readonly keys: string[];
  /** Closed members, append-only: a snapshot slices them to the length it saw. */
  readonly values: unknown[];
  /** Nodes: the first key, which picks the grammar. */
  firstKey: string | undefined;
  grammar: NodeGrammar | undefined;
  lastKeyIndex: number;
  /** A key out of order arrived before the node was shown: it waits until it closes. */
  waiting: boolean;
  ready: boolean;
  /** Bumped whenever a member closes or `ready` flips: a view built at one rev is valid for it. */
  rev: number;
  cache: { readonly rev: number; readonly child: unknown; readonly view: unknown } | undefined;
}

function newFrame(array: boolean, role: Role): Frame {
  return {
    array,
    role,
    keys: [],
    values: [],
    firstKey: undefined,
    grammar: undefined,
    lastKeyIndex: -1,
    waiting: false,
    ready: false,
    rev: 0,
    cache: undefined,
  };
}

function openKeyOf(frame: Frame): string | undefined {
  return frame.keys.length > frame.values.length ? frame.keys[frame.values.length] : undefined;
}

function roleOfChild(parent: Frame, array: boolean): Role {
  if (parent.role === "children") return array ? "value" : "node";
  const key = openKeyOf(parent);
  if (parent.role === "document") return !array && key === "root" ? "node" : "value";
  if (parent.role !== "node" || key === undefined || parent.firstKey === undefined) return "value";
  if (parent.firstKey === "component" && key === "children") return array ? "children" : "value";
  return !array && NODE_POSITIONS.get(parent.firstKey)?.has(key) === true ? "node" : "value";
}

/** Whether a frame's view includes its open member. */
function showsOpenMember(frame: Frame, ready: boolean, openKey: string | undefined): boolean {
  if (frame.role !== "node") return true;
  return ready && openKey !== undefined && frame.grammar?.body.has(openKey) === true;
}

function setMember(target: Record<string, unknown>, key: string, value: unknown): void {
  // An own `__proto__` member, as JSON.parse makes it, never the prototype.
  if (key === "__proto__") Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
  else target[key] = value;
}

function objectOf(frame: Frame, length: number): Record<string, unknown> {
  const target: Record<string, unknown> = {};
  for (let index = 0; index < length; index += 1) {
    const key = frame.keys[index];
    if (key !== undefined) setMember(target, key, frame.values[index]);
  }
  return target;
}

// ---------------------------------------------------------------------------
// Snapshots: captured eagerly in O(depth), built on first read.

/** No open member yet (a key, or nothing, after the last comma). */
const ABSENT: unique symbol = Symbol("absent");

interface CapturedFrame {
  readonly frame: Frame;
  readonly rev: number;
  readonly length: number;
  readonly openKey: string | undefined;
  readonly ready: boolean;
}

interface CapturedLeaf {
  /** Partial text for a text child; undefined shows as `PENDING`. */
  readonly text: string | undefined;
  readonly trailingHigh: boolean;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function leafView(leaf: CapturedLeaf | undefined): unknown {
  if (leaf === undefined) return ABSENT;
  if (leaf.text === undefined) return PENDING;
  // A high surrogate at the end may be half of a pair still arriving.
  return leaf.trailingHigh ? leaf.text.slice(0, -1) : leaf.text;
}

/** The view of the open spine, deepest first; the document frame's view is the spec. */
function materialize(spine: readonly CapturedFrame[], leaf: CapturedLeaf | undefined): PartialDocument | undefined {
  // Nothing below the shallowest node still held back is visible.
  const held = spine.findIndex(({ frame, ready }) => frame.role === "node" && !ready);
  let child: unknown = held === -1 ? leafView(leaf) : PENDING;
  for (let depth = (held === -1 ? spine.length : held) - 1; depth >= 0; depth -= 1) {
    const captured = spine[depth];
    if (captured === undefined) continue;
    const { frame } = captured;
    const shown = showsOpenMember(frame, captured.ready, captured.openKey) ? child : ABSENT;
    const cache = frame.cache;
    if (cache !== undefined && cache.rev === captured.rev && Object.is(cache.child, shown)) {
      child = cache.view;
      continue;
    }
    let view: unknown;
    if (frame.array) {
      const items = frame.values.slice(0, captured.length);
      if (shown !== ABSENT) items.push(shown);
      view = items;
    } else {
      const target = objectOf(frame, captured.length);
      if (shown !== ABSENT && captured.openKey !== undefined) setMember(target, captured.openKey, shown);
      view = target;
    }
    frame.cache = { rev: captured.rev, child: shown, view };
    child = view;
  }
  return isPlainObject(child) ? child : undefined;
}

// ---------------------------------------------------------------------------
// The lexer: one state machine over characters, never recursing.

const enum Mode {
  Lead,
  FenceTicks,
  FenceInfo,
  AfterFence,
  Value,
  ArrayFirst,
  ObjectFirst,
  ObjectKey,
  Colon,
  AfterValue,
  String,
  Number,
  Literal,
  Done,
  TrailTicks,
  TrailSpace,
}

const QUOTE = 0x22;
const PLUS = 0x2b;
const COMMA = 0x2c;
const MINUS = 0x2d;
const DOT = 0x2e;
const ZERO = 0x30;
const COLON = 0x3a;
const UPPER_E = 0x45;
const OPEN_BRACKET = 0x5b;
const BACKSLASH = 0x5c;
const CLOSE_BRACKET = 0x5d;
const BACKTICK = 0x60;
const LOWER_E = 0x65;
const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;

const ESCAPES: ReadonlyMap<string, string> = new Map([
  ['"', '"'],
  ["\\", "\\"],
  ["/", "/"],
  ["b", "\b"],
  ["f", "\f"],
  ["n", "\n"],
  ["r", "\r"],
  ["t", "\t"],
]);

const LITERALS: ReadonlyMap<string, readonly [string, unknown]> = new Map<string, readonly [string, unknown]>([
  ["t", ["true", true]],
  ["f", ["false", false]],
  ["n", ["null", null]],
]);

function isDigit(code: number): boolean {
  return code >= ZERO && code <= 0x39;
}

function hexValue(code: number): number {
  if (isDigit(code)) return code - ZERO;
  const lower = code | 0x20;
  return lower >= 0x61 && lower <= 0x66 ? lower - 0x61 + 10 : -1;
}

/**
 * How far a number's text has got. `Rejected`: the character ends the number
 * (which must then be in a terminal state); `LeadingZero`: a digit after a
 * lone `0`, which JSON forbids.
 */
const enum NumberState {
  LeadingZero = -2,
  Rejected = -1,
  /** After `-`. */
  Sign,
  /** A lone `0`. */
  Zero,
  Integer,
  /** After `.`. */
  Dot,
  Fraction,
  /** After `e` or `E`. */
  Exponent,
  ExponentSign,
  ExponentDigits,
}

const NUMBER_TERMINAL: ReadonlySet<NumberState> = new Set([
  NumberState.Zero,
  NumberState.Integer,
  NumberState.Fraction,
  NumberState.ExponentDigits,
]);

function nextNumberState(state: NumberState, code: number): NumberState {
  const digit = isDigit(code);
  const dot = code === DOT;
  const exponent = code === LOWER_E || code === UPPER_E;
  switch (state) {
    case NumberState.Sign:
      return code === ZERO ? NumberState.Zero : digit ? NumberState.Integer : NumberState.Rejected;
    case NumberState.Zero:
      return dot ? NumberState.Dot : exponent ? NumberState.Exponent : digit ? NumberState.LeadingZero : NumberState.Rejected;
    case NumberState.Integer:
      return digit ? NumberState.Integer : dot ? NumberState.Dot : exponent ? NumberState.Exponent : NumberState.Rejected;
    case NumberState.Dot:
      return digit ? NumberState.Fraction : NumberState.Rejected;
    case NumberState.Fraction:
      return digit ? NumberState.Fraction : exponent ? NumberState.Exponent : NumberState.Rejected;
    case NumberState.Exponent:
      return code === PLUS || code === MINUS ? NumberState.ExponentSign : digit ? NumberState.ExponentDigits : NumberState.Rejected;
    case NumberState.ExponentSign:
    case NumberState.ExponentDigits:
      return digit ? NumberState.ExponentDigits : NumberState.Rejected;
    default:
      return NumberState.Rejected;
  }
}

/** The character at `index`, quoted, for an error message. */
function describeAt(chunk: string, index: number): string {
  const char = chunk[index] ?? "";
  return char === "" ? "end of text" : JSON.stringify(char);
}

class Parser implements ViewSpecParser {
  private mode = Mode.Lead;
  private stack: Frame[] = [];
  /** The key or index of each frame but the document's, in step with `stack`. */
  private tokens: (string | number)[] = [];
  /** Characters before the current chunk; `jsonStart` is where the fence-stripped text begins. */
  private consumed = 0;
  private jsonStart = 0;
  private ticks = 0;

  private stringIsKey = false;
  private stringText = "";
  private trailingHigh = false;
  /** 0: plain; 1: after a backslash; 2–5: inside `\u`, that many digits read plus two. */
  private escape = 0;
  private unicode = 0;
  /** The open string value, number or literal: `textChild` strings show as partial text. */
  private leaf: { readonly token: string | number; readonly textChild: boolean } | undefined;

  private numberText = "";
  private numberState = NumberState.Sign;
  private literal: readonly [string, unknown] = ["", null];
  private literalIndex = 0;

  private root: PartialDocument | undefined;
  private complete = false;
  private ended = false;
  private error: StreamError | undefined;
  private changed = false;
  private current: StreamSnapshot = EMPTY_SNAPSHOT;
  /** Stamped on every snapshot of this document (`runOf`); a reset starts a new one. */
  private run: StreamRun = {};

  get snapshot(): StreamSnapshot {
    return this.current;
  }

  reset(): void {
    this.mode = Mode.Lead;
    this.stack = [];
    this.tokens = [];
    this.consumed = 0;
    this.jsonStart = 0;
    this.ticks = 0;
    this.escape = 0;
    this.leaf = undefined;
    this.root = undefined;
    this.complete = false;
    this.ended = false;
    this.error = undefined;
    this.changed = false;
    this.current = EMPTY_SNAPSHOT;
    this.run = {};
  }

  end(): StreamSnapshot {
    if (this.ended || this.error !== undefined) {
      this.ended = true;
      return this.current;
    }
    this.ended = true;
    if (this.complete) {
      if (this.mode === Mode.TrailTicks && this.ticks < 3) return this.fail(0, "A closing code fence needs three backticks.");
      return this.current;
    }
    this.error = {
      code: "stream-incomplete",
      message: "The stream ended before the document closed.",
      offset: Math.max(0, this.consumed - this.jsonStart),
    };
    return (this.current = this.capture());
  }

  push(chunk: string): StreamSnapshot {
    if (this.ended || this.error !== undefined) return this.current;
    const length = chunk.length;
    let index = 0;
    while (index < length) {
      const code = chunk.charCodeAt(index);
      switch (this.mode) {
        case Mode.Lead:
          if (isJsonWhitespace(code)) index += 1;
          else if (code === BACKTICK) {
            this.ticks = 0;
            this.mode = Mode.FenceTicks;
          } else if (code === OPEN_BRACE) {
            this.openRoot();
            index += 1;
          } else return this.fail(index, `Expected "{" to start the document, found ${describeAt(chunk, index)}.`);
          break;

        case Mode.FenceTicks:
          if (code === BACKTICK) {
            this.ticks += 1;
            index += 1;
          } else if (this.ticks >= 3) this.mode = Mode.FenceInfo;
          else return this.fail(index, "A code fence needs three backticks.");
          break;

        case Mode.FenceInfo: {
          const newline = chunk.indexOf("\n", index);
          if (newline === -1) index = length;
          else {
            index = newline + 1;
            this.mode = Mode.AfterFence;
          }
          break;
        }

        case Mode.AfterFence:
          if (isJsonWhitespace(code)) index += 1;
          else {
            this.jsonStart = this.consumed + index;
            if (code !== OPEN_BRACE) return this.fail(index, `Expected "{" to start the document, found ${describeAt(chunk, index)}.`);
            this.openRoot();
            index += 1;
          }
          break;

        case Mode.Value:
        case Mode.ArrayFirst:
          if (isJsonWhitespace(code)) index += 1;
          else if (code === CLOSE_BRACKET && this.mode === Mode.ArrayFirst) {
            this.closeContainer();
            index += 1;
          } else if ((code === OPEN_BRACE || code === OPEN_BRACKET) && this.stack.length >= LIMITS.jsonDepth) {
            return this.fail(index, `Arrays and objects nest more than ${LIMITS.jsonDepth} deep.`, "too-deep");
          } else {
            if (!this.startValue(code)) return this.fail(index, `Expected a value, found ${describeAt(chunk, index)}.`);
            index += 1;
          }
          break;

        case Mode.ObjectFirst:
        case Mode.ObjectKey:
          if (isJsonWhitespace(code)) index += 1;
          else if (code === CLOSE_BRACE && this.mode === Mode.ObjectFirst) {
            this.closeContainer();
            index += 1;
          } else if (code === QUOTE) {
            this.startString(true);
            index += 1;
          } else return this.fail(index, `Expected a key in double quotes, found ${describeAt(chunk, index)}.`);
          break;

        case Mode.Colon:
          if (isJsonWhitespace(code)) index += 1;
          else if (code === COLON) {
            this.mode = Mode.Value;
            index += 1;
          } else return this.fail(index, `Expected ":" after a key, found ${describeAt(chunk, index)}.`);
          break;

        case Mode.AfterValue: {
          if (isJsonWhitespace(code)) {
            index += 1;
            break;
          }
          const array = this.stack[this.stack.length - 1]?.array === true;
          if (code === COMMA) this.mode = array ? Mode.Value : Mode.ObjectKey;
          else if (code === (array ? CLOSE_BRACKET : CLOSE_BRACE)) this.closeContainer();
          else return this.fail(index, `Expected "," or "${array ? "]" : "}"}", found ${describeAt(chunk, index)}.`);
          index += 1;
          break;
        }

        case Mode.String: {
          if (this.escape === 0) {
            const start = index;
            let scan = code;
            while (index < length && scan !== QUOTE && scan !== BACKSLASH && scan >= 0x20) {
              index += 1;
              scan = chunk.charCodeAt(index);
            }
            if (index > start) this.appendText(chunk.slice(start, index), chunk.charCodeAt(index - 1));
            if (index === length) break;
            if (scan === QUOTE) {
              index += 1;
              this.endString();
            } else if (scan === BACKSLASH) {
              index += 1;
              this.escape = 1;
            } else return this.fail(index, "A string holds a raw control character; escape it.");
          } else if (this.escape === 1) {
            const char = chunk[index] ?? "";
            index += 1;
            if (char === "u") {
              this.escape = 2;
              this.unicode = 0;
            } else {
              const escaped = ESCAPES.get(char);
              if (escaped === undefined) return this.fail(index - 1, `Unknown escape "\\${char}".`);
              this.escape = 0;
              this.appendText(escaped, escaped.charCodeAt(0));
            }
          } else {
            const digit = hexValue(code);
            if (digit < 0) return this.fail(index, "A \\u escape needs four hex digits.");
            index += 1;
            this.unicode = this.unicode * 16 + digit;
            this.escape += 1;
            if (this.escape === 6) {
              this.escape = 0;
              this.appendText(String.fromCharCode(this.unicode), this.unicode);
            }
          }
          break;
        }

        case Mode.Number: {
          const next = nextNumberState(this.numberState, code);
          if (next === NumberState.LeadingZero) return this.fail(index, "A number cannot have a leading zero.");
          if (next !== NumberState.Rejected) {
            this.numberState = next;
            this.numberText += chunk[index] ?? "";
            index += 1;
          } else if (!NUMBER_TERMINAL.has(this.numberState)) return this.fail(index, `Malformed number "${this.numberText}".`);
          else this.finishValue(Number(this.numberText));
          break;
        }

        case Mode.Literal: {
          const [word, value] = this.literal;
          if (code !== word.charCodeAt(this.literalIndex)) return this.fail(index, `Expected "${word}".`);
          index += 1;
          this.literalIndex += 1;
          if (this.literalIndex === word.length) this.finishValue(value);
          break;
        }

        case Mode.Done:
          if (isJsonWhitespace(code)) index += 1;
          else if (code === BACKTICK) {
            this.ticks = 0;
            this.mode = Mode.TrailTicks;
          } else return this.fail(index, `Unexpected text after the document: ${describeAt(chunk, index)}.`);
          break;

        case Mode.TrailTicks:
          if (code === BACKTICK) {
            this.ticks += 1;
            index += 1;
          } else if (this.ticks >= 3) this.mode = Mode.TrailSpace;
          else return this.fail(index, "A closing code fence needs three backticks.");
          break;

        case Mode.TrailSpace:
          if (!isJsonWhitespace(code)) return this.fail(index, "Unexpected text after the closing code fence.");
          index += 1;
          break;
      }
    }
    this.consumed += length;
    if (this.changed) {
      this.changed = false;
      this.current = this.capture();
    }
    return this.current;
  }

  // -------------------------------------------------------------------------

  private fail(index: number, message: string, code: StreamError["code"] = "invalid-json"): StreamSnapshot {
    this.error = { code, message, offset: Math.max(0, this.consumed + index - this.jsonStart) };
    this.changed = false;
    return (this.current = this.capture());
  }

  private capture(): StreamSnapshot {
    return stampRun(this.view(), this.run);
  }

  private view(): StreamSnapshot {
    const error = this.error === undefined ? {} : { error: this.error };
    if (this.complete) return { spec: this.root, complete: true, pending: NOTHING_PENDING, ...error };
    if (this.stack.length === 0) return { ...EMPTY_SNAPSHOT, ...error };

    const spine: CapturedFrame[] = this.stack.map((frame) => ({
      frame,
      rev: frame.rev,
      length: frame.values.length,
      openKey: openKeyOf(frame),
      ready: frame.ready,
    }));
    const open = this.leaf;
    const leaf: CapturedLeaf | undefined =
      open === undefined
        ? undefined
        : {
            text: open.textChild ? this.stringText : undefined,
            trailingHigh: this.trailingHigh,
          };
    const pending = new OpenPointers(open === undefined ? [...this.tokens] : [...this.tokens, open.token]);
    let spec: PartialDocument | undefined;
    return {
      get spec() {
        return (spec ??= materialize(spine, leaf));
      },
      complete: false,
      pending,
      ...error,
    };
  }

  private top(): Frame | undefined {
    return this.stack[this.stack.length - 1];
  }

  private openRoot(): void {
    this.stack.push(newFrame(false, "document"));
    this.mode = Mode.ObjectFirst;
    this.changed = true;
  }

  /** The token of the value about to start in the top frame. */
  private tokenOf(parent: Frame): string | number {
    return parent.array ? parent.values.length : (openKeyOf(parent) ?? "");
  }

  private startValue(code: number): boolean {
    const parent = this.top();
    if (parent === undefined) return false;
    if (code === OPEN_BRACE || code === OPEN_BRACKET) {
      const array = code === OPEN_BRACKET;
      this.tokens.push(this.tokenOf(parent));
      this.stack.push(newFrame(array, roleOfChild(parent, array)));
      this.mode = array ? Mode.ArrayFirst : Mode.ObjectFirst;
    } else if (code === QUOTE) {
      this.leaf = { token: this.tokenOf(parent), textChild: parent.role === "children" };
      this.startString(false);
    } else if (code === MINUS || isDigit(code)) {
      this.leaf = { token: this.tokenOf(parent), textChild: false };
      this.numberState = code === MINUS ? NumberState.Sign : nextNumberState(NumberState.Sign, code);
      this.numberText = String.fromCharCode(code);
      this.mode = Mode.Number;
    } else {
      const literal = LITERALS.get(String.fromCharCode(code));
      if (literal === undefined) return false;
      this.leaf = { token: this.tokenOf(parent), textChild: false };
      this.literal = literal;
      this.literalIndex = 1;
      this.mode = Mode.Literal;
    }
    this.changed = true;
    return true;
  }

  private startString(key: boolean): void {
    this.stringIsKey = key;
    this.stringText = "";
    this.trailingHigh = false;
    this.escape = 0;
    this.mode = Mode.String;
  }

  private appendText(text: string, lastCode: number): void {
    this.stringText += text;
    this.trailingHigh = isHighSurrogate(lastCode);
    if (this.leaf?.textChild === true) this.changed = true;
  }

  private endString(): void {
    if (!this.stringIsKey) {
      this.finishValue(this.stringText);
      return;
    }
    const frame = this.top();
    this.mode = Mode.Colon;
    if (frame === undefined) return;
    const key = this.stringText;
    frame.keys.push(key);
    if (frame.role !== "node") return;
    if (frame.firstKey === undefined) {
      frame.firstKey = key;
      frame.grammar = GRAMMARS.get(key);
    }
    const order = frame.grammar?.order.indexOf(key) ?? -1;
    if (order <= frame.lastKeyIndex) frame.waiting = true;
    else frame.lastKeyIndex = order;
    this.checkReady(frame);
  }

  private finishValue(value: unknown): void {
    this.leaf = undefined;
    this.mode = Mode.AfterValue;
    this.changed = true;
    const frame = this.top();
    if (frame === undefined) return;
    frame.values.push(value);
    frame.rev += 1;
    if (frame.role === "node") this.checkReady(frame);
  }

  private closeContainer(): void {
    const frame = this.stack.pop();
    if (frame === undefined) return;
    this.tokens.pop();
    if (this.stack.length > 0) {
      this.finishValue(frame.array ? frame.values : objectOf(frame, frame.values.length));
      return;
    }
    this.root = objectOf(frame, frame.values.length);
    this.complete = true;
    this.mode = Mode.Done;
    this.changed = true;
  }

  private checkReady(frame: Frame): void {
    const rules = frame.grammar;
    if (frame.ready || frame.waiting || rules === undefined) return;
    const closed = frame.keys.slice(0, frame.values.length);
    if (!rules.required.every((key) => closed.includes(key))) return;
    const open = openKeyOf(frame);
    const ready = open === undefined ? rules.head.every((key) => closed.includes(key)) : rules.body.has(open);
    if (!ready) return;
    frame.ready = true;
    frame.rev += 1;
    this.changed = true;
  }
}
