// @vitest-environment node
import { mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { lockHolder, releaseLock, tryLock } from "./lock.mjs";
import { loadScripts, parseArgs, parseTags, planShards, selectForChanges, selectScripts, shardCount } from "./plan.mjs";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const script = (name, covers, flags = [], cost = null) => ({ name, file: `${name}.js`, tags: { covers, flags, cost, problems: [] } });

describe("the browser checks' headers", () => {
  it("parse every tag, and name what is malformed", () => {
    const good = parseTags("// @covers corpus, stream\n// @flags timing\n// @cost 25\n//\n// prose\nasync (page) => {\n};\n");
    expect(good).toEqual({ covers: ["corpus", "stream"], flags: ["timing"], cost: 25, problems: [] });
    const bad = parseTags("// @covers a\n// @covers b\n// @flags slow\n// @tier page\n// @cost soon\nconst x = 1;\n");
    expect(bad.problems).toEqual(["@covers given twice", "unknown tag @tier", "unknown flag slow", "not an `async (page) => …` expression", "@cost is not a positive number of seconds"]);
    expect(parseTags("// prose only\nasync (page) => {};").problems).toEqual(["no @covers"]);
  });

  it("hold in every shipped check", () => {
    const scripts = loadScripts(PKG);
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.filter((s) => s.tags.problems.length > 0).map((s) => [s.name, s.tags.problems])).toEqual([]);
    // corpus-: drives documents at `?view=`; playground-: drives the playground's own routes.
    for (const s of scripts) expect(/^(corpus|playground)-/.test(s.name), s.name).toBe(true);
  });
});

describe("the command line", () => {
  it("reads filters, lists, switches and both value spellings", () => {
    expect(parseArgs(["dialog", "--group", "forms,data", "--group=stream", "--changed", "--list", "--shards=2", "--production"])).toEqual({
      names: ["dialog"],
      groups: ["forms", "data", "stream"],
      changed: "HEAD",
      list: true,
      print: null,
      target: "production",
      shards: 2,
    });
    expect(parseArgs(["--changed=main", "--print", "corpus-stream"])).toMatchObject({ changed: "main", print: "corpus-stream" });
  });

  it("refuses an unknown option, a bad shard count and two targets", () => {
    expect(() => parseArgs(["--fast"])).toThrow("unknown option --fast");
    expect(() => parseArgs(["--shards", "0"])).toThrow("--shards");
    expect(() => parseArgs(["--dev", "--production"])).toThrow("exclude each other");
  });
});

describe("selection", () => {
  const scripts = [script("corpus-a", ["corpus"]), script("corpus-b", ["forms", "data"]), script("corpus-c", ["stream"], ["timing"])];

  it("narrows across kinds and widens within one", () => {
    expect(selectScripts(scripts, { groups: ["forms", "stream"] }).map((s) => s.name)).toEqual(["corpus-b", "corpus-c"]);
    expect(selectScripts(scripts, { names: ["-a", "-c"], groups: ["stream"] }).map((s) => s.name)).toEqual(["corpus-c"]);
    expect(selectScripts(scripts, {})).toHaveLength(3);
  });

  it("by changed files: a check selects itself, what a browser can show selects every check, the rest nothing", () => {
    expect([...selectForChanges(["scripts/browser/corpus-b.js"], scripts).keys()]).toEqual(["corpus-b"]);
    for (const path of ["src/render/props.ts", "playground/App.tsx", "src/examples/ops-dashboard.json", "scripts/browser/lib/prelude.js", "../r-ui-react-components/src/components/data/DataTable.tsx"]) {
      expect([...selectForChanges([path], scripts).keys()], path).toEqual(["corpus-a", "corpus-b", "corpus-c"]);
    }
    expect(selectForChanges(["src/render/props.test.ts", "VIEWSPEC.md", "memory/README.md", "../r-ui-tw-merge/src/index.ts"], scripts).size).toBe(0);
    expect(selectForChanges(["playground/App.tsx"], scripts).get("corpus-a")).toEqual(["playground/App.tsx"]);
  });
});

describe("the plan", () => {
  it("fits the shards to the memory, capped by the cap and the script count", () => {
    expect(shardCount(10, 1.0)).toBe(1);
    expect(shardCount(10, 3.6)).toBe(2);
    expect(shardCount(10, 64)).toBe(4);
    expect(shardCount(2, 64)).toBe(2);
    expect(shardCount(10, 64, 3)).toBe(3);
    expect(shardCount(10, 64, 9)).toBe(4);
  });

  it("packs longest first onto the lightest shard and holds the timing checks back", () => {
    const plan = planShards(
      [script("a", ["x"], [], 40), script("b", ["x"], [], 30), script("c", ["x"], [], 20), script("d", ["x"], [], 15), script("t", ["x"], ["timing"], 99)],
      2,
      { c: 5 },
    );
    expect(plan.shards.map((shard) => shard.scripts.map((s) => s.name))).toEqual([["a", "c"], ["b", "d"]]);
    expect(plan.timing.map((s) => s.name)).toEqual(["t"]);
    expect(planShards([script("t", ["x"], ["timing"])], 2).shards).toEqual([]);
  });
});

describe("the browser lock", () => {
  const dir = join(PKG, "node_modules/.cache/r-ui-renderer-browser-check", `lock-test-${process.pid}`);
  const lock = join(dir, "browser.lock");
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("is taken once, held against others, and released only by its holder", () => {
    expect(tryLock(lock, "run-1", { now: Date.parse("2026-10-21T09:00:00Z") })).toBe(true);
    expect(lockHolder(lock)).toBe("run-1 2026-10-21T09:00:00.000Z");
    expect(tryLock(lock, "run-2")).toBe(false);
    releaseLock(lock, "run-2");
    expect(lockHolder(lock)).not.toBeNull();
    releaseLock(lock, "run-1");
    expect(lockHolder(lock)).toBeNull();
    expect(tryLock(lock, "run-2")).toBe(true);
  });

  it("takes over a lock older than the stale limit, never a younger one", () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(lock, "gone-run 2026-10-20T01:00:00.000Z\n");
    const then = Date.now() / 1000 - 3 * 60 * 60;
    utimesSync(lock, then, then);
    expect(tryLock(lock, "run-3", { staleMs: 2 * 60 * 60 * 1000 })).toBe(true);
    expect(readFileSync(lock, "utf8")).toMatch(/^run-3 /);
    expect(tryLock(lock, "run-4", { staleMs: 2 * 60 * 60 * 1000 })).toBe(false);
  });
});
