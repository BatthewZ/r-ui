// @vitest-environment node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkToken } from "./lib/raw-tailwind.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const run = (root) =>
  spawnSync(process.execPath, [join(HERE, "verify-no-raw-tailwind.mjs"), "--root", root], {
    encoding: "utf8",
  });

describe("verify:no-raw-tailwind", () => {
  it("goes red on the bad fixture and names every violation", () => {
    const result = run(join(HERE, "fixtures/raw-tailwind/bad"));
    expect(result.status).toBe(1);
    const out = result.stderr;
    for (const token of [
      "`p-4`", "`gap-2`", "`h-8`", "`w-9`", "`min-w-45`", "`-mt-4`", "`md:hover:mt-4`",
      "`px-3`", "`py-1.5`",
      "`text-sm`", "`text-xs`",
      "`bg-blue-500`", "`text-white`", "`ring-black/50`",
      "bare `rounded`", "bare `shadow`", "bare `rounded-t`",
      "raw length 12px in `p-[12px]`", "raw hex colour in `bg-[#fff]`", "raw length 3rem in `w-[3rem]`",
      "raw colour function in `text-[oklch(0.5_0.1_200)]`", "raw length 12px in `12px`",
      "raw hex colour in `#ff0000`",
    ]) {
      expect(out).toContain(token);
    }
    // The hoisted constant is reported at its own line, not where it is used.
    expect(out).toMatch(/Bad\.tsx:3 {2}spacing default `px-3`/);
    // Comments are never class lists.
    expect(out).not.toMatch(/Bad\.tsx:2 /);
    // The stylesheet: raw px, rem, hex, rgb(), @apply defaults and a px media query.
    expect(out).toMatch(/styles\.css:3 {2}raw length 12px/);
    expect(out).toMatch(/styles\.css:4 {2}raw length 0\.5rem/);
    expect(out).toMatch(/styles\.css:5 {2}raw hex colour/);
    expect(out).toMatch(/styles\.css:6 {2}raw colour function/);
    expect(out).toMatch(/styles\.css:9 {2}spacing default `p-4`/);
    expect(out).toMatch(/styles\.css:9 {2}default text size `text-sm`/);
    expect(out).toMatch(/styles\.css:11 {2}raw length 640px/);
    expect(out).not.toMatch(/styles\.css:1 /);
  });

  it("passes the good fixture: tokens, 0, px, full, fractions, keywords, var() values", () => {
    const result = run(join(HERE, "fixtures/raw-tailwind/good"));
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("allows a named default only when a @theme block declares that exact name", () => {
    expect(checkToken("rounded-md")).toMatch(/default radius/);
    expect(checkToken("rounded-md", { radius: new Set(["md"]) })).toBeNull();
    expect(checkToken("text-sm", { text: new Set(["sm"]) })).toBeNull();
    // A numeric spacing value is never a token, whatever is declared.
    expect(checkToken("p-4", { spacing: new Set(["4"]) })).toMatch(/spacing default/);
  });
});
