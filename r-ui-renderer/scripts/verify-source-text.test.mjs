// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const run = (root) =>
  spawnSync(process.execPath, [join(HERE, "verify-source-text.mjs"), ...(root ? ["--root", root] : [])], { encoding: "utf8" });

// The bad fixture is written at test time: committed, it would be the very
// binary-looking file the gate exists to prevent. On disk, never in /tmp.
const SCRATCH = join(HERE, "..", "node_modules", ".cache", "r-ui-renderer-gates", `source-text-${process.pid}`);

function fixture(name, files) {
  const root = join(SCRATCH, name);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

afterAll(() => rmSync(SCRATCH, { recursive: true, force: true }));

describe("verify:source-text", { timeout: 30_000 }, () => {
  it("goes red on a raw NUL, ESC or DEL, at its line, and passes tab, CR and form feed", () => {
    const root = fixture("bad", {
      "src/a.ts": `export const ok = "fine";\nexport const nul = "a\u0000b";\n`,
      "README.md": `# Title\n\nAn escape \u001b[0m here.\n`,
      "src/b.mjs": `export const del = "\u007f";\n`,
      "src/c.ts": `export const tabbed =\t"x";\r\n// page\f break\n`,
    });
    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("src/a.ts:2  U+0000");
    expect(result.stderr).toContain("README.md:3  U+001B");
    expect(result.stderr).toContain("src/b.mjs:1  U+007F");
    expect(result.stderr).not.toContain("src/c.ts");
    expect(result.stderr).toMatch(/— 3 line\(s\)/);
  });

  it("passes a tree of text", () => {
    const root = fixture("good", { "src/a.ts": "export const a = '\\u0000';\n" });
    const result = run(root);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/OK \(1 file\(s\)\)/);
  });

  it("passes this package", () => {
    const result = run();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
