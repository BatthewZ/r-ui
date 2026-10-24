import { afterEach, describe, expect, it, vi } from "vitest";

import { exampleSpec } from "../src/examples";
import { CONTROL_EXAMPLES, type ControlName } from "../src/examples/controls";
import { corpusDocument, COVERAGE_NAMES, PRODUCT_NAMES } from "./corpus";

describe("corpusDocument", () => {
  it("resolves a corpus document as its spec and its text", () => {
    const entry = corpusDocument("ops-dashboard");
    expect(entry.ok && entry.name).toBe("ops-dashboard");
    expect(entry.ok && entry.spec).toEqual(exampleSpec("ops-dashboard"));
    expect(entry.ok && JSON.parse(entry.text)).toEqual(exampleSpec("ops-dashboard"));
  });

  it.each(Object.keys(CONTROL_EXAMPLES) as ControlName[])("resolves the control document %s, which the browser checks open by ?view=", (name) => {
    const entry = corpusDocument(name);
    expect(entry.ok && entry.name).toBe(name);
    expect(entry.ok && entry.spec).toEqual(CONTROL_EXAMPLES[name].document);
  });

  it("lists no control document in the editor's groups", () => {
    const listed: readonly string[] = [...PRODUCT_NAMES, ...COVERAGE_NAMES];
    for (const name of Object.keys(CONTROL_EXAMPLES)) expect(listed).not.toContain(name);
  });

  it("names an unknown document as such", () => {
    expect(corpusDocument("no-such-document")).toEqual({
      ok: false,
      code: "unknown-view",
      message: 'No corpus or control document is named "no-such-document".',
    });
  });
});

describe("corpusDocument under a base path", () => {
  const BASE = "/r-ui/playground/";

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadUnderBase() {
    vi.stubEnv("BASE_URL", BASE);
    vi.resetModules();
    return { ...(await import("./corpus")), ...(await import("./adapters")) };
  }

  it("moves every fixture path under the base, and nothing else", async () => {
    const atRoot = corpusDocument("marketing-page");
    const rootText = atRoot.ok ? atRoot.text : "";
    const fixturePaths = rootText.match(/"\/fixtures\//g) ?? [];
    expect(fixturePaths.length).toBeGreaterThan(0);

    const { corpusDocument: underBase } = await loadUnderBase();
    const entry = underBase("marketing-page");
    expect(entry.ok).toBe(true);
    const text = entry.ok ? entry.text : "";
    expect(text).not.toContain('"/fixtures/');
    expect(text.match(/"\/r-ui\/playground\/fixtures\//g)).toHaveLength(fixturePaths.length);
    expect(text.replaceAll(`"${BASE}fixtures/`, '"/fixtures/')).toBe(rootText);
  });

  it("serves a rebased endpoint from the fixtures under the base", async () => {
    const { createFixtureFetch, FIXTURE_IMAGE_PATH, FIXTURE_PATH } = await loadUnderBase();
    expect(FIXTURE_PATH).toBe(`${BASE}fixtures/`);
    expect(FIXTURE_IMAGE_PATH).toBe(`${BASE}fixtures/img/`);
    const origin = "https://pages.example";
    const load = vi.fn(async () => new Response("{}"));
    const response = await createFixtureFetch(origin, load)(`${origin}${BASE}fixtures/ops-services.json`, {});
    expect(response.status).toBe(200);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(`${origin}${BASE}fixtures/ops-services.json`, expect.objectContaining({ method: "GET" }));
    expect((await createFixtureFetch(origin, load)(`${origin}/fixtures/ops-services.json`, {})).status).toBe(404);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
