// @vitest-environment node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkToken } from "./lib/raw-tailwind.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const run = (root) =>
  spawnSync(process.execPath, [join(HERE, "verify-no-raw-tailwind.mjs"), "--root", root], {
    encoding: "utf8",
  });

// Each case runs the gate as a subprocess, which can take seconds while the full suite loads every core.
describe("verify:no-raw-tailwind", { timeout: 30_000 }, () => {
  it("goes red on the bad fixture and names every violation at its own line", () => {
    const result = run(join(HERE, "fixtures/raw-tailwind/bad"));
    expect(result.status).toBe(1);
    const out = result.stderr;
    const BAD = "src/components/demo/Bad.tsx";
    const CSS = "src/components/demo/styles.css";
    /** Each finding is `<file>:<line>  <problem>` on a line of its own. */
    const expectAt = (file, line, problem) =>
      expect(out).toMatch(new RegExp(`\\n {2}${escape(`${file}:${line}  ${problem}`)}`));
    const expected = [
      // The hoisted constant is reported at its own line, not where it is used.
      [BAD, 3, "spacing default `px-3`"], [BAD, 3, "spacing default `py-1.5`"],
      ...["p-4", "gap-2", "h-8", "w-9", "min-w-45", "-mt-4", "md:hover:mt-4"].map((t) => [BAD, 6, `spacing default \`${t}\``]),
      [BAD, 7, "default text size `text-sm`"], [BAD, 7, "default text size `text-xs`"],
      ...["bg-blue-500", "text-white", "ring-black/50"].map((t) => [BAD, 8, `default palette colour \`${t}\``]),
      [BAD, 9, "bare `rounded`"], [BAD, 9, "bare `shadow`"], [BAD, 9, "bare `rounded-t`"],
      [BAD, 10, "raw length 12px in `p-[12px]`"], [BAD, 10, "raw hex colour in `bg-[#fff]`"],
      [BAD, 10, "raw length 3rem in `w-[3rem]`"], [BAD, 10, "raw colour function in `text-[oklch(0.5_0.1_200)]`"],
      [BAD, 11, "raw length 12px in `12px`"], [BAD, 11, "raw hex colour in `#ff0000`"],
      [BAD, 12, "numeric stacking `z-10`"],
      // A negative length is still a raw length; an arbitrary z-index is still a number.
      [BAD, 13, "raw length -12px in `mt-[-12px]`"], [BAD, 13, "numeric stacking `z-[5]`"], [BAD, 13, "raw length -8px in `-8px`"],
      // A numbered line width or offset is a fixed px weight beside the theme's --BORDER-WIDTH.
      ...["border-2", "border-t-4", "divide-x-2", "ring-2", "outline-offset-2"].map((t) => [BAD, 14, `fixed line width \`${t}\``]),
      // Font-relative, viewport and container units are raw lengths too; `_` is a space in an arbitrary value.
      [BAD, 15, "raw length 0.25em in `mt-[0.25em]`"], [BAD, 15, "raw length 8ch in `w-[8ch]`"],
      [BAD, 15, "raw length 100vw in `max-w-[calc(100vw-var(--R-SIZE-2)*2)]`"], [BAD, 15, "raw length 50dvh in `h-[50dvh]`"],
      [BAD, 15, "raw length 38cqi in `text-[38cqi]`"], [BAD, 15, "raw length 12px in `p-[0_12px]`"],
      // A 1px line inside a line utility's arbitrary value, and in a style object's line property.
      [BAD, 16, "fixed line width `shadow-[inset_0_0_0_1px_var(--C-BORDER)]`"], [BAD, 16, "fixed line width `outline-[1px]`"],
      [BAD, 16, "fixed line width `aria-selected:ring-[1px]`"],
      [BAD, 17, 'fixed line weight in `boxShadow: "inset 0 0 0 1px var(--C-BORDER)"`'],
      [BAD, 17, 'fixed line weight in `outlineWidth: "1px"`'], [BAD, 17, 'fixed line weight in `borderWidth: "1px"`'],
      [BAD, 17, "raw length -1.25em in `-1.25em`"],
      // The stylesheet: raw px, rem, hex, rgb(), @apply defaults and a px media query.
      [CSS, 3, "raw length 12px"], [CSS, 4, "raw length 0.5rem"], [CSS, 5, "raw hex colour"], [CSS, 6, "raw colour function"],
      [CSS, 9, "spacing default `p-4`"], [CSS, 9, "default text size `text-sm`"], [CSS, 11, "raw length 640px"],
      // In-flow stacking reads the layer scale; structural lines read --BORDER-WIDTH.
      [CSS, 15, "numeric stacking in `z-index: 5;`"],
      [CSS, 16, "fixed line weight in `border-block-end: 1px solid"], [CSS, 17, "fixed line weight in `border-top-width: 1px;`"],
      [CSS, 20, "raw length -12px in `margin-inline-start: -12px;`"],
      // Box-shadow and outline lines; em, vw and container-query lengths; a declaration over lines reads as one.
      [CSS, 23, "fixed line weight in `box-shadow: inset 0 0 0 1px var(--C-BORDER);`"],
      [CSS, 24, "fixed line weight in `outline: 1px solid transparent;`"], [CSS, 25, "fixed line weight in `outline-offset: 1px;`"],
      [CSS, 26, "raw length -0.15em in `vertical-align: -0.15em;`"],
      [CSS, 27, "raw length 100vw in `inline-size: min( calc(100vw - var(--R-SIZE-2) * 2) );`"],
      [CSS, 31, "raw length 20em in `@container (inline-size > 20em)`"],
      // The examples exemption is the showcase's alone.
      ["src/components/demo/palette.examples.ts", 2, "raw hex colour"],
      // A look outside components/ (util, a shared stylesheet, a hook) is scanned too.
      ["src/util/look.tsx", 2, "spacing default `p-4`"], ["src/print.css", 2, "raw length 12px"],
      ["src/hooks/use-margin.ts", 2, "raw length -80px in `-80px`"],
      // A `.ts` file is read as TypeScript: a generic arrow does not hide the strings after it.
      ["src/components/demo/generic.ts", 3, "spacing default `p-4`"],
      // A bare word is a class where a class context reaches it (the hoisted constant), and a word elsewhere.
      ["src/components/demo/words.tsx", 3, "bare `shadow`"],
      // The showcase is held to the same vocabulary.
      ["showcase/Bad.tsx", 2, "spacing default `p-4`"], ["showcase/Bad.tsx", 2, "raw length 3rem in `w-[3rem]`"],
      ["showcase/Bad.tsx", 2, 'fixed line weight in `boxShadow: "0 0 0 1px var(--C-BORDER)"`'],
      // An allowance is one exact declaration: a near-copy in the same file is reported.
      ["src/components/overlays/styles.css", 3, "raw length 100vw in `max-inline-size: min(var(--r-overlays-measure, var(--MEASURE)), 100vw - var(--R-SIZE-2));`"],
    ];
    for (const [file, line, problem] of expected) expectAt(file, line, problem);
    // Every finding is one listed above: nothing reported twice, nothing extra.
    expect(out).toMatch(new RegExp(`— ${expected.length} raw value\\(s\\)`));
    // Comments are never class lists.
    expect(out).not.toMatch(/demo\/Bad\.tsx:2 /);
    expect(out).not.toMatch(/styles\.css:1 /);
    expect(out).not.toMatch(/demo\/words\.tsx:2 /);
  });

  it("passes the good fixture: tokens, 0, px, full, fractions, keywords, var() values, unit lengths, the layer scale, words in data, showcase example data, the token file and the allowance", () => {
    const result = run(join(HERE, "fixtures/raw-tailwind/good"));
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    // Good.tsx, the word list, both stylesheets, the hook and the showcase page: the token file and the example
    // data are out of scope, and the overlays stylesheet holds the one allowance, exactly.
    expect(result.stdout).toMatch(/OK \(6 file\(s\)/);
  });

  it("allows a named default only when a @theme block declares that exact name", () => {
    expect(checkToken("rounded-md")).toMatch(/default radius/);
    expect(checkToken("rounded-md", { radius: new Set(["md"]) })).toBeNull();
    expect(checkToken("text-sm", { text: new Set(["sm"]) })).toBeNull();
    // A numeric spacing value is never a token, whatever is declared.
    expect(checkToken("p-4", { spacing: new Set(["4"]) })).toMatch(/spacing default/);
  });
});
