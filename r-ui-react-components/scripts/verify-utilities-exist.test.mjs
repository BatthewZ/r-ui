// @vitest-environment node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const run = (root) =>
  spawnSync(process.execPath, [join(HERE, "verify-utilities-exist.mjs"), "--root", root], {
    encoding: "utf8",
  });

// Each case runs the gate as a subprocess, which can take seconds while the full suite loads every core.
describe("verify:utilities-exist", { timeout: 30_000 }, () => {
  it("goes red on the bad fixture and names every dead class", () => {
    const result = run(join(HERE, "fixtures/utilities-exist/bad"));
    expect(result.status).toBe(1);
    const out = result.stderr;
    for (const line of [
      /Bad\.tsx:7 {2}`font-bold` generates no CSS/,
      /Bad\.tsx:8 {2}`text-sm` generates no CSS/,
      /Bad\.tsx:8 {2}`leading-tight` generates no CSS/,
      // Followed from the lookup table to the line that declares it.
      /Bad\.tsx:3 {2}`bg-gray-100` generates no CSS/,
      /Bad\.tsx:9 {2}`rounded` generates no CSS/,
      /Bad\.tsx:9 {2}`hover:tracking-tight` generates no CSS/,
      /Bad\.tsx:10 {2}dynamic class fragment `bg-`/,
      /Bad\.tsx:11 {2}`no-such-class` is neither a utility nor a class/,
      /Page\.tsx:2 {2}`shadow-xl` generates no CSS/,
      /Page\.tsx:2 {2}`ease-in-out` generates no CSS/,
      /Page\.tsx:2 {2}`sc-not-in-css` is neither a utility nor a class/,
      // Branches of `&&` and `? :` are still class contexts.
      /Branches\.tsx:6 {2}`shadow-2xl` generates no CSS/,
      /Branches\.tsx:6 {2}`text-xs` generates no CSS/,
      // Class-named tables used as classes: in this file, and from another file.
      /Tables\.tsx:3 {2}`no-such-row` is neither a utility nor a class/,
      /Tables\.tsx:4 {2}`no-such-tone` is neither a utility nor a class/,
      // Imported under an alias: matched by the name the module exports.
      /Tables\.tsx:6 {2}`no-such-size` is neither a utility nor a class/,
      // A class-named table nobody uses as classes is still checked for utilities.
      /Tables\.tsx:5 {2}`font-black` generates no CSS/,
      // A `.ts` file is read as TypeScript: a generic arrow does not hide what follows it.
      /generic\.ts:3 {2}`font-black` generates no CSS/,
    ]) {
      expect(out).toMatch(line);
    }
    // Live tokens on the same lines are not reported, and comments never are.
    for (const live of ["p-r3", "text-fg-muted", "text-fg-primary"]) {
      expect(out).not.toMatch(new RegExp(`:\\d+ {2}\`${live}\``));
    }
    expect(out).not.toMatch(/Bad\.tsx:2 /);
    // The values tested in front of those branches are not classes.
    expect(out).not.toMatch(/`(wide|narrow)`/);
    expect(out).toMatch(/— 18 dead class\(es\)/);
  });

  it("passes the good fixture: tokens, variants, markers, package classes, followed constants, defaults behind comparisons, a class-named table of labels, a same-named local class list elsewhere", () => {
    const result = run(join(HERE, "fixtures/utilities-exist/good"));
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/OK \(\d+ class token\(s\) in 5 file\(s\)\)/);
  });
});
