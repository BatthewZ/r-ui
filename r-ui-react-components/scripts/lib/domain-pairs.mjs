// The rules behind `verify:domain-pairs`, importable for the gate's own test.
//
// Every domain colour is a LIGHT/DARK named pair blended by --SCHEME-DARK at
// the read (src/tokens.css explains why). This asserts the shape that makes
// that true:
//   1. Every `--X-LIGHT` on :root has a `--X-DARK`, and vice versa.
//   2. Every half is a plain `oklch(L C H)` literal (the palette gate reads them).
//   3. Every `--color-*` in `@theme` is EITHER the canonical blend of one
//      declared pair, OR a `var(--NAME)` alias of a name this file does not
//      declare (a contract role, e.g. trend-flat -> --C-TEXT-SECONDARY).
//      A raw literal, a mismatched pair or a half read alone is a failure.
//   4. Every pair is exposed by some `@theme` blend (an orphan pair has no
//      utility and nothing can read it correctly).
//   5. No other declaration in the file carries a raw colour literal.
// And, for component sources, a `var(--X-LIGHT)` / `var(--X-DARK)` read
// outside the canonical blend ignores the scheme and is a failure.

import { blankComments, lineAt, readBlocks } from "./css.mjs";
import { parseOklch } from "./color.mjs";

const BLEND =
  /^color-mix\(\s*in oklch,\s*var\(--([A-Z0-9-]+)-LIGHT\),\s*var\(--\1-DARK\)\s+calc\(\s*var\(--SCHEME-DARK\)\s*\*\s*100%\s*\)\s*\)$/;
const ALIAS = /^var\(\s*(--[A-Za-z0-9-]+)\s*\)$/;
const RAW_COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[\d.]/;

/** Problems in the domain token file. Returns `{ problems, pairs }`. */
export function checkTokens(css, file = "src/tokens.css") {
  const problems = [];
  const blocks = readBlocks(css);
  const declared = new Map();
  for (const b of blocks) for (const d of b.decls) declared.set(d.name, d);

  const halves = new Map(); // base -> { LIGHT, DARK }
  for (const b of blocks.filter((x) => x.prelude === ":root" && x.parents.length === 0)) {
    for (const d of b.decls) {
      const m = /^--(.+)-(LIGHT|DARK)$/.exec(d.name);
      if (!m) continue;
      const entry = halves.get(m[1]) ?? {};
      entry[m[2]] = d;
      halves.set(m[1], entry);
      if (!parseOklch(d.value)) {
        problems.push(`${file}:${d.line}  ${d.name}: \`${d.value}\` is not a plain oklch(L C H) literal.`);
      }
    }
  }
  for (const [base, h] of halves) {
    if (!h.LIGHT) problems.push(`${file}:${h.DARK.line}  --${base}-DARK has no --${base}-LIGHT.`);
    if (!h.DARK) problems.push(`${file}:${h.LIGHT.line}  --${base}-LIGHT has no --${base}-DARK.`);
  }

  const exposed = new Set();
  const themeBlocks = blocks.filter((b) => b.prelude.startsWith("@theme"));
  for (const b of themeBlocks) {
    for (const d of b.decls) {
      if (!d.name.startsWith("--color-")) continue;
      const blend = BLEND.exec(d.value);
      if (blend) {
        const h = halves.get(blend[1]);
        if (!h?.LIGHT || !h?.DARK) {
          problems.push(`${file}:${d.line}  ${d.name} blends --${blend[1]}-LIGHT/-DARK, which is not a declared pair.`);
        }
        exposed.add(blend[1]);
        continue;
      }
      const alias = ALIAS.exec(d.value);
      if (alias && !declared.has(alias[1]) && !/-(LIGHT|DARK)$/.test(alias[1])) continue;
      problems.push(
        `${file}:${d.line}  ${d.name}: \`${d.value}\` is neither the canonical blend of a LIGHT/DARK pair\n` +
          `    nor an alias of a contract role. Write it as\n` +
          `    color-mix(in oklch, var(--X-LIGHT), var(--X-DARK) calc(var(--SCHEME-DARK) * 100%)).`,
      );
    }
  }
  for (const [base, h] of halves) {
    if (h.LIGHT && h.DARK && !exposed.has(base)) {
      problems.push(`${file}:${h.LIGHT.line}  pair --${base}-LIGHT/-DARK is not exposed by any @theme blend.`);
    }
  }

  for (const b of blocks) {
    if (b.prelude.startsWith("@theme")) continue;
    for (const d of b.decls) {
      if (/-(LIGHT|DARK)$/.test(d.name)) continue;
      if (RAW_COLOUR.test(d.value)) {
        problems.push(`${file}:${d.line}  ${d.name}: a raw colour outside a LIGHT/DARK pair. Make it a pair.`);
      }
    }
  }

  return { problems, pairs: [...halves.keys()] };
}

/** `var(--X-LIGHT|DARK)` reads outside the canonical blend, in any source text. */
export function checkHalfReads(source, file) {
  const text = blankComments(source).replace(
    /color-mix\(\s*in oklch,\s*var\(--([A-Z0-9-]+)-LIGHT\),\s*var\(--\1-DARK\)\s+calc\(\s*var\(--SCHEME-DARK\)\s*\*\s*100%\s*\)\s*\)/g,
    (m) => " ".repeat(m.length),
  );
  const problems = [];
  for (const m of text.matchAll(/var\(\s*--[A-Z0-9-]+-(?:LIGHT|DARK)\b/g)) {
    problems.push(
      `${file}:${lineAt(text, m.index)}  \`${m[0]})\` reads one half of a pair, so it ignores the theme's scheme.\n` +
        `    Use the utility (\`bg-series-1\`), or \`domainColor()\` from src/util/domain-color.ts.`,
    );
  }
  return problems;
}
