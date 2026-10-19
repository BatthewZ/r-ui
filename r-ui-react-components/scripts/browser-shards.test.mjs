// @vitest-environment node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { planShards, shardCount, shuffled } from "./lib/browser-shards.mjs";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = (name, { tier = "component", flags = [], cost = null } = {}) => ({ name, tags: { tier, flags, cost } });
const names = (list) => list.map((s) => s.name);

describe("browser-check shards", () => {
  it("packs longest first onto the lightest shard, by recorded time, then @cost, then tier", () => {
    const scripts = [script("a"), script("b", { cost: 40 }), script("c", { tier: "sweep" }), script("d"), script("e")];
    // c 60 (sweep default), b 40 (@cost), e 25 (recorded), a 10, d 10.
    const { shards } = planShards(scripts, 2, { durations: { e: 25 } });
    expect(shards.map((s) => names(s.scripts))).toEqual([["c", "a"], ["b", "e", "d"]]);
    expect(shards.map((s) => s.seconds)).toEqual([70, 75]);
  });

  it("holds timing scripts out for the serial tail and puts touch scripts last in their shard", () => {
    const scripts = [script("touchy", { flags: ["touch"], cost: 90 }), script("long", { cost: 50 }), script("short"), script("timed", { flags: ["timing"] })];
    const { shards, timing } = planShards(scripts, 1);
    expect(names(shards[0].scripts)).toEqual(["long", "short", "touchy"]);
    expect(names(timing)).toEqual(["timed"]);
  });

  it("shuffles inside each list by its seed, repeatably, touch scripts still last", () => {
    const many = Array.from({ length: 12 }, (_, i) => script(`s${String(i).padStart(2, "0")}`));
    const scripts = [...many, script("touchy", { flags: ["touch"] })];
    const plain = planShards(scripts, 1).shards[0].scripts;
    const once = planShards(scripts, 1, { shuffle: 7 }).shards[0].scripts;
    expect(names(planShards(scripts, 1, { shuffle: 7 }).shards[0].scripts)).toEqual(names(once));
    expect(names(once)).not.toEqual(names(plain));
    expect(names(once).sort()).toEqual(names(plain).sort());
    expect(once.at(-1).name).toBe("touchy");
    expect(shuffled([1, 2, 3, 4, 5], 3)).toEqual(shuffled([1, 2, 3, 4, 5], 3));
  });

  it("sizes the shards from the memory, capped at 4, at 3 with a sweep and at the script count", () => {
    const components = Array.from({ length: 10 }, (_, i) => script(`c${i}`));
    expect(shardCount(components, 12)).toMatchObject({ n: 4, perSessionGb: 1, capped: true });
    expect(shardCount(components, 3.6)).toMatchObject({ n: 2, capped: false });
    expect(shardCount([...components, script("p", { tier: "page" })], 4)).toMatchObject({ n: 2, perSessionGb: 1.2 });
    expect(shardCount([...components, script("s", { tier: "sweep" })], 19)).toMatchObject({ n: 3, perSessionGb: 2.8, capped: true });
    expect(shardCount([...components, script("s", { tier: "sweep" })], 5)).toMatchObject({ n: 1 });
    expect(shardCount(components.slice(0, 2), 12)).toMatchObject({ n: 2, capped: false });
    expect(shardCount(components, 12, 9)).toMatchObject({ n: 4, capped: true });
    expect(shardCount(components, 1)).toMatchObject({ n: 1 });
  });

  it("prints the plan without opening a browser", { timeout: 30_000 }, () => {
    const listed = spawnSync(process.execPath, ["scripts/browser-check.mjs", "--list", "--shards", "2", "--tier", "sweep"], { cwd: PKG, encoding: "utf8" });
    expect(listed.status).toBe(0);
    expect(listed.stdout).toMatch(/^ {2}shard 1 \(~\d+s\): /m);
    expect(listed.stdout).toMatch(/^ {2}shard 2 \(~\d+s\): /m);
    expect(listed.stdout).toMatch(/^ {2}timing, after the shards: none$/m);
  });
});
