// @vitest-environment node
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { cssPackageDir } from "./lib/css.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
// On disk, never in /tmp.
const SCRATCH = join(HERE, "..", "node_modules", ".cache", "r-ui-renderer-gates", `theme-${process.pid}`);
const BEGIN = "/* GENERATED:theme (scripts/derive-theme.mjs); do not edit by hand */";
const END = "/* /GENERATED:theme */";

const run = (...args) => spawnSync(process.execPath, [join(HERE, "derive-theme.mjs"), ...args], { encoding: "utf8" });

function tree(name, styles) {
  const root = join(SCRATCH, name);
  mkdirSync(join(root, "src", "spec"), { recursive: true });
  writeFileSync(join(root, "src", "styles.css"), styles);
  return root;
}

/** A copy of the installed CSS package whose theme template `edit` rewrites. */
function cssCopy(name, edit) {
  const dir = join(SCRATCH, `css-${name}`);
  for (const part of ["src", "scripts", "package.json"]) cpSync(join(cssPackageDir(), part), join(dir, part), { recursive: true });
  const template = join(dir, "src", "_theme-template.css");
  writeFileSync(template, edit(readFileSync(template, "utf8")));
  return dir;
}

afterAll(() => rmSync(SCRATCH, { recursive: true, force: true }));

describe("derive-theme", { timeout: 30_000 }, () => {
  it("writes the roles, the pairs and the stylesheet region, keeps the rest of the stylesheet, and --check agrees", () => {
    const root = tree("fresh", `@layer components {\n${BEGIN}\n${END}\n}\n`);
    expect(run("--root", root).status).toBe(0);
    const contract = JSON.parse(readFileSync(join(root, "src", "spec", "theme-contract.json"), "utf8"));
    expect(contract.tokens.map((token) => token.name)).toContain("--C-CANVAS");
    expect(contract.tokens.find((token) => token.name === "--C-SCRIM").translucent).toBe(true);
    expect(contract.pairs).toContainEqual({ fg: "--C-TEXT-PRIMARY", bg: "--C-CANVAS", min: 4.5, kind: "text" });
    expect(contract.scheme).toEqual({ text: "--C-TEXT-PRIMARY", canvas: "--C-CANVAS" });
    const styles = readFileSync(join(root, "src", "styles.css"), "utf8");
    expect(styles.startsWith(`@layer components {\n${BEGIN}\n`)).toBe(true);
    expect(styles.endsWith(`${END}\n}\n`)).toBe(true);
    expect(styles).toContain("--C-BORDER: var(--C-BORDER-STRONG) !important;");
    for (const { name } of contract.tokens) expect(styles).toContain(`${name}: inherit !important;`);
    const check = run("--check", "--root", root);
    expect(check.stderr).toBe("");
    expect(check.status).toBe(0);
  });

  it("follows the CSS package: a role added to its template is a role here", () => {
    const css = cssCopy("added", (text) => text.replace("  --C-FOCUS:", "  --C-HALO: oklch(0.6 0.1 200); /* a glow */\n  --C-FOCUS:"));
    const root = tree("added", `${BEGIN}\n${END}\n`);
    expect(run("--root", root, "--css", css).status).toBe(0);
    const contract = JSON.parse(readFileSync(join(root, "src", "spec", "theme-contract.json"), "utf8"));
    expect(contract.tokens.find((token) => token.name === "--C-HALO")).toEqual({ name: "--C-HALO", role: "a glow", utilities: [], translucent: false });
    expect(run("--check", "--root", root).status).toBe(1);
  });

  it("refuses a template that writes a measured role translucent", () => {
    const css = cssCopy("translucent", (text) => text.replace(/--C-TEXT-MUTED: oklch\(([^)]*)\)/, "--C-TEXT-MUTED: oklch($1 / 0.6)"));
    const result = run("--root", tree("translucent", `${BEGIN}\n${END}\n`), "--css", css);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--C-TEXT-MUTED is in a contrast pair but the template writes it translucent");
  });

  it("--check goes red on a hand-edited contract or region, naming the file", () => {
    const root = tree("stale", `${BEGIN}\n${END}\n`);
    expect(run("--root", root).status).toBe(0);
    const contract = join(root, "src", "spec", "theme-contract.json");
    writeFileSync(contract, readFileSync(contract, "utf8").replace('"min": 4.5', '"min": 3'));
    const result = run("--check", "--root", root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("stale: src/spec/theme-contract.json");
    expect(result.stderr).not.toContain("styles.css");
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
