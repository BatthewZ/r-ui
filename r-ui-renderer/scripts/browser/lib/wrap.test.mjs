// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { DIAGNOSTIC_SELECTOR, RENDERER_CLASSES } from "../../../src/diagnostics.ts";
import { CONTROL_EXAMPLES } from "../../../src/examples/controls/index.ts";
import { PRODUCT_EXAMPLES } from "../../../src/examples/index.ts";
import { checkConstants, wrapScript } from "./wrap.mjs";

const BROWSER = join(dirname(fileURLToPath(import.meta.url)), "..");
const prelude = readFileSync(join(BROWSER, "lib/prelude.js"), "utf8");

/** A page that records what the wrapper and the prelude do to it. */
function fakePage() {
  return {
    goto: vi.fn(async () => {}),
    emulateMedia: vi.fn(async () => {}),
    setViewportSize: vi.fn(async () => {}),
    setDefaultNavigationTimeout: vi.fn(),
    setDefaultTimeout: vi.fn(),
  };
}

const run = (source, page) => new Function(`return ${wrapScript(source, checkConstants("http://localhost:1/"), prelude)}`)()(page);

describe("the browser checks' scope", () => {
  it("never spells a renderer class: the checks and the prelude read the selectors the runner injects", () => {
    const files = [...readdirSync(BROWSER).filter((file) => file.endsWith(".js")), "lib/prelude.js"];
    expect(files.length).toBeGreaterThan(5);
    expect(files.filter((file) => readFileSync(join(BROWSER, file), "utf8").includes("r-renderer-"))).toEqual([]);
  });

  it("holds the selectors from src/diagnostics.ts, the document names and the controls' declared diagnostics", async () => {
    const page = fakePage();
    const seen = await run("async (page) => ({ DIAGNOSTIC_SELECTOR, VIEW_SELECTOR, THEMED_CLASS, CORPUS, url: viewUrl('ops-dashboard', { density: 'compact' }) })", page);
    expect(seen.DIAGNOSTIC_SELECTOR).toBe(DIAGNOSTIC_SELECTOR);
    expect(seen.VIEW_SELECTOR).toBe(`.${RENDERER_CLASSES.view}`);
    expect(seen.THEMED_CLASS).toBe(RENDERER_CLASSES.themed);
    expect(seen.CORPUS.product).toEqual(Object.keys(PRODUCT_EXAMPLES));
    expect(seen.CORPUS.controls["refused-image"]).toEqual(CONTROL_EXAMPLES["refused-image"].diagnostics);
    expect(seen.CORPUS.controls["refused-theme"]).toEqual(["theme-contrast"]);
    expect(seen.url).toBe("http://localhost:1/?view=ops-dashboard&density=compact");
  });

  it("resets the page after the check, pass or fail, and passes the failure on", async () => {
    const passed = fakePage();
    await run("async (page) => 1", passed);
    expect(passed.goto).toHaveBeenLastCalledWith("about:blank");
    const failed = fakePage();
    await expect(run('async (page) => { throw new Error("boom"); }', failed)).rejects.toThrow("boom");
    expect(failed.goto).toHaveBeenLastCalledWith("about:blank");
  });
});
