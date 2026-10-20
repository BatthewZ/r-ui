/**
 * Prop values resolved for a component: `$ref`, `$format` and `$node`
 * markers wherever they sit, handlers under `on…` keys turned into callbacks
 * on the runtime's dispatcher. What a `$ref` reaches is data: it is returned
 * as it is and never resolved again. A literal with nothing to resolve keeps
 * its identity, so a re-render hands a component the same object.
 */

import { isFormatMarker, isHandler, isNodeMarker, isPlainObject, isRefMarker } from "../spec/guards";
import { LIMITS } from "../spec/policy";
import { appendPointer } from "../spec/pointer";
import {
  type EventValueKind,
  FORBIDDEN_SEGMENTS,
  type FormatMarker,
  type Handler,
  HANDLER_KEY_PATTERN,
  type IssueCode,
} from "../spec/types";
import { reportIssue } from "./diagnostic";
import { formatWith, toFormatOptions } from "./format";
import type { Slot } from "./memo";
import { DROP, setOwn } from "./prop-path";
import { propNodeScope, refScopeOf, type Scope } from "./scope";
import type { RenderAt } from "./templates";
import { readValue, valueText } from "./text";

const FORBIDDEN: ReadonlySet<string> = new Set<string>(FORBIDDEN_SEGMENTS);

/** A `$node` in a prop: its parent never reads it as a child, so it may carry a boundary. */
const PROP_NODE_SLOT: Slot = { boundary: true, structural: false };

function ignore(): void {}

/**
 * A handler as the callback a component calls. It returns the dispatch's
 * promise (EmailCapture and a form submit wait on it) with a rejection
 * handler attached, so a caller that ignores it raises no unhandled rejection.
 */
export function handlerCallback(
  handler: Handler,
  scope: Scope,
  path: string,
  eventValue?: EventValueKind,
): (...args: unknown[]) => Promise<void> {
  return (...args: unknown[]) => {
    const done = scope.ctx.dispatch(handler, { args, vars: scope.vars, path, eventValue });
    done.catch(ignore);
    return done;
  };
}

export class PropResolver {
  constructor(
    readonly scope: Scope,
    readonly render: RenderAt,
  ) {}

  drop(code: IssueCode, path: string, message: string): typeof DROP {
    reportIssue(this.scope, code, path, message);
    return DROP;
  }

  /** `value` resolved at `path` (a JSON Pointer under the node's props). */
  resolve(value: unknown, path: string, depth = 0): unknown {
    if (depth > LIMITS.depth) {
      this.drop("limit-exceeded", path, `Props nest deeper than ${LIMITS.depth} levels; the rest is dropped.`);
      return undefined;
    }
    if (isRefMarker(value)) return readValue(value.$ref, refScopeOf(this.scope));
    if (isFormatMarker(value)) return this.format(value, path, depth);
    if (isNodeMarker(value)) {
      const nodePath = appendPointer(path, "$node");
      return this.render(value.$node, propNodeScope(this.scope, nodePath), PROP_NODE_SLOT);
    }
    if (Array.isArray(value)) {
      let changed = false;
      const out = value.map((item: unknown, index) => {
        const next = this.resolve(item, appendPointer(path, index), depth + 1);
        if (next !== item) changed = true;
        return next;
      });
      return changed ? out : value;
    }
    if (!isPlainObject(value)) return value;
    let copy: Record<string, unknown> | undefined;
    for (const key of Object.keys(value)) {
      const item = value[key];
      const keyPath = appendPointer(path, key);
      let next: unknown;
      if (FORBIDDEN.has(key)) next = this.drop("forbidden-prop", keyPath, `\`${key}\` is never passed on.`);
      else if (HANDLER_KEY_PATTERN.test(key)) {
        next = isHandler(item)
          ? handlerCallback(item, this.scope, keyPath)
          : this.drop("forbidden-prop", keyPath, `\`${key}\` holds no action, so it is dropped.`);
      } else next = this.resolve(item, keyPath, depth + 1);
      if (next === item) continue;
      copy ??= { ...value };
      if (next === DROP) delete copy[key];
      else setOwn(copy, key, next);
    }
    return copy ?? value;
  }

  /** A `$format` marker's text. */
  format(marker: FormatMarker, path: string, depth = 0): string {
    const markerPath = appendPointer(path, "$format");
    const { value, ...spec } = marker.$format;
    const resolved = this.resolve(value, appendPointer(markerPath, "value"), depth + 1);
    const options = toFormatOptions(spec);
    if (options === null) {
      this.drop("invalid-prop-value", markerPath, "A `$format` needs a `style`; the value shows unformatted.");
      return valueText(resolved) ?? "";
    }
    return formatWith(resolved, options, this.scope.env.locale);
  }
}
