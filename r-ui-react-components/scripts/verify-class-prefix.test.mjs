// @vitest-environment node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const run = (root) =>
  spawnSync(process.execPath, [join(HERE, "verify-class-prefix.mjs"), "--root", root], { encoding: "utf8" });

// Each case runs the gate as a subprocess, which can take seconds while the full suite loads every core.
describe("verify:class-prefix", { timeout: 30_000 }, () => {
  it("goes red on every unprefixed class and keyframes name, and only those", () => {
    const result = run(join(HERE, "fixtures/class-prefix/bad"));
    expect(result.status).toBe(1);
    const out = result.stderr;
    expect(out).toMatch(/demo\/styles\.css:5 {2}class `r-hit` must start with `r-demo-`/);
    expect(out).toMatch(/demo\/styles\.css:6 {2}class `demo-card` must start with `r-demo-`/);
    expect(out).toMatch(/demo\/styles\.css:12 {2}keyframes `slide-in` must start with `r-demo-`/);
    expect(out).toMatch(/shared\.css:1 {2}class `top-layer` must start with `r-shared-`/);
    // A rule with no class of its own writes page-wide: only the owner's hook.
    expect(out).toMatch(/demo\/styles\.css:20 {2}page-wide custom property `--C-ACCENT` must start with `--r-demo-`/);
    expect(out).not.toMatch(/--r-demo-height/);
    // A comment and a name only referenced inside :has() are not definitions.
    expect(out).not.toMatch(/comment-class|someone-elses|`r-demo-ok`/);
    expect(out).toMatch(/— 5 unprefixed name\(s\)/);
  });

  it("passes prefixed names, references inside :is(), names inside at-rules, a class rule's custom property and tokens.css", () => {
    const result = run(join(HERE, "fixtures/class-prefix/good"));
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/OK \(7 name\(s\) in 3 stylesheet\(s\)\)/);
  });
});
