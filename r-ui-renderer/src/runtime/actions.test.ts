import { describe, expect, it, vi } from "vitest";

import { createFormRegistry } from "../forms/registry";
import type { Handler, HostPolicy, Issue } from "../spec/types";
import { ActionFailure, createActionDispatcher } from "./actions";
import type { RendererAdapters } from "./adapters";
import type { DispatchContext } from "./context";
import { resolvePolicy } from "./policy";
import { setAtPath, stateSegments } from "./state";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function setup(options: { adapters?: RendererAdapters; policy?: HostPolicy; complete?: boolean; state?: Record<string, unknown> } = {}) {
  const issues: Issue[] = [];
  let state: { readonly [key: string]: unknown } = options.state ?? {};
  const open = new Map<string, boolean>();
  const adapters = options.adapters ?? {};
  let complete = options.complete ?? true;
  const dispatch = createActionDispatcher({
    getRoots: () => ({ data: { user: { id: "u1" } }, status: { user: "ready" }, state, forms: {} }),
    setState: (path, value, setOptions) => {
      const segments = stateSegments(path);
      const next = segments === null ? null : setAtPath(state, segments, value, setOptions);
      if (next === null) return false;
      state = next;
      return true;
    },
    forms: createFormRegistry(),
    dialogs: { isOpen: (id) => open.get(id) ?? false, setOpen: (id, next) => void open.set(id, next) },
    getAdapters: () => adapters,
    getPolicy: () => resolvePolicy(options.policy),
    report: (issue) => void issues.push(issue),
    isComplete: () => complete,
    format: (value, spec) => `${spec.style}:${String(value)}`,
  });
  const run = (handler: unknown, context: Partial<DispatchContext> = {}) =>
    dispatch(handler as Handler, { args: [], vars: {}, path: "/root/props/onClick", ...context });
  return {
    run,
    issues,
    open,
    getState: () => state,
    complete: () => {
      complete = true;
    },
    codes: () => issues.map((issue) => [issue.code, issue.path]),
  };
}

