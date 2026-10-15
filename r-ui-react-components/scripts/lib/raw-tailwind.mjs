// The rules behind `verify:no-raw-tailwind`, importable so the gate's own test
// can prove each one goes red on a fixture.
//
// A component speaks tokens only. These are the ways a Tailwind default or a
// raw value sneaks in, each one a rule below:
//
//   spacing   numeric spacing/size utilities (`p-4`, `px-3`, `py-1.5`, `gap-2`,
//             `h-8`, `w-9`, `min-w-45`, `-mt-4`, `leading-6`). Tailwind v4's
//             spacing scale is a multiplier, so ANY number is a raw value.
//             Allowed: `0`, `px` (the 1px hairline), `full`, `auto`, fractions
//             (`w-1/2`), keywords (`min-h-dvh`), and token names (`p-r3`,
//             `h-control`, `h-row`).
//   text      default text sizes (`text-xs` … `text-9xl`, `text-base`).
//   palette   default palette colours (`bg-blue-500`, `text-white`, `ring-black/50`).
//   radius    bare `rounded` / `rounded-t` and default radius steps
//   shadow    bare `shadow` and default shadow steps
//   container default container widths (`max-w-md`, `w-sm`)
//   arbitrary an arbitrary value or a string carrying a raw literal: hex,
//             rgb()/hsl()/oklch(<number>…), or px/rem lengths (`p-[12px]`,
//             `bg-[#fff]`, `style={{ width: "12px" }}`). `1px` is the hairline
//             and allowed; `var(--…)` arbitrary values are fine.
//
// A named default (`text-sm`, `rounded-md`, `shadow-lg`, `max-w-md`) is allowed
// when the contract or this package declares that exact name in a `@theme`
// block (then it IS a token); the caller passes those names in `allow`.

import ts from "typescript";

import { blankComments, lineAt } from "./css.mjs";

const NUM = String.raw`\d+(?:\.\d+)?`;
const SIDES = "(?:[xytrblse])?";

const SPACING = new RegExp(
  String.raw`^(?:p${SIDES}|m${SIDES}|gap(?:-[xy])?|space-[xy]|w|h|size|min-w|min-h|max-w|max-h|inset(?:-[xy])?|top|right|bottom|left|start|end|translate(?:-[xyz])?|scroll-[mp]${SIDES}|indent|basis|leading|border-spacing(?:-[xy])?|inline|block|min-inline|max-inline|min-block|max-block)-(${NUM})$`,
);
const TEXT_SIZE = /^text-(xs|sm|base|lg|xl|[2-9]xl)$/;
const PALETTE_HUES =
  "slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOR_PREFIX =
  "bg|text|border(?:-[xytrblse])?|ring|ring-offset|outline|fill|stroke|decoration|accent|caret|divide|placeholder|shadow|inset-shadow|inset-ring|drop-shadow|from|via|to";
const PALETTE = new RegExp(
  `^(?:${COLOR_PREFIX})-(?:(?:${PALETTE_HUES})-(?:50|[1-9]00|950)|black|white)$`,
);
const RADIUS_SIDE = "(?:-(?:[tblrse]|t[lr]|b[lr]|s[se]|e[se]))?";
const BARE_RADIUS = new RegExp(`^rounded${RADIUS_SIDE}$`);
const RADIUS_STEP = new RegExp(`^rounded${RADIUS_SIDE}-(xs|sm|md|lg|xl|2xl|3xl|4xl)$`);
const BARE_SHADOW = /^shadow$/;
const SHADOW_STEP = /^shadow-(2xs|xs|sm|md|lg|xl|2xl)$/;
const CONTAINER = /^(?:max-w|min-w|w)-(3xs|2xs|xs|sm|md|lg|xl|[2-7]xl|prose)$/;

const RAW_HEX = /(?:^|[^\w&])#[0-9a-fA-F]{3,8}(?![\w-])/;
const RAW_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[\d.]/;
const RAW_LEN = /(?<![\w.-])(\d*\.?\d+)(px|rem)\b/g;

/** Every raw px/rem length in `text` other than 0 and the 1px hairline. */
function rawLengths(text) {
  const out = [];
  for (const m of text.matchAll(RAW_LEN)) {
    const n = Number(m[1]);
    if (n === 0 || (m[2] === "px" && n === 1)) continue;
    out.push(m[0]);
  }
  return out;
}

/** Strip variants (`md:hover:`), `!`, a leading `-`, keeping bracket contents intact. */
function utilityOf(token) {
  let depth = 0;
  let last = 0;
  for (let i = 0; i < token.length; i += 1) {
    const ch = token[i];
    if (ch === "[" || ch === "(") depth += 1;
    else if (ch === "]" || ch === ")") depth -= 1;
    else if (ch === ":" && depth === 0) last = i + 1;
  }
  return token.slice(last).replace(/^!|!$/g, "").replace(/^-/, "");
}

