import type { FormRegistry } from "../forms/registry";
import { errorMessage } from "../spec/errors";
import { isAction, isHandler, isName, isOneOf, isPlainObject, ownValue } from "../spec/guards";
import { appendPointer } from "../spec/pointer";
import { LIMITS } from "../spec/policy";
import { makeIssue } from "../spec/issue";
import { HTTP_METHODS, type IssueCode, type JsonValue, LITERAL_PAYLOAD_KEYS, TOAST_TONES } from "../spec/types";
import { resolveUrl, safeUrl } from "../spec/url-policy";
import type { RendererAdapters } from "./adapters";
import type { ActionDispatcher, DialogState, IssueReporter, RefRoots, ResolvedPolicy } from "./context";
import { readEventArgs, readEventValue } from "./event-value";
import { performRequest, prepareRequest, UNUSABLE_QUERY } from "./request";
import { type FormatValue, plainFormat, type RefScope, resolveValue, valueText } from "./resolve";
import type { SetStateOptions } from "./state";

export interface DispatcherDeps {
  /** The latest values, read when a handler runs (never a render-time copy). */
  readonly getRoots: () => RefRoots;
  /** Returns false when `path` is not a `state.…` path. */
  readonly setState: (path: string, value: unknown, options?: SetStateOptions) => boolean;
  readonly forms: FormRegistry;
  readonly dialogs: DialogState;
  /** The host's adapters as of the latest render. */
  readonly getAdapters: () => RendererAdapters;
  /** The host's policy as of the latest render. */
  readonly getPolicy: () => ResolvedPolicy;
  readonly report: IssueReporter;
  readonly isComplete: () => boolean;
  /** `$format` in payloads; without it a value formats as plain text. */
  readonly format?: FormatValue;
}

/** What `onError` sees as `event.value`, and what a failed `apiCall` rejects with. */
export interface ActionErrorValue {
  readonly status: number | null;
  readonly message: string;
  readonly body: JsonValue;
}

/**
 * Why a handler stopped. Already reported to the issue channel (or, for a
 * form that did not submit, shown by the form): a caller only needs to catch
 * it. `response` is set when an `apiCall` failed.
 */
export class ActionFailure extends Error {
  readonly response: ActionErrorValue | undefined;

  constructor(message: string, response?: ActionErrorValue) {
    super(message);
    this.name = "ActionFailure";
    this.response = response;
  }
}

type EventScope = { readonly value: unknown; readonly args: readonly unknown[] };

