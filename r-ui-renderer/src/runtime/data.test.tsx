import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Issue } from "../spec/types";
import type { RendererAdapters, SourceRequest } from "./adapters";
import type { ResolvedPolicy } from "./context";
import { useDataBindings } from "./data";
import { DEFAULT_POLICY, resolvePolicy } from "./policy";

const NOTHING: ReadonlySet<string> = new Set();
const NO_STATE = Object.freeze({});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

interface Props {
  bindings: unknown;
  adapters: RendererAdapters;
  policy?: ResolvedPolicy;
  state?: { readonly [key: string]: unknown };
  pending?: ReadonlySet<string>;
}

function mount(initial: Props) {
  const issues: Issue[] = [];
  const report = (issue: Issue) => void issues.push(issue);
  const hook = renderHook(
    ({ bindings, adapters, policy = DEFAULT_POLICY, state = NO_STATE, pending = NOTHING }: Props) =>
      useDataBindings(bindings, { adapters, policy, state, pending, report }),
    { initialProps: initial },
  );
  return { ...hook, issues, codes: () => issues.map((issue) => [issue.code, issue.path]) };
}

describe("useDataBindings", () => {
  it("serves a static binding at once", () => {
    const view = mount({ bindings: { summary: { type: "static", value: { uptime: 1 } } }, adapters: {} });
    expect(view.result.current).toEqual({ data: { summary: { uptime: 1 } }, status: { summary: "ready" } });
  });

  it("keeps data and status as the same objects while only the pending set changes, and replaces them when a value does", () => {
    const bindings = { summary: { type: "static", value: { uptime: 1 } } };
    const view = mount({ bindings, adapters: {}, pending: new Set(["/root"]) });
    const first = view.result.current;
    view.rerender({ bindings, adapters: {}, pending: new Set(["/root", "/root/children"]) });
    expect(view.result.current.data).toBe(first.data);
    expect(view.result.current.status).toBe(first.status);
    view.rerender({ bindings: { summary: { type: "static", value: { uptime: 2 } } }, adapters: {}, pending: NOTHING });
    expect(view.result.current.data).toEqual({ summary: { uptime: 2 } });
    expect(view.result.current.status).toBe(first.status);
  });

  it("plans each binding once while the rest of the document streams in, and again when one more closes", () => {
    const allowUrl = vi.fn(() => true);
    const policy = resolvePolicy({ allowUrl });
    const adapters: RendererAdapters = { fetch: () => new Promise<Response>(() => {}) };
    const bindings = { services: { type: "api", endpoint: "/api/services" }, regions: { type: "api", endpoint: "/api/regions" } };
    const view = mount({ bindings, adapters, policy, pending: new Set(["", "/data", "/data/regions"]) });
    expect(allowUrl).toHaveBeenCalledTimes(1);
    for (const open of ["/root", "/root/children", "/root/children/0", "/root/children/1"]) {
      view.rerender({ bindings, adapters, policy, pending: new Set(["", open]) });
    }
    // Once more when `regions` closed (both bindings planned), then nothing per chunk.
    expect(allowUrl).toHaveBeenCalledTimes(3);
  });

  it("ignores a binding whose name is not a name, such as an own __proto__, and says so", () => {
    const bindings: unknown = JSON.parse('{"__proto__":{"type":"static","value":{"polluted":true}},"ok":{"type":"static","value":1}}');
    const view = mount({ bindings, adapters: {} });
    expect(Object.keys(view.result.current.data)).toEqual(["ok"]);
    expect(Object.getPrototypeOf(view.result.current.data)).toBe(Object.prototype);
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
    expect(view.codes()).toEqual([["invalid-name", "/data/__proto__"]]);
  });

  it("sends nothing without a fetch adapter and reports missing-adapter", () => {
    const view = mount({ bindings: { services: { type: "api", endpoint: "/api/services" } }, adapters: {} });
    expect(view.result.current.status).toEqual({ services: "error" });
    expect(view.codes()).toEqual([["missing-adapter", "/data/services"]]);
  });

  it("refuses an endpoint that resolves to another origin", () => {
    const fetch = vi.fn(() => Promise.resolve(json([])));
    const view = mount({ bindings: { services: { type: "api", endpoint: "/\\evil.test/api" } }, adapters: { fetch } });
    expect(view.result.current.status).toEqual({ services: "error" });
    expect(fetch).toHaveBeenCalledTimes(0);
    expect(view.codes()).toEqual([["refused-url", "/data/services"]]);
  });

  it("loads an api binding: loading, then ready with the parsed body", async () => {
    const fetch = vi.fn(() => Promise.resolve(json([{ id: 1 }])));
    const view = mount({ bindings: { services: { type: "api", endpoint: "/api/services" } }, adapters: { fetch } });
    expect(view.result.current).toEqual({ data: {}, status: { services: "loading" } });
    await waitFor(() => expect(view.result.current.status).toEqual({ services: "ready" }));
    expect(view.result.current.data).toEqual({ services: [{ id: 1 }] });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("waits until the binding's object has closed", async () => {
    const fetch = vi.fn(() => Promise.resolve(json("ok")));
    const bindings = { services: { type: "api", endpoint: "/api/services" } };
    const view = mount({ bindings, adapters: { fetch }, pending: new Set(["", "/data", "/data/services"]) });
    expect(view.result.current.status).toEqual({ services: "loading" });
    expect(fetch).toHaveBeenCalledTimes(0);
    view.rerender({ bindings, adapters: { fetch }, pending: new Set(["", "/root"]) });
    await waitFor(() => expect(view.result.current.data).toEqual({ services: "ok" }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refetches when a referenced state value changes, aborting the request in flight and keeping the last value on show", async () => {
    const calls: Array<{ url: string; signal: AbortSignal; reply: ReturnType<typeof deferred<Response>> }> = [];
    const fetch = vi.fn((url: string, init: RequestInit) => {
      const reply = deferred<Response>();
      calls.push({ url, signal: init.signal as AbortSignal, reply });
      return reply.promise;
    });
    const bindings = { rows: { type: "api", endpoint: "/api/rows", query: { region: { $ref: "state.region" } } } };
    const adapters = { fetch };
    const view = mount({ bindings, adapters, state: { region: "eu" } });

    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => calls[0]?.reply.resolve(json(["eu-1"])));
    expect(view.result.current).toEqual({ data: { rows: ["eu-1"] }, status: { rows: "ready" } });

    // An unrelated re-render leaves the request alone.
    view.rerender({ bindings, adapters, state: { region: "eu", other: 1 } });
    view.rerender({ bindings, adapters, state: { region: "us" } });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(new URL(calls[1]?.url ?? "").search).toBe("?region=us");
    expect(view.result.current).toEqual({ data: { rows: ["eu-1"] }, status: { rows: "loading" } });

    view.rerender({ bindings, adapters, state: { region: "apac" } });
    await waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[1]?.signal.aborted).toBe(true);
    await act(async () => calls[1]?.reply.resolve(json(["us-late"])));
    await act(async () => calls[2]?.reply.resolve(json(["apac-1"])));
    expect(view.result.current.data).toEqual({ rows: ["apac-1"] });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("leaves a loaded binding alone when another binding closes or refetches", async () => {
    const fetch = vi.fn((url: string) => Promise.resolve(json(new URL(url).pathname)));
    const bindings = {
      summary: { type: "api", endpoint: "/api/summary" },
      rows: { type: "api", endpoint: "/api/rows", query: { region: { $ref: "state.region" } } },
    };
    const adapters = { fetch };
    const view = mount({ bindings, adapters, state: { region: "eu" }, pending: new Set(["", "/data", "/data/rows"]) });
    await waitFor(() => expect(view.result.current.status).toEqual({ summary: "ready", rows: "loading" }));
    expect(fetch).toHaveBeenCalledTimes(1);

    view.rerender({ bindings, adapters, state: { region: "eu" }, pending: new Set(["", "/root"]) });
    await waitFor(() => expect(view.result.current.status).toEqual({ summary: "ready", rows: "ready" }));
    view.rerender({ bindings, adapters, state: { region: "us" } });
    await waitFor(() => expect(view.result.current.status).toEqual({ summary: "ready", rows: "ready" }));
    expect(fetch.mock.calls.map(([url]) => new URL(url).pathname + new URL(url).search)).toEqual([
      "/api/summary",
      "/api/rows?region=eu",
      "/api/rows?region=us",
    ]);
  });

  it("marks a failed binding as error, shows no data and reports data-error", async () => {
    const fetch = vi.fn(() => Promise.resolve(json({ message: "no" }, 500)));
    const view = mount({ bindings: { services: { type: "api", endpoint: "/api/services" } }, adapters: { fetch } });
    await waitFor(() => expect(view.result.current.status).toEqual({ services: "error" }));
    expect(view.result.current.data).toEqual({});
    await waitFor(() => expect(view.codes()).toEqual([["data-error", "/data/services"]]));
  });

  it("hands a source binding to resolveSource with state-only params", async () => {
    const resolveSource = vi.fn((_request: SourceRequest, _signal: AbortSignal) => Promise.resolve<unknown>([{ id: "i1" }]));
    const view = mount({
      bindings: { incidents: { type: "source", source: "incidents", params: { open: true, team: { $ref: "state.team" }, leak: { $ref: "data.secret" } } } },
      adapters: { resolveSource },
      state: { team: "core" },
    });
    await waitFor(() => expect(view.result.current.status).toEqual({ incidents: "ready" }));
    expect(resolveSource.mock.calls[0]?.[0]).toEqual({ source: "incidents", params: { open: true, team: "core" } });
    expect(view.result.current.data).toEqual({ incidents: [{ id: "i1" }] });
  });

  it("reports missing-adapter for a source binding without resolveSource", () => {
    const view = mount({ bindings: { incidents: { type: "source", source: "incidents" } }, adapters: {} });
    expect(view.result.current.status).toEqual({ incidents: "error" });
    expect(view.codes()).toEqual([["missing-adapter", "/data/incidents"]]);
  });

  it("aborts what is in flight on unmount", async () => {
    let signal: AbortSignal | undefined;
    const fetch = vi.fn((_url: string, init: RequestInit) => {
      signal = init.signal ?? undefined;
      return new Promise<Response>(() => {});
    });
    const view = mount({ bindings: { rows: { type: "api", endpoint: "/api/rows" } }, adapters: { fetch } });
    await waitFor(() => expect(signal).toBeDefined());
    expect(signal?.aborted).toBe(false);
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
