/**
 * What the corpus tests share: the fixture-serving `fetch` the playground's
 * adapter stands for, and a walk over the component names a document uses.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isPlainObject } from "../spec/guards";

const FIXTURES = join(import.meta.dirname, "../../playground/fixtures");

/** The origin jsdom's documents live on, for the validator's origin checks. */
export const TEST_ORIGIN = "http://localhost:3000";

function json(body: string, status: number): Response {
  return new Response(body, { status, headers: { "content-type": "application/json" } });
}

/**
 * Serves `/fixtures/<path>` from `playground/fixtures/<path>` (any method, the
 * query ignored) and 404s everything else, recording every request. `settled()`
 * resolves once every request made so far has answered.
 */
export function fixtureFetch() {
  const requests: { readonly url: string; readonly method: string; readonly status: number; readonly body?: string }[] = [];
  const pending: Promise<unknown>[] = [];
  const fetch = (url: string, init: RequestInit): Promise<Response> => {
    const { pathname } = new URL(url);
    let response: Response;
    try {
      if (!pathname.startsWith("/fixtures/") || pathname.includes("..")) throw new Error("not a fixture");
      response = json(readFileSync(join(FIXTURES, pathname.slice("/fixtures/".length)), "utf8"), 200);
    } catch {
      response = json(JSON.stringify({ message: `${pathname} is not a fixture` }), 404);
    }
    requests.push({ url, method: init.method ?? "GET", status: response.status, body: typeof init.body === "string" ? init.body : undefined });
    const answer = Promise.resolve(response);
    pending.push(answer);
    return answer;
  };
  return {
    fetch,
    requests,
    settled: async () => {
      for (let seen = -1; seen !== pending.length; ) {
        seen = pending.length;
        await Promise.all(pending);
      }
    },
  };
}

/** Every component name a document uses: node positions, and `$node` markers at any depth inside props. */
export function componentNames(document: unknown): Set<string> {
  const names = new Set<string>();
  const inProps = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(inProps);
    else if (isPlainObject(value)) {
      if (Object.keys(value).length === 1 && Object.hasOwn(value, "$node")) node(value.$node);
      else Object.values(value).forEach(inProps);
    }
  };
  const node = (value: unknown): void => {
    if (!isPlainObject(value)) return;
    if (typeof value.component === "string") {
      names.add(value.component);
      inProps(value.props);
      if (Array.isArray(value.children)) value.children.forEach(node);
    }
    if (Object.hasOwn(value, "$each")) node(value.node);
    if (Object.hasOwn(value, "$cond")) {
      node(value.then);
      node(value.else);
    }
  };
  if (isPlainObject(document)) {
    node(document.root);
    inProps(document.forms);
  }
  return names;
}

/** The endpoint of every `api` binding a document declares. */
export function apiEndpoints(document: unknown): string[] {
  const data = isPlainObject(document) && isPlainObject(document.data) ? document.data : {};
  return Object.values(data).flatMap((binding) =>
    isPlainObject(binding) && binding.type === "api" && typeof binding.endpoint === "string" ? [binding.endpoint] : [],
  );
}
