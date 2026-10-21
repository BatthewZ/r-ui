// @vitest-environment node
// The package as a consumer meets it: every subpath served by a module the
// build emits, nothing unshipped among the entries or in the tarball, and the
// `validate` script the README runs.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { entries } from "../vite.config.ts";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));
const UNSHIPPED = /\.test\.|(^|\/)examples\/controls\//;

/** `./dist/<stem>.js` → `<stem>`, the build entry that emits it. */
const stemOf = (file) => /^\.\/dist\/(.+)\.(?:js|d\.ts)$/.exec(file)?.[1];

describe("the package", () => {
  it("serves every subpath and the bin from a build entry, `./examples` included", () => {
    expect(pkg.exports["./examples"]).toEqual({ types: "./dist/examples/index.d.ts", import: "./dist/examples/index.js" });
    const served = Object.values(pkg.exports)
      .flatMap((target) => (typeof target === "string" ? [target] : Object.values(target)))
      .concat(Object.values(pkg.bin))
      .filter((file) => /\.(?:js|d\.ts)$/.test(file));
    expect(served.length).toBeGreaterThan(10);
    expect(served.filter((file) => !Object.hasOwn(entries, stemOf(file) ?? ""))).toEqual([]);
  });

  it("builds no test, test helper or control document", () => {
    expect(Object.values(entries).length).toBeGreaterThan(50);
    expect(Object.values(entries).filter((file) => UNSHIPPED.test(file.split("\\").join("/")))).toEqual([]);
  });

  it("packs its sources without tests, control documents or JSON, which dist carries once", { timeout: 30_000 }, () => {
    const result = spawnSync("bun", ["pm", "pack", "--dry-run"], { cwd: PKG, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    const sources = [...result.stdout.matchAll(/^packed \S+ (src\/\S+)$/gm)].map((match) => match[1]);
    expect(sources).toContain("src/examples/index.ts");
    expect(sources.filter((file) => UNSHIPPED.test(file) || file.endsWith(".json"))).toEqual([]);
  });

  it("runs the validator from source with `bun run validate`", { timeout: 30_000 }, () => {
    const run = (text) => spawnSync("bun", ["run", "--silent", "validate", "--raw", text], { cwd: PKG, encoding: "utf8" });
    const valid = run(JSON.stringify({ version: 2, title: "t", root: { component: "Card", children: ["Hi"] } }));
    expect([valid.status, valid.stderr]).toEqual([0, ""]);
    expect(valid.stdout).toMatch(/^valid/);
    expect(run('{"version": 2, "title": "t"}').status).toBe(1);
  });
});
