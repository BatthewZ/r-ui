// @vitest-environment node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const run = (root) =>
  spawnSync(process.execPath, [join(HERE, "verify-class-vocabulary.mjs"), ...(root ? ["--root", root] : [])], { encoding: "utf8" });

describe("verify:class-vocabulary", { timeout: 60_000 }, () => {
  it("goes red on a dead class, a replaced default, an unlisted class, a raw length or colour, an unknown token and an unprefixed class", () => {
    const result = run(join(HERE, "fixtures/class-vocabulary/bad"));
    expect(result.status).toBe(1);
    const out = result.stderr;
    expect(out).toContain("`p-4` is a Tailwind default the CSS package replaces, and is in the vocabulary");
    expect(out).toContain("`text-sm` generates no CSS");
    expect(out).toContain("`gap-r2` is in the vocabulary but not in the compiled stylesheet");
    expect(out).toContain("`p-4` is in the compiled stylesheet");
    expect(out).toContain(".r-renderer-x { padding: 4px }: a raw length");
    expect(out).toContain(".r-renderer-x { color: #fff }: a raw colour");
    expect(out).toContain("reads --NOPE-TOKEN, which no token declares");
    expect(out).toContain("the class `aurora-card` lacks the r-renderer- prefix");
    // `0px` is no length, and a token read is fine.
    expect(out).not.toContain("border-width");
    expect(out).not.toContain("p-r3");
    expect(out).toMatch(/— 9 problem\(s\)/);
  });

  it("passes token-only CSS whose vocabulary compiles", () => {
    const result = run(join(HERE, "fixtures/class-vocabulary/good"));
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/OK \(2 classes compile/);
  });

  it("passes this package", () => {
    const result = run();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
