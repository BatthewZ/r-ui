import { useEffect, useMemo, useRef, useState } from "react";

import { sameEntries } from "../spec/equal";
import { isPlainObject } from "../spec/guards";
import { appendPointer } from "../spec/pointer";
import { makeIssue } from "../spec/issue";
import { type BindingStatus, type IssueCode, type JsonValue } from "../spec/types";
import type { RendererAdapters } from "./adapters";
import type { IssueReporter } from "./context";
import { toJsonValue } from "./event-value";
import { performRequest, prepareRequest, UNUSABLE_QUERY } from "./request";
import { plainFormat, resolveValue } from "./resolve";

export interface DataBindingsOptions {
  readonly adapters: RendererAdapters;
  /** For `$ref state.…` in `query`, `body` and `params`. */
  readonly state: { readonly [key: string]: unknown };
  /** JSON Pointers still open; a binding starts once its object has closed. */
  readonly pending: ReadonlySet<string>;
  readonly report: IssueReporter;
}

export interface DataSnapshot {
  readonly data: { readonly [name: string]: unknown };
  readonly status: { readonly [name: string]: BindingStatus };
}

type Outcome = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly message: string };

type Plan =
  | { readonly kind: "static"; readonly value: unknown }
  /** Still streaming. */
  | { readonly kind: "waiting" }
  /** Could not start; the issue is reported. */
  | { readonly kind: "refused" }
  /** `key` names the request: a new key aborts the old one and starts again. */
  | { readonly kind: "request"; readonly key: string; readonly run: (signal: AbortSignal) => Promise<Outcome> };

interface Result {
  readonly key: string;
  readonly outcome: Outcome;
}

/** `query`, `body` and `params` read `state.…` and nothing else. */
function resolveFromState(value: unknown, state: DataBindingsOptions["state"]): unknown {
  return resolveValue(value, { state }, plainFormat);
}

function planBinding(name: string, binding: unknown, options: DataBindingsOptions): Plan {
  const path = appendPointer("/data", name);
  const refuse = (code: IssueCode, message: string): Plan => {
    options.report(makeIssue(code, path, message));
    return { kind: "refused" };
  };
  if (!isPlainObject(binding)) return refuse("invalid-value", `Data binding "${name}" is not an object.`);
  const { adapters, state } = options;

  switch (binding.type) {
    case "static":
      return { kind: "static", value: binding.value };
    case "api": {
      const fetcher = adapters.fetch;
      if (fetcher === undefined) return refuse("missing-adapter", `The host provides no \`fetch\` adapter; "${name}" was not requested.`);
      const method = binding.method ?? "GET";
      if (method !== "GET" && method !== "POST") return refuse("invalid-value", `Data binding "${name}" uses GET or POST.`);
      if (typeof binding.endpoint !== "string") return refuse("invalid-value", `Data binding "${name}" needs an \`endpoint\`.`);
      const prepared = prepareRequest(
        {
          endpoint: binding.endpoint,
          method,
          query: resolveFromState(binding.query, state),
          body: resolveFromState(binding.body, state),
        },
        adapters,
      );
      if (!prepared.ok) return refuse("refused-url", prepared.message);
      const { url, init } = prepared;
      for (const param of prepared.unusable) {
        options.report(makeIssue("unusable-value", appendPointer(appendPointer(path, "query"), param), UNUSABLE_QUERY));
      }
      return {
        kind: "request",
        key: JSON.stringify(["api", url, init.method, init.body ?? null]),
        run: async (signal) => {
          const outcome = await performRequest(fetcher, url, { ...init, signal });
          return outcome.ok ? { ok: true, value: outcome.body } : { ok: false, message: outcome.message };
        },
      };
    }
    case "source": {
      const resolveSource = adapters.resolveSource;
      if (resolveSource === undefined) {
        return refuse("missing-adapter", `The host provides no \`resolveSource\` adapter; "${name}" was not loaded.`);
      }
      if (typeof binding.source !== "string") return refuse("invalid-value", `Data binding "${name}" needs a \`source\`.`);
      const source = binding.source;
      const resolved = toJsonValue(resolveFromState(binding.params, state));
      const params: { readonly [name: string]: JsonValue } = isPlainObject(resolved) ? (resolved as { [name: string]: JsonValue }) : {};
      return {
        kind: "request",
        key: JSON.stringify(["source", source, params]),
        run: async (signal) => {
          try {
            return { ok: true, value: await resolveSource({ source, params }, signal) };
          } catch (error) {
            if (signal.aborted) throw error;
            return { ok: false, message: error instanceof Error ? error.message : `Source "${source}" failed.` };
          }
        },
      };
    }
    default:
      return refuse("invalid-value", `Data binding "${name}" has no known \`type\`.`);
  }
}

