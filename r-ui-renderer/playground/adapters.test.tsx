import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ViewRenderer, type ViewSpec } from "../src";
import { createFixtureFetch, createFixtureImagePolicy, navigateToHash } from "./adapters";

const origin = location.origin;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("createFixtureFetch", () => {
  it("reads the fixture file at the endpoint's path, whatever the method, without the query", async () => {
    const load = vi.fn(async () => json({ rows: [1, 2] }));
    const signal = new AbortController().signal;
    const response = await createFixtureFetch(origin, load)(`${origin}/fixtures/ops/services.json?region=eu`, {
      method: "POST",
      body: "{}",
      signal,
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(`${origin}/fixtures/ops/services.json`, { method: "GET", signal });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(await response.json()).toEqual({ rows: [1, 2] });
  });

  it("passes a missing fixture's 404 on", async () => {
    const load = vi.fn(async () => new Response("", { status: 404, statusText: "Not Found" }));
    const response = await createFixtureFetch(origin, load)(`${origin}/fixtures/missing.json`, {});
    expect(load).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(404);
  });

  it.each([
    ["a path outside /fixtures/", `${origin}/api/services`],
    ["another origin", "https://elsewhere.example/fixtures/services.json"],
    ["a path that climbs out, its dots encoded", `${origin}/fixtures/%2e%2e/secret.json`],
    ["a near miss", `${origin}/fixtures-old/services.json`],
  ])("answers 404 for %s without a request", async (_, url) => {
    const load = vi.fn(async () => json({}));
    const response = await createFixtureFetch(origin, load)(url, {});
    expect(load).toHaveBeenCalledTimes(0);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: `No fixture serves ${url}.` });
  });

  it("feeds a document's api binding", async () => {
    const load = vi.fn(async () => json({ name: "Ingest gateway (eu-west-1, primary)" }));
    const spec: ViewSpec = {
      version: 2,
      title: "Service",
      data: { service: { type: "api", endpoint: "/fixtures/service.json" } },
      root: { component: "Text", children: [{ $ref: "data.service.name" }] },
    };
    render(<ViewRenderer spec={spec} adapters={{ fetch: createFixtureFetch(origin, load) }} />);
    expect(await screen.findByText("Ingest gateway (eu-west-1, primary)")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("createFixtureImagePolicy", () => {
  const allow = createFixtureImagePolicy(origin);

  it("allows same-origin images under /fixtures/img/", () => {
    expect(allow(new URL(`${origin}/fixtures/img/avatar.png`))).toBe(true);
  });

  it.each([
    ["another fixture", `${origin}/fixtures/services.json`],
    ["another origin", "https://elsewhere.example/fixtures/img/avatar.png"],
    ["a data image", "data:image/png;base64,iVBORw0KGgo="],
  ])("refuses %s", (_, url) => {
    expect(allow(new URL(url))).toBe(false);
  });
});

describe("navigateToHash", () => {
  afterEach(() => {
    history.replaceState(null, "", location.pathname + location.search);
  });

  it("puts the destination in the hash, adding a history entry", () => {
    const before = history.length;
    navigateToHash("/services/42", { replace: false });
    expect(location.hash).toBe("#/services/42");
    expect(history.length).toBe(before + 1);
  });

  it("replaces the entry when asked", () => {
    const before = history.length;
    navigateToHash("#settings", { replace: true });
    expect(location.hash).toBe("#settings");
    expect(history.length).toBe(before);
  });
});
