// @vitest-environment node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const run = (root) =>
  spawnSync(process.execPath, [join(HERE, "verify-react-free.mjs"), ...(root ? ["--root", root] : [])], { encoding: "utf8" });

describe("verify:react-free", { timeout: 30_000 }, () => {
  it("goes red on React, the library, JSX, a misplaced zod and an unpublished entry, with the import chain", () => {
    const result = run(join(HERE, "fixtures/react-free/bad"));
    expect(result.status).toBe(1);
    const out = result.stderr;
    // A type-only import still names React in the published .d.ts.
    expect(out).toContain('./spec: imports "react": src/spec/index.ts -> src/spec/a.ts');
    // A re-export and then a dynamic import.
    expect(out).toContain('./stream: imports "@batthewz/r-ui-react-components": src/stream/index.ts -> src/stream/b.ts');
    expect(out).toContain('./reference: a .tsx module (JSX imports React): src/reference/index.ts -> src/reference/view.tsx');
    expect(out).toContain('./reference: not in package.json "exports"');
    expect(out).toContain('bin:r-ui-validate: imports "zod": src/cli/r-ui-validate.ts');
    expect(out).toContain('./examples: imports "lucide-react": src/examples/index.ts');
    // zod is allowed under ./zod, node: builtins everywhere.
    expect(out).not.toContain("./zod:");
    expect(out).not.toContain("node:fs");
    expect(out).toMatch(/— 6 problem\(s\)/);
  });

  it("passes comments, node builtins, JSON imports, zod under ./zod and React code no entry reaches", () => {
    const result = run(join(HERE, "fixtures/react-free/good"));
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/OK \(6 entries, 11 module\(s\) walked\)/);
  });

  it("passes this package", () => {
    const result = run();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