/** Loads the document's `data` bindings (the raw, possibly partial `data` object). */
export function useDataBindings(bindings: unknown, options: DataBindingsOptions): DataSnapshot {
  const { adapters, state, pending, report } = options;
  const plans = useMemo(() => {
    const out = new Map<string, Plan>();
    if (!isPlainObject(bindings)) return out;
    for (const name of Object.keys(bindings)) {
      const closed = !pending.has(appendPointer("/data", name));
      out.set(name, closed ? planBinding(name, bindings[name], { adapters, state, pending, report }) : { kind: "waiting" });
    }
    return out;
  }, [bindings, adapters, state, pending, report]);

  const [results, setResults] = useState<{ readonly [name: string]: Result }>({});
  const inflight = useRef(new Map<string, { key: string; controller: AbortController }>());

  const requests = [...plans].filter((entry): entry is [string, Extract<Plan, { kind: "request" }>] => entry[1].kind === "request");
  const signature = JSON.stringify(requests.map(([name, plan]) => [name, plan.key]));

  useEffect(() => {
    const running = inflight.current;
    const wanted = new Map(requests);
    for (const [name, entry] of running) {
      if (wanted.get(name)?.key === entry.key) continue;
      entry.controller.abort();
      running.delete(name);
    }
    for (const [name, plan] of wanted) {
      if (running.has(name)) continue;
      const controller = new AbortController();
      running.set(name, { key: plan.key, controller });
      plan.run(controller.signal).then(
        (outcome) => {
          if (controller.signal.aborted) return;
          running.delete(name);
          if (!outcome.ok) {
            report(makeIssue("data-error", appendPointer("/data", name), `Data binding "${name}" failed: ${outcome.message}`));
          }
          setResults((current) => ({ ...current, [name]: { key: plan.key, outcome } }));
        },
        () => {
          // Aborted: a newer request or the unmount took over.
        },
      );
    }
    // Keyed on `signature`, not `requests`: a render that leaves every request's key alone restarts nothing.
  }, [signature]);

  useEffect(() => {
    const running = inflight.current;
    return () => {
      for (const entry of running.values()) entry.controller.abort();
      running.clear();
    };
  }, []);

  const shown = useRef<DataSnapshot | undefined>(undefined);
  const next = useMemo(() => {
    const data: { [name: string]: unknown } = {};
    const status: { [name: string]: BindingStatus } = {};
    for (const [name, plan] of plans) {
      if (plan.kind === "static") {
        data[name] = plan.value;
        status[name] = "ready";
      } else if (plan.kind === "refused") {
        status[name] = "error";
      } else if (plan.kind === "waiting") {
        status[name] = "loading";
      } else {
        const result = Object.hasOwn(results, name) ? results[name] : undefined;
        const current = result?.key === plan.key;
        // A refetch keeps the last good value on show while it loads.
        if (result?.outcome.ok === true) data[name] = result.outcome.value;
        status[name] = current ? (result.outcome.ok ? "ready" : "error") : "loading";
        if (current && !result.outcome.ok) delete data[name];
      }
    }
    return { data, status };
  }, [plans, results]);
  // A streamed chunk re-plans every binding; what reads `data` and `status` memoises on their identity.
  const previous = shown.current;
  if (previous === undefined) shown.current = next;
  else {
    const data = sameEntries(previous.data, next.data) ? previous.data : next.data;
    const status = sameEntries(previous.status, next.status) ? previous.status : next.status;
    if (data !== previous.data || status !== previous.status) shown.current = { data, status };
  }
  return shown.current ?? next;
}