export function createActionDispatcher(deps: DispatcherDeps): ActionDispatcher {
  const format = deps.format ?? plainFormat;

  function fail(code: IssueCode, path: string, message: string): never {
    deps.report(makeIssue(code, path, message));
    throw new ActionFailure(message);
  }

  function scopeFor(vars: RefScope, event: EventScope): RefScope {
    return { ...vars, ...deps.getRoots(), event };
  }

  async function runHandler(handler: unknown, path: string, vars: RefScope, event: EventScope, depth: number): Promise<void> {
    const list: readonly unknown[] = Array.isArray(handler) ? handler : [handler];
    if (list.length > LIMITS.actionsPerHandler) {
      deps.report(makeIssue("limit-exceeded", path, `A handler runs at most ${LIMITS.actionsPerHandler} actions; the rest did not run.`));
    }
    const actions = list.slice(0, LIMITS.actionsPerHandler);
    for (const [index, action] of actions.entries()) {
      const actionPath = Array.isArray(handler) ? appendPointer(path, index) : path;
      try {
        await runAction(action, actionPath, vars, event, depth);
      } catch (error) {
        if (error instanceof ActionFailure) throw error;
        fail("action-failed", actionPath, errorMessage(error));
      }
    }
  }

  /** `onSuccess`/`onError`: their own `event`, the same local names, one level deeper. */
  async function runChained(handler: unknown, path: string, vars: RefScope, value: unknown, depth: number): Promise<void> {
    if (handler === undefined) return;
    if (!isHandler(handler)) fail("invalid-value", path, "Not an action or a list of actions.");
    if (depth > LIMITS.actionDepth) {
      deps.report(makeIssue("limit-exceeded", path, `onSuccess/onError nest at most ${LIMITS.actionDepth} deep; this one did not run.`));
      return;
    }
    await runHandler(handler, path, vars, { value, args: [value] }, depth);
  }

  async function runAction(action: unknown, path: string, vars: RefScope, event: EventScope, depth: number): Promise<void> {
    if (!isAction(action)) fail("invalid-value", path, "Not an action.");
    const payload: Record<string, unknown> = isPlainObject(action.payload) ? action.payload : {};
    const payloadPath = appendPointer(path, "payload");
    const at = (key: string) => appendPointer(payloadPath, key);
    const literal: readonly string[] = LITERAL_PAYLOAD_KEYS[action.action];
    const read = (key: string): unknown => {
      const value = ownValue(payload, key);
      return value === undefined || literal.includes(key) ? value : resolveValue(value, scopeFor(vars, event), format);
    };

    switch (action.action) {
      case "setState": {
        const target = read("path");
        if (typeof target !== "string" || !deps.setState(target, read("value"), { replace: read("replace") === true })) {
          fail("invalid-ref", at("path"), "setState writes to a `state.…` path, and into a list at most one past its end.");
        }
        return;
      }
      case "submitForm":
      case "resetForm": {
        const name = read("form");
        const form = typeof name === "string" ? deps.forms.get(name) : undefined;
        if (form === undefined) fail("undeclared-name", at("form"), `No form named ${JSON.stringify(name)} is in this view.`);
        if (action.action === "resetForm") {
          form.reset();
          return;
        }
        // The form shows why it did not submit; the rest of the list must not run.
        if (!(await form.submit())) throw new ActionFailure("The form did not submit.");
        return;
      }
      case "navigate":
        return navigate(read("to"), read("replace") === true, path, at("to"));
      case "showToast": {
        const title = valueText(read("title")) ?? undefined;
        if (title === undefined) fail("invalid-value", at("title"), "showToast needs a text `title`.");
        const description = valueText(read("description")) ?? undefined;
        const tone = read("tone");
        const { toast } = deps.getAdapters();
        if (toast === undefined) {
          deps.report(makeIssue("missing-adapter", path, "The host provides no `toast` adapter; the toast was not shown."));
          return;
        }
        toast({
          title,
          ...(description === undefined ? {} : { description }),
          ...(isOneOf(TOAST_TONES, tone) ? { tone } : {}),
        });
        return;
      }
      case "apiCall":
        return apiCall(read, path, at, vars, depth);
      case "openDialog":
      case "closeDialog": {
        const dialogId = read("dialogId");
        if (!isName(dialogId)) {
          fail("invalid-name", at("dialogId"), "`dialogId` is a name.");
        }
        deps.dialogs.setOpen(dialogId, action.action === "openDialog");
        return;
      }
    }
  }

  function navigate(to: unknown, replace: boolean, path: string, toPath: string): void {
    const safe = typeof to === "string" ? safeUrl(to) : "";
    const url = safe === "" ? null : resolveUrl(safe);
    if (url === null) fail("refused-url", toPath, "navigate needs a URL with an allowed scheme.");
    if (!deps.getPolicy().allowUrl(url)) fail("refused-url", toPath, `Navigation to ${url.origin} is not allowed.`);
    const adapter = deps.getAdapters().navigate;
    if (adapter === undefined) {
      deps.report(makeIssue("missing-adapter", path, "The host provides no `navigate` adapter; nothing navigated."));
      return;
    }
    adapter(url.href, { replace });
  }

  async function apiCall(
    read: (key: string) => unknown,
    path: string,
    at: (key: string) => string,
    vars: RefScope,
    depth: number,
  ): Promise<void> {
    const endpoint = read("endpoint");
    const method = read("method") ?? "GET";
    if (typeof endpoint !== "string") fail("invalid-value", at("endpoint"), "apiCall needs an `endpoint`.");
    if (!isOneOf(HTTP_METHODS, method)) {
      fail("invalid-value", at("method"), `\`method\` is one of ${HTTP_METHODS.join(", ")}.`);
    }
    const fetcher = deps.getAdapters().fetch;
    if (fetcher === undefined) fail("missing-adapter", path, "The host provides no `fetch` adapter; nothing was sent.");
    const prepared = prepareRequest({ endpoint, method, query: read("query"), body: read("body") }, deps.getPolicy().allowUrl);
    if (!prepared.ok) fail("refused-url", at("endpoint"), prepared.message);
    for (const param of prepared.unusable) deps.report(makeIssue("unusable-value", appendPointer(at("query"), param), UNUSABLE_QUERY));

    const outcome = await performRequest(fetcher, prepared.url, prepared.init);
    const payloadPath = appendPointer(path, "payload");
    if (outcome.ok) {
      const into = read("into");
      if (into !== undefined && (typeof into !== "string" || !deps.setState(into, outcome.body, { replace: true }))) {
        deps.report(makeIssue("invalid-ref", at("into"), "`into` is a `state.…` path; the response was not stored."));
      }
      await runChained(read("onSuccess"), appendPointer(payloadPath, "onSuccess"), vars, outcome.body, depth + 1);
      return;
    }

    const error: ActionErrorValue = { status: outcome.status, message: outcome.message, body: outcome.body };
    const onError = read("onError");
    if (onError === undefined) {
      deps.report(makeIssue("action-failed", path, outcome.message));
    } else {
      try {
        await runChained(onError, appendPointer(payloadPath, "onError"), vars, error, depth + 1);
      } catch {
        // Reported where it failed; the call's own failure is what rejects.
      }
    }
    throw new ActionFailure(outcome.message, error);
  }

  return (handler, context) => {
    if (!deps.isComplete()) return Promise.resolve();
    const kind = context.eventValue ?? "value";
    const event: EventScope = { value: readEventValue(context.args, kind), args: readEventArgs(context.args, kind) };
    return runHandler(handler, context.path, context.vars, event, 0);
  };
}