/**
 * Problems for one class-shaped token. `allow` maps a theme namespace
 * (`text`, `radius`, `shadow`, `container`, `color`) to the names declared in
 * a `@theme` block, which turn a named default into a token.
 */
export function checkToken(token, allow = {}) {
  const util = utilityOf(token);
  const has = (ns, name) => Boolean(allow[ns]?.has(name));
  const noAlpha = util.replace(/\/\d+$/, "");

  if (SPACING.test(util) && !/-0$/.test(util)) return `spacing default \`${token}\``;
  const text = TEXT_SIZE.exec(util);
  if (text && !has("text", text[1])) return `default text size \`${token}\``;
  if (PALETTE.test(noAlpha)) {
    const name = noAlpha.slice(noAlpha.indexOf("-") + 1);
    if (!has("color", name)) return `default palette colour \`${token}\``;
  }
  if (BARE_RADIUS.test(util)) return `bare \`${token}\` (use a radius token)`;
  const radius = RADIUS_STEP.exec(util);
  if (radius && !has("radius", radius[1])) return `default radius \`${token}\``;
  if (BARE_SHADOW.test(util)) return `bare \`${token}\` (use a shadow token)`;
  const shadow = SHADOW_STEP.exec(util);
  if (shadow && !has("shadow", shadow[1])) return `default shadow \`${token}\``;
  const container = CONTAINER.exec(util);
  if (container && !has("container", container[1])) return `default container width \`${token}\``;
  return null;
}

/** Problems in one string value (a class list, a style value, a constant). */
export function checkString(value, allow = {}) {
  const problems = [];
  for (const token of value.split(/\s+/)) {
    if (!token) continue;
    if (RAW_HEX.test(token)) problems.push(`raw hex colour in \`${token}\``);
    if (RAW_FN.test(token)) problems.push(`raw colour function in \`${token}\``);
    const lengths = rawLengths(token);
    if (lengths.length) problems.push(`raw length ${lengths.join(", ")} in \`${token}\``);
    const problem = checkToken(token, allow);
    if (problem) problems.push(problem);
  }
  return problems;
}

/** Scan a .ts/.tsx source: every string literal and template text, never comments. */
export function scanTs(source, fileName, allow = {}) {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      // The type `"literal"` in `ts.isLiteralTypeNode` is also a StringLiteral;
      // a type naming a raw value is still a raw value, so it is scanned too.
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      for (const problem of checkString(node.text, allow)) found.push({ line, problem });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** Scan a component stylesheet: raw literals in declaration values, and `@apply` lists. */
export function scanCss(source, allow = {}) {
  const text = blankComments(source);
  const found = [];
  for (const m of text.matchAll(/@apply\s+([^;]+);/g)) {
    const line = lineAt(text, m.index);
    for (const token of m[1].split(/\s+/)) {
      const problem = token && checkToken(token, allow);
      if (problem) found.push({ line, problem });
    }
  }
  for (const m of text.matchAll(/(?<![\w-])([a-z-]+|--[A-Za-z0-9-]+)\s*:\s*([^;{}]+)[;}]/g)) {
    const value = m[2];
    const line = lineAt(text, m.index);
    if (RAW_HEX.test(value)) found.push({ line, problem: `raw hex colour in \`${m[0].trim()}\`` });
    if (RAW_FN.test(value)) found.push({ line, problem: `raw colour function in \`${m[0].trim()}\`` });
    const lengths = rawLengths(value);
    if (lengths.length) found.push({ line, problem: `raw length ${lengths.join(", ")} in \`${m[0].trim()}\`` });
  }
  for (const m of text.matchAll(/@(?:media|container)[^{]*/g)) {
    const lengths = rawLengths(m[0]);
    if (lengths.length) {
      found.push({ line: lineAt(text, m.index), problem: `raw length ${lengths.join(", ")} in \`${m[0].trim()}\`` });
    }
  }
  return found;
}

/** Theme-namespace allowlist from `@theme` blocks in the given CSS sources. */
export function allowFromTheme(cssSources) {
  const allow = {};
  for (const css of cssSources) {
    const text = blankComments(css);
    for (const open of text.matchAll(/@theme\b[^{]*\{([^}]*)\}/g)) {
      for (const d of open[1].matchAll(/--([a-z]+)-([A-Za-z0-9-]+)\s*:/g)) {
        const [, ns, name] = d;
        if (name.includes("--")) continue; // `--text-kpi--line-height` is a modifier
        (allow[ns] ??= new Set()).add(name);
      }
    }
  }
  return allow;
}
