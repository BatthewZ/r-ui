// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { staleFiles } from "./gen-viewspec.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
// On disk, never in /tmp.
const SCRATCH = join(PKG, "node_modules", ".cache", "r-ui-renderer-gates", `viewspec-${process.pid}`);
const VIEWSPEC = readFileSync(join(PKG, "VIEWSPEC.md"), "utf8");
const PROSE = readFileSync(join(PKG, "src", "reference", "prose.json"), "utf8");

/** The script runs on bun (the renderer is TypeScript). */
const run = (...args) => spawnSync("bun", [join(HERE, "gen-viewspec.mjs"), ...args], { encoding: "utf8" });

function tree(name, viewspec, prose) {
  const root = join(SCRATCH, name);
  mkdirSync(join(root, "src", "reference"), { recursive: true });
  writeFileSync(join(root, "VIEWSPEC.md"), viewspec);
  if (prose !== undefined) writeFileSync(join(root, "src", "reference", "prose.json"), prose);
  return root;
}

afterAll(() => rmSync(SCRATCH, { recursive: true, force: true }));

describe("gen-viewspec", { timeout: 30_000 }, () => {
  it("the committed VIEWSPEC.md and prose are what the generator writes", () => {
    expect(VIEWSPEC).toContain("| `DataTable` |");
    expect(staleFiles(PKG)).toEqual([]);
  });

  it("goes red on a hand edit inside a region, naming VIEWSPEC.md, and writing restores the region", () => {
    const edited = VIEWSPEC.replace("| `invalid-json` | error |", "| `invalid-json` | warning |");
    expect(edited).not.toBe(VIEWSPEC);
    const root = tree("region-edit", edited, PROSE);
    expect(staleFiles(root)).toEqual(["VIEWSPEC.md"]);
    const check = run("--check", "--root", root);
    expect(check.status).toBe(1);
    expect(check.stderr).toContain("stale: VIEWSPEC.md\n");
    expect(run("--root", root).status).toBe(0);
    expect(readFileSync(join(root, "VIEWSPEC.md"), "utf8")).toBe(VIEWSPEC);
    expect(run("--check", "--root", root).status).toBe(0);
  });

  it("goes red on a prose edit the shipped prose has not taken, and writing keeps the edit", () => {
    const edited = VIEWSPEC.replace("Format version 2.", "Format version 2, edited.");
    expect(edited).not.toBe(VIEWSPEC);
    const root = tree("prose-edit", edited, PROSE);
    expect(staleFiles(root)).toEqual(["src/reference/prose.json"]);
    expect(staleFiles(tree("missing-prose", VIEWSPEC))).toEqual(["src/reference/prose.json"]);
    expect(run("--root", root).status).toBe(0);
    expect(readFileSync(join(root, "VIEWSPEC.md"), "utf8")).toBe(edited);
    expect(readFileSync(join(root, "src", "reference", "prose.json"), "utf8")).toContain('"Format version 2, edited.');
    expect(staleFiles(root)).toEqual([]);
  });
});