describe("the dispatcher", () => {
  it("does nothing until the document is complete", async () => {
    const view = setup({ complete: false });
    await view.run({ action: "setState", payload: { path: "state.a", value: 1 } });
    expect(view.getState()).toEqual({});
    view.complete();
    await view.run({ action: "setState", payload: { path: "state.a", value: 1 } });
    expect(view.getState()).toEqual({ a: 1 });
  });

  it("setState resolves the value (event, locals, data) but reads `path` literally", async () => {
    const view = setup({ state: { target: "state.hijacked" } });
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = true;
    const change = new Event("change");
    Object.defineProperty(change, "target", { value: box });
    await view.run(
      [
        { action: "setState", payload: { path: "state.on", value: { $ref: "event.value" } } },
        { action: "setState", payload: { path: "state.picked", value: { id: { $ref: "row.id" }, by: { $ref: "data.user.id" } } } },
      ],
      { args: [change], vars: { row: { id: 7 } } },
    );
    expect(view.getState()).toEqual({ target: "state.hijacked", on: true, picked: { id: 7, by: "u1" } });

    await expect(view.run({ action: "setState", payload: { path: { $ref: "state.target" }, value: 1 } })).rejects.toBeInstanceOf(ActionFailure);
    expect(view.getState()).not.toHaveProperty("hijacked");
    expect(view.codes()).toEqual([["invalid-ref", "/root/props/onClick/payload/path"]]);
  });

  it("setState merges plain objects shallowly, and with `replace` stores the value as given", async () => {
    const view = setup({ state: { filters: { region: "eu", status: ["failed"] } } });
    await view.run({ action: "setState", payload: { path: "state.filters", value: { region: "us" } } });
    expect(view.getState().filters).toEqual({ region: "us", status: ["failed"] });
    await view.run({ action: "setState", payload: { path: "state.filters", value: { region: "apac" }, replace: true } });
    expect(view.getState().filters).toEqual({ region: "apac" });
    // `replace` is literal: a reference there is not read as true.
    await view.run({ action: "setState", payload: { path: "state.filters", value: { q: "db" }, replace: { $ref: "state.filters.region" } } });
    expect(view.getState().filters).toEqual({ region: "apac", q: "db" });
  });

  it("runs a list in order and stops at the first failure", async () => {
    const view = setup();
    const result = view.run([
      { action: "setState", payload: { path: "state.a", value: 1 } },
      { action: "openDialog", payload: { dialogId: "bad id" } },
      { action: "setState", payload: { path: "state.b", value: 2 } },
    ]);
    await expect(result).rejects.toBeInstanceOf(ActionFailure);
    expect(view.getState()).toEqual({ a: 1 });
    expect(view.codes()).toEqual([["invalid-name", "/root/props/onClick/1/payload/dialogId"]]);
  });

  it("runs at most ten actions of a list", async () => {
    const view = setup();
    const list = Array.from({ length: 12 }, (_, index) => ({ action: "setState", payload: { path: `state.n${index}`, value: index } }));
    await view.run(list);
    expect(Object.keys(view.getState())).toHaveLength(10);
    expect(view.codes()).toEqual([["limit-exceeded", "/root/props/onClick"]]);
  });

  it("setState writes into a list at most one past its end, refusing an index that would make it sparse", async () => {
    const view = setup({ state: { rows: [] } });
    await view.run({ action: "setState", payload: { path: "state.rows.0", value: { id: 1 } } });
    await expect(view.run({ action: "setState", payload: { path: "state.rows.4294967294", value: { id: 2 } } })).rejects.toBeInstanceOf(ActionFailure);
    await expect(view.run({ action: "setState", payload: { path: "state.rows.5.id", value: 3 } })).rejects.toBeInstanceOf(ActionFailure);
    expect(view.getState()).toEqual({ rows: [{ id: 1 }] });
    expect(view.codes()).toEqual([
      ["invalid-ref", "/root/props/onClick/payload/path"],
      ["invalid-ref", "/root/props/onClick/payload/path"],
    ]);
  });

  it("opens and closes dialogs by id", async () => {
    const view = setup();
    await view.run({ action: "openDialog", payload: { dialogId: "details" } });
    expect(view.open.get("details")).toBe(true);
    await view.run({ action: "closeDialog", payload: { dialogId: "details" } });
    expect(view.open.get("details")).toBe(false);
  });

  it("navigate goes through the host with the resolved URL, and refuses an unsafe scheme", async () => {
    const navigate = vi.fn();
    const view = setup({ adapters: { navigate } });
    await view.run({ action: "navigate", payload: { to: { $ref: "event.value" }, replace: true } }, { args: ["  /services/../services/7 "] });
    expect(navigate.mock.calls).toEqual([[new URL("/services/7", document.baseURI).href, { replace: true }]]);

    await expect(view.run({ action: "navigate", payload: { to: "JaVaScript:alert(1)" } })).rejects.toBeInstanceOf(ActionFailure);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(view.codes()).toEqual([["refused-url", "/root/props/onClick/payload/to"]]);
  });

  it("$concat joins a payload's parts, and the joined URL is what navigate judges", async () => {
    const navigate = vi.fn();
    const toast = vi.fn();
    const view = setup({ adapters: { navigate, toast } });
    await view.run(
      [
        { action: "showToast", payload: { title: { $concat: [{ $ref: "event.value" }, " of ", 12, " saved"] } } },
        { action: "navigate", payload: { to: { $concat: ["/services/", { $ref: "event.value" }] } } },
      ],
      { args: [3] },
    );
    expect(toast.mock.calls).toEqual([[{ title: "3 of 12 saved" }]]);
    expect(navigate.mock.calls).toEqual([[new URL("/services/3", document.baseURI).href, { replace: false }]]);
    await expect(view.run({ action: "navigate", payload: { to: { $concat: ["java", { $ref: "event.value" }] } } }, { args: ["script:alert(1)"] })).rejects.toBeInstanceOf(
      ActionFailure,
    );
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(view.codes()).toEqual([["refused-url", "/root/props/onClick/payload/to"]]);
  });

  it("navigate goes only where the policy's allowUrl lets requests go: same origin by default", async () => {
    const navigate = vi.fn();
    const view = setup({ adapters: { navigate } });
    await expect(view.run({ action: "navigate", payload: { to: "https://evil.test/" } })).rejects.toBeInstanceOf(ActionFailure);
    expect(navigate).not.toHaveBeenCalled();
    expect(view.codes()).toEqual([["refused-url", "/root/props/onClick/payload/to"]]);

    const allowed = setup({ adapters: { navigate }, policy: { allowUrl: (url) => url.hostname === "docs.aurora.test" } });
    await allowed.run({ action: "navigate", payload: { to: "https://docs.aurora.test/guide" } });
    expect(navigate.mock.calls).toEqual([["https://docs.aurora.test/guide", { replace: false }]]);
  });

  it("navigate without an adapter goes nowhere and says so; the list carries on", async () => {
    const view = setup();
    const before = window.location.href;
    await view.run([
      { action: "navigate", payload: { to: "/services" } },
      { action: "setState", payload: { path: "state.after", value: true } },
    ]);
    expect(window.location.href).toBe(before);
    expect(view.codes()).toEqual([["missing-adapter", "/root/props/onClick/0"]]);
    expect(view.getState()).toEqual({ after: true });
  });

  it("showToast sends resolved, formatted text and drops an unknown tone", async () => {
    const toast = vi.fn();
    const view = setup({ adapters: { toast } });
    await view.run({
      action: "showToast",
      payload: { title: { $format: { value: { $ref: "event.value" }, style: "percent" } }, description: "Saved", tone: "success" },
    }, { args: [0.5] });
    await view.run({ action: "showToast", payload: { title: "Hi", tone: "purple" } });
    expect(toast.mock.calls).toEqual([[{ title: "percent:0.5", description: "Saved", tone: "success" }], [{ title: "Hi" }]]);
  });

  it("a payload's $format with no style shows its value as plain text, as a prop's does", async () => {
    const toast = vi.fn();
    const view = setup({ adapters: { toast } });
    await view.run({ action: "showToast", payload: { title: { $format: { value: { $ref: "event.value" } } } } }, { args: [0.5] });
    await view.run({ action: "showToast", payload: { title: { $format: { value: 0.25, style: "percent", colour: "red" } } } });
    expect(toast.mock.calls).toEqual([[{ title: "0.5" }], [{ title: "percent:0.25" }]]);
  });

  it("showToast without an adapter reports missing-adapter and carries on", async () => {
    const view = setup();
    await view.run([
      { action: "showToast", payload: { title: "Hi" } },
      { action: "setState", payload: { path: "state.after", value: true } },
    ]);
    expect(view.codes()).toEqual([["missing-adapter", "/root/props/onClick/0"]]);
    expect(view.getState()).toEqual({ after: true });
  });
});

