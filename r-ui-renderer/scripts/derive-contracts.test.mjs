// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures", "derive-contracts");
// On disk, never in /tmp.
const SCRATCH = join(HERE, "..", "node_modules", ".cache", "r-ui-renderer-gates", `derive-contracts-${process.pid}`);

const run = (...args) => spawnSync(process.execPath, [join(HERE, "derive-contracts.mjs"), ...args], { encoding: "utf8" });

function outDir(name) {
  const dir = join(SCRATCH, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

afterAll(() => rmSync(SCRATCH, { recursive: true, force: true }));

describe("derive-contracts", { timeout: 60_000 }, () => {
  it("reads props, value sets, slots, node props, Dates, callbacks and parts off a library's declarations", () => {
    const out = outDir("good");
    const written = run("--library", join(FIXTURES, "good"), "--out", out);
    expect(written.stderr).toBe("");
    expect(written.status).toBe(0);
    const { library, components } = JSON.parse(readFileSync(join(out, "components.json"), "utf8"));
    expect(library).toEqual({ name: "fixture-library", version: "1.0.0" });
    expect(Object.keys(components)).toEqual(["Dial", "Dial.Knob", "Dial.Needle"]);
    expect(components.Dial).toEqual({
      category: "gauges",
      props: [
        { name: "format", type: "(value: number) => string", required: false },
        { name: "label", type: "ReactNode", required: true },
        { name: "onTurn", type: "(at: Date) => void", required: false },
        { name: "size", type: '"small" | "large"', required: false },
        { name: "when", type: "Date", required: false },
      ],
      slots: ["face", "needle"],
      propEnums: { size: ["small", "large"] },
      nodeProps: ["label"],
      nativeAttributes: true,
    });
    expect(components["Dial.Needle"].nativeAttributes).toBeUndefined();
    // An <input>'s native attributes carry a DOM `name`; a <div>'s do not.
    expect(components["Dial.Knob"]).toMatchObject({ nativeAttributes: true, domName: true });
    expect(components.Dial.domName).toBeUndefined();
    // Doc sentences are the reference's alone, in their own file: the first sentence only.
    expect(JSON.parse(readFileSync(join(out, "prop-docs.json"), "utf8"))).toEqual({ Dial: [{ name: "size", description: "How big." }] });
    const paths = JSON.parse(readFileSync(join(out, "declared-paths.json"), "utf8"));
    expect(paths.Dial).toEqual({
      paths: ["format", "label", "onTurn", "size", "when"],
      functions: ["format", "onTurn"],
      dates: ["when"],
      dateCallbacks: ["onTurn"],
    });
  });

  it("--check passes a fresh generation and goes red on a stale or missing file, naming it", () => {
    const out = outDir("check");
    expect(run("--library", join(FIXTURES, "good"), "--out", out).status).toBe(0);
    const fresh = run("--check", "--library", join(FIXTURES, "good"), "--out", out);
    expect(fresh.stderr).toBe("");
    expect(fresh.status).toBe(0);

    const file = join(out, "prop-docs.json");
    writeFileSync(file, readFileSync(file, "utf8").replace('"How big."', '"How large."'));
    const stale = run("--check", "--library", join(FIXTURES, "good"), "--out", out);
    expect(stale.status).toBe(1);
    expect(stale.stderr).toMatch(/stale: \S*prop-docs\.json\n/);
    expect(stale.stderr).not.toContain("components.json");
    expect(stale.stderr).not.toContain("declared-paths.json");

    rmSync(join(out, "declared-paths.json"));
    const missing = run("--check", "--library", join(FIXTURES, "good"), "--out", out);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("declared-paths.json");
  });

  it("throws on a runtime export the declarations lack", () => {
    const result = run("--check", "--library", join(FIXTURES, "missing-declaration"), "--out", outDir("missing"));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("the runtime barrel exports names its declarations");
    expect(result.stderr).toContain("'Gauge'");
  });

  it("throws on a public classNames no component's props reach", () => {
    const result = run("--check", "--library", join(FIXTURES, "orphan-slots"), "--out", outDir("orphan"));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("classNames declared where no component's props reach it");
    expect(result.stderr).toContain("dist/components/gauges/Dial.d.ts:6");
  });

  it("--check passes this package against the installed library", () => {
    const result = run("--check");
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/OK \(\d{3} components and parts\)/);
  });
});
