// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { isStale, schemaText } from "./generate-schema.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
// On disk, never in /tmp.
const SCRATCH = join(PKG, "node_modules", ".cache", "r-ui-renderer-gates", `schema-${process.pid}`);

/** The script runs on bun (its source is TypeScript). */
const run = (...args) => spawnSync("bun", [join(HERE, "generate-schema.mjs"), ...args], { encoding: "utf8" });

function tree(name, schema) {
  const root = join(SCRATCH, name);
  mkdirSync(join(root, "src"), { recursive: true });
  if (schema !== undefined) writeFileSync(join(root, "src", "schema.json"), schema);
  return root;
}

afterAll(() => rmSync(SCRATCH, { recursive: true, force: true }));

describe("generate-schema", { timeout: 30_000 }, () => {
  it("the committed schema.json is the source's, and the source is a whole JSON Schema", () => {
    expect(isStale(PKG)).toBe(false);
    const schema = JSON.parse(schemaText());
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.required).toEqual(["version", "title", "root"]);
    expect(Object.keys(schema.$defs)).toContain("ViewNode");
    expect(schemaText()).not.toContain('"x-');
  });

  it("goes red on a hand edit or a missing file, and writing makes it green", () => {
    const edited = tree("edited", schemaText().replace('"maxLength": 200', '"maxLength": 300'));
    expect(isStale(edited)).toBe(true);
    expect(isStale(tree("missing"))).toBe(true);

    const check = run("--check", "--root", edited);
    expect(check.status).toBe(1);
    expect(check.stderr).toContain("stale: src/schema.json");
    expect(run("--root", edited).status).toBe(0);
    expect(readFileSync(join(edited, "src", "schema.json"), "utf8")).toBe(schemaText());
    expect(run("--check", "--root", edited).status).toBe(0);
  });
});