describe("apiCall", () => {
  it("sends nothing without a fetch adapter", async () => {
    const view = setup();
    await expect(view.run({ action: "apiCall", payload: { endpoint: "/api/x" } })).rejects.toBeInstanceOf(ActionFailure);
    expect(view.codes()).toEqual([["missing-adapter", "/root/props/onClick"]]);
  });

  it.each(["https://evil.test/api", "//evil.test/api", "/\\evil.test/api", "\\\\evil.test/api", "/\t/evil.test", "javascript:alert(1)"])(
    "refuses %j by the origin it resolves to, sending nothing",
    async (endpoint) => {
      const fetch = vi.fn(() => Promise.resolve(json({})));
      const view = setup({ adapters: { fetch } });
      await expect(view.run({ action: "apiCall", payload: { endpoint } })).rejects.toBeInstanceOf(ActionFailure);
      expect(fetch).toHaveBeenCalledTimes(0);
      expect(view.codes()).toEqual([["refused-url", "/root/props/onClick/payload/endpoint"]]);
    },
  );

  it("lets the host's allowUrl admit another origin", async () => {
    const fetch = vi.fn(() => Promise.resolve(json({ ok: true })));
    const view = setup({ adapters: { fetch }, policy: { allowUrl: (url) => url.hostname === "api.aurora.test" } });
    await view.run({ action: "apiCall", payload: { endpoint: "https://api.aurora.test/v1" } });
    expect(fetch.mock.calls.map((call: unknown[]) => call[0])).toEqual(["https://api.aurora.test/v1"]);
  });

  it("GET sends the resolved query and no body; POST sends JSON; `into` replaces; onSuccess sees the response", async () => {
    const fetch = vi.fn((url: string, init: RequestInit) => Promise.resolve(json({ url, method: init.method, items: [1] })));
    const view = setup({ adapters: { fetch }, state: { region: "eu", result: { stale: true } } });
    await view.run({
      action: "apiCall",
      payload: {
        endpoint: "/api/services",
        query: { region: { $ref: "state.region" }, page: 2, skip: null },
        body: { ignored: true },
        into: "state.result",
        onSuccess: { action: "setState", payload: { path: "state.count", value: { $ref: "event.value.items.length" } } },
      },
    });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname + new URL(url).search).toBe("/api/services?region=eu&page=2");
    expect(init.body).toBeUndefined();
    expect(view.getState()).toEqual({ region: "eu", result: { url, method: "GET", items: [1] }, count: 1 });

    await view.run({ action: "apiCall", payload: { endpoint: "/api/save", method: "POST", body: { id: { $ref: "event.value" } } } }, { args: [9] });
    const [, post] = fetch.mock.calls[1] as [string, RequestInit];
    expect(post).toMatchObject({ method: "POST", body: '{"id":9}', headers: { "Content-Type": "application/json" } });
  });

  it("sends a list as repeated parameters and leaves out an object, reporting it", async () => {
    const fetch = vi.fn(() => Promise.resolve(json({})));
    const view = setup({ adapters: { fetch }, state: { tags: ["db", "eu west"], filter: { region: "eu" } } });
    await view.run({
      action: "apiCall",
      payload: { endpoint: "/api/search", query: { tag: { $ref: "state.tags" }, kind: ["a", 2, null, true], filter: { $ref: "state.filter" }, page: 1 } },
    });
    const [url] = fetch.mock.calls[0] as unknown as [string];
    expect(new URL(url).search).toBe("?tag=db&tag=eu+west&kind=a&kind=2&kind=true&page=1");
    expect(view.codes()).toEqual([["unusable-value", "/root/props/onClick/payload/query/filter"]]);
  });

  it("on failure runs onError with { status, message, body }, then rejects with the response", async () => {
    const fetch = vi.fn(() => Promise.resolve(json({ errors: { email: "Taken" } }, 422)));
    const view = setup({ adapters: { fetch } });
    const result = view.run({
      action: "apiCall",
      payload: {
        endpoint: "/api/x",
        method: "POST",
        onError: { action: "setState", payload: { path: "state.error", value: { $ref: "event.value" } } },
      },
    });
    const failure: unknown = await result.catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ActionFailure);
    expect((failure as ActionFailure).response).toEqual({
      status: 422,
      message: "The request failed with status 422.",
      body: { errors: { email: "Taken" } },
    });
    expect(view.getState()).toEqual({ error: (failure as ActionFailure).response });
    expect(view.codes()).toEqual([]);
  });

  it("reports action-failed when no onError handles the failure, including a network error", async () => {
    const fetch = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    const view = setup({ adapters: { fetch } });
    await expect(view.run({ action: "apiCall", payload: { endpoint: "/api/x" } })).rejects.toBeInstanceOf(ActionFailure);
    expect(view.issues.map((issue) => [issue.code, issue.message])).toEqual([["action-failed", "Failed to fetch"]]);
  });

  it("reads endpoint, method and handlers literally", async () => {
    const fetch = vi.fn(() => Promise.resolve(json({})));
    const view = setup({ adapters: { fetch }, state: { url: "/api/x" } });
    await expect(view.run({ action: "apiCall", payload: { endpoint: { $ref: "state.url" } } })).rejects.toBeInstanceOf(ActionFailure);
    await expect(view.run({ action: "apiCall", payload: { endpoint: "/api/x", method: "TRACE" } })).rejects.toBeInstanceOf(ActionFailure);
    expect(fetch).toHaveBeenCalledTimes(0);
    expect(view.codes()).toEqual([
      ["invalid-value", "/root/props/onClick/payload/endpoint"],
      ["invalid-value", "/root/props/onClick/payload/method"],
    ]);
  });

  it("chains onSuccess at most five deep", async () => {
    const fetch = vi.fn(() => Promise.resolve(json({})));
    const view = setup({ adapters: { fetch } });
    let handler: Record<string, unknown> = { action: "setState", payload: { path: "state.deepest", value: true } };
    for (let level = 0; level < 6; level++) handler = { action: "apiCall", payload: { endpoint: "/api/x", onSuccess: handler } };
    await view.run(handler);
    // Six calls nest five handlers below the first; the sixth call's own onSuccess is past the cap.
    expect(fetch).toHaveBeenCalledTimes(6);
    expect(view.getState()).toEqual({});
    expect(view.codes()).toEqual([["limit-exceeded", `/root/props/onClick${"/payload/onSuccess".repeat(6)}`]]);
  });
});
