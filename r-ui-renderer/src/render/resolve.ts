/**
 * Prop values resolved for a component: `$ref`, `$format`, `$concat` and
 * `$node` markers wherever they sit, handlers under `on…` keys turned into
 * callbacks on the runtime's dispatcher. A literal with nothing to resolve
 * keeps its identity, so a re-render hands a component the same object.
 */

import { MarkerResolver } from "../runtime/resolve";
import { isHandler } from "../spec/guards";
import { DROP } from "../spec/prop-path";
import { type EventValueKind, type Handler, HANDLER_KEY_PATTERN, type IssueCode } from "../spec/types";
import { reportIssue } from "./diagnostic";
import { formatWith } from "./format";
import type { Slot } from "./memo";
import { propNodeScope, refScopeOf, type Scope } from "./scope";
import type { RenderAt } from "./templates";

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

/**
 * Props' marker resolution: a `$node` renders where it sits, an `on…` key
 * holds a handler that becomes a callback, and every drop is reported at its
 * path. The rest is `MarkerResolver`'s, shared with action payloads.
 */
export class PropResolver extends MarkerResolver {
  constructor(
    readonly scope: Scope,
    readonly render: RenderAt,
  ) {
    super(
      () => refScopeOf(scope),
      (value, options) => formatWith(value, options, scope.env.locale),
    );
  }

  override drop(code: IssueCode, path: string, message: string): typeof DROP {
    reportIssue(this.scope, code, path, message);
    return DROP;
  }

  protected override node(node: unknown, path: string): unknown {
    return this.render(node, propNodeScope(this.scope, path), PROP_NODE_SLOT);
  }

  protected override entry(key: string, item: unknown, path: string, depth: number): unknown {
    if (!HANDLER_KEY_PATTERN.test(key)) return super.entry(key, item, path, depth);
    return isHandler(item) ? handlerCallback(item, this.scope, path) : this.drop("forbidden-prop", path, `\`${key}\` holds no action, so it is dropped.`);
  }
}
