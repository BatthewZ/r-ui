// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
// On disk, never in /tmp.
const SCRATCH = join(HERE, "..", "node_modules", ".cache", "r-ui-renderer-gates", `class-vocabulary-${process.pid}`);
const BEGIN = "/* GENERATED:class-vocabulary (scripts/derive-class-vocabulary.mjs); do not edit by hand */";
const END = "/* /GENERATED:class-vocabulary */";

const run = (...args) => spawnSync(process.execPath, [join(HERE, "derive-class-vocabulary.mjs"), ...args], { encoding: "utf8" });

function tree(name, styles) {
  const root = join(SCRATCH, name);
  mkdirSync(join(root, "src", "spec"), { recursive: true });
  writeFileSync(join(root, "src", "styles.css"), styles);
  return root;
}

afterAll(() => rmSync(SCRATCH, { recursive: true, force: true }));

describe("derive-class-vocabulary", { timeout: 30_000 }, () => {
  it("writes the list and the stylesheet's @source lines, keeps the rest of the stylesheet, and --check agrees", () => {
    const root = tree("fresh", `/* head */\n${BEGIN}\n${END}\n.r-renderer-view { display: block; }\n`);
    expect(run("--root", root).status).toBe(0);
    const classes = JSON.parse(readFileSync(join(root, "src", "spec", "class-vocabulary.json"), "utf8"));
    expect(classes).toContain("p-r3");
    expect(classes).toContain("text-fg-secondary");
    expect(classes).not.toContain("p-4");
    const styles = readFileSync(join(root, "src", "styles.css"), "utf8");
    expect(styles.startsWith(`/* head */\n${BEGIN}\n@source inline("`)).toBe(true);
    expect(styles.endsWith(`${END}\n.r-renderer-view { display: block; }\n`)).toBe(true);
    const listed = [...styles.matchAll(/@source inline\("([^"]*)"\);/g)].flatMap((m) => m[1].split(" "));
    expect(listed).toEqual(classes);
    const check = run("--check", "--root", root);
    expect(check.stderr).toBe("");
    expect(check.status).toBe(0);
  });

  it("--check goes red on a hand-edited list or stylesheet, naming the file", () => {
    const root = tree("stale", `${BEGIN}\n${END}\n`);
    expect(run("--root", root).status).toBe(0);
    const styles = join(root, "src", "styles.css");
    writeFileSync(styles, readFileSync(styles, "utf8").replace(" p-r3 ", " p-4 "));
    const result = run("--check", "--root", root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("stale: src/styles.css");
    expect(result.stderr).not.toContain("class-vocabulary.json");
  });

  it("throws on a stylesheet without the markers", () => {
    const result = run("--check", "--root", tree("unmarked", ".r-renderer-view { display: block; }\n"));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("markers are missing");
  });

  it("--check passes this package", () => {
    const result = run("--check");
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
