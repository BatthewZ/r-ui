// @vitest-environment node
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The bin as a user runs it: built to JavaScript with its shebang, started by
// Node (not by this test's transform), reading a file, --raw and stdin. The
// build mirrors the package's for this entry: ES module, node: externals, the
// shebang banner.

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// On disk, never in /tmp.
const SCRATCH = join(PKG, "node_modules", ".cache", "r-ui-renderer-gates", `bin-${process.pid}`);
const BIN = join(SCRATCH, "r-ui-validate.js");

const VALID = JSON.stringify({ version: 2, title: "t", root: { component: "Card", children: ["Hi"] } });
const INVALID = '{"version": 2, "title": "t"}';

const run = (args: string[], input?: string) => spawnSync(BIN, args, { encoding: "utf8", input, cwd: SCRATCH });

beforeAll(async () => {
  mkdirSync(SCRATCH, { recursive: true });
  await build({
    configFile: false,
    logLevel: "silent",
    root: PKG,
    build: {
      outDir: SCRATCH,
      emptyOutDir: true,
      minify: false,
      target: "node22",
      lib: { entry: join(PKG, "src", "cli", "r-ui-validate.ts"), formats: ["es"], fileName: () => "r-ui-validate.js" },
      rollupOptions: { external: [/^node:/], output: { banner: "#!/usr/bin/env node" } },
    },
  });
  chmodSync(BIN, 0o755);
}, 120_000);

afterAll(() => rmSync(SCRATCH, { recursive: true, force: true }));

describe("the r-ui-validate bin", () => {
  it("starts with a node shebang and runs as an executable", () => {
    expect(readFileSync(BIN, "utf8").startsWith("#!/usr/bin/env node\n")).toBe(true);
    const result = run(["--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: r-ui-validate");
  });

  it("exits 0 on a valid file, 1 on an invalid one, path-first", () => {
    writeFileSync(join(SCRATCH, "good.json"), VALID);
    writeFileSync(join(SCRATCH, "bad.json"), INVALID);
    const good = run(["good.json"]);
    expect([good.status, good.stdout, good.stderr]).toEqual([0, "valid: no issues\n", ""]);
    const bad = run(["bad.json", "--format", "json"]);
    expect(bad.status).toBe(1);
    expect(JSON.parse(bad.stdout)).toMatchObject({ ok: false, renderable: false, issues: [{ code: "missing-key", path: "", severity: "error", message: "Missing `root`." }] });
  });

  it("reads --raw and standard input", () => {
    expect(run(["--raw", VALID]).status).toBe(0);
    expect(run(["--raw", INVALID]).status).toBe(1);
    expect(run([], VALID).status).toBe(0);
    const piped = run(["--format", "model"], `\`\`\`json\n${INVALID}\n\`\`\``);
    expect(piped.status).toBe(1);
    expect(piped.stdout).toContain("(document) error missing-key: Missing `root`.");
  });

  it("exits 2 on a usage or input error", () => {
    const usage = run(["--format", "yaml"]);
    expect(usage.status).toBe(2);
    expect(usage.stderr).toContain("--format must be one of text, json, model.");
    const missing = run(["nowhere.json"]);
    expect(missing.status).toBe(2);
    expect(missing.stdout).toBe("");
    const empty = run([], "");
    expect([empty.status, empty.stdout, empty.stderr]).toEqual([2, "", "No document: the input is empty.\n"]);
  });
});
