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
//   shadow    bare `shadow` and default shadow steps (a bare `rounded` or
//             `shadow` only in a class context: elsewhere it is a word)
//   container default container widths (`max-w-md`, `w-sm`)
//   layer     a numeric stacking order (`z-10`, `z-index: 2`): in-flow stacking
//             reads the contract's scale (`z-raised`, `z-sticky`, `z-docked`,
//             `z-bypass`) so chrome from different groups orders itself; overlays
//             use the top layer and need none. `0` and `auto` are allowed.
//   line      a line drawn at a fixed `1px` instead of the theme's
//             `var(--BORDER-WIDTH)` (which the bare `border` utility reads): in a
//             stylesheet or a style object, a border, outline or box-shadow
//             (`border: 1px solid …`, `outline-width: 1px`,
//             `box-shadow: inset 0 0 0 1px …`, `{ boxShadow: "0 0 0 1px …" }`);
//             in a class, a numbered width or offset (`border-2`, `ring-2`,
//             `outline-offset-2`) or a `1px` inside a line utility's arbitrary
//             value (`shadow-[inset_0_0_0_1px_…]`, `outline-[1px]`).
//   arbitrary an arbitrary value or a string carrying a raw literal: hex,
//             rgb()/hsl()/oklch(<number>…), or a length in an absolute,
//             font-relative, viewport or container unit (`p-[12px]`,
//             `w-[3rem]`, `mt-[0.25em]`, `max-w-[calc(100vw-…)]`, `bg-[#fff]`,
//             `style={{ width: "12px" }}`). Allowed lengths are the few that
//             name a unit itself rather than a size: `1px` (the hairline, where
//             no line is drawn with it), `1em`, `1lh` and `1ch` (one of the
//             font's own units, either sign, as in `size-[1em]`, `calc(n * 1ch)`
//             or a one-unit hang `calc(-1em - …)`),
//             `100dvh` (the viewport, what the `dvh` keyword utilities are) and
//             `100cqi` (the container's whole inline size: a part sized as a
//             ratio of its box writes `calc(100cqi * 0.38)`, as `w-1/2` does).
//             `var(--…)` arbitrary values are fine.
//
// A named default (`text-sm`, `rounded-md`, `shadow-lg`, `max-w-md`) is allowed
// when the contract or this package declares that exact name in a `@theme`
// block (then it IS a token); the caller passes those names in `allow`.

import ts from "typescript";

import { classTokens, scriptKind } from "./class-tokens.mjs";
import { blankComments, lineAt, themeBlocks } from "./css.mjs";

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
const Z_NUMBER = /^z-(?:(\d+)|\[(-?\d+)\])$/;
const Z_CSS = /^\s*-?(\d+)\s*$/;
const LINE_UTILITY = "border(?:-[xytrblse])?|divide-[xy]|outline|outline-offset|ring|ring-offset|inset-ring";
const LINE_WIDTH = new RegExp(`^(?:${LINE_UTILITY})-(\\d+)$`);
const LINE_ARBITRARY = new RegExp(`^(?:${LINE_UTILITY}|shadow|inset-shadow)-\\[(.*)\\]$`);
// Kebab-case; a style object's camelCase key is converted before the test.
const LINE_PROP =
  /^(?:border(?:-(?:top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end))?(?:-width)?|outline(?:-width|-offset)?|box-shadow)$/;
const LINE_1PX = /(?<![\w.-])1px\b/;
const LINE_HINT = "(use var(--BORDER-WIDTH))";
const LAYER_HINT = "(use z-raised / z-sticky / z-docked / z-bypass)";

const RAW_HEX = /(?:^|[^\w&])#[0-9a-fA-F]{3,8}(?![\w-])/;
const RAW_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[\d.]/;
const UNITS = [
  "px", "rem", "em", "ex", "ch", "lh", "rlh",
  "vw", "vh", "vi", "vb", "vmin", "vmax", "dvw", "dvh", "svw", "svh", "lvw", "lvh",
  "cqw", "cqh", "cqi", "cqb", "cqmin", "cqmax",
];
// A leading `-` is a sign (`-12px`, `mt-[-12px]`) unless it joins an identifier (`m-12px`).
const RAW_LEN = new RegExp(String.raw`(?<![\w.])(?<![A-Za-z0-9]-)-?(\d*\.?\d+)(${UNITS.join("|")})\b`, "g");
// Lengths that name a unit rather than a size; see `arbitrary` above.
const UNIT_LENGTHS = new Set(["1px", "-1px", "1em", "-1em", "1lh", "-1lh", "1ch", "-1ch", "100dvh", "100cqi"]);

/** Every raw length in `text` other than 0 and the allowed unit lengths. */
function rawLengths(text) {
  const out = [];
  for (const m of text.matchAll(RAW_LEN)) {
    if (Number(m[1]) === 0 || UNIT_LENGTHS.has(m[0])) continue;
    out.push(m[0]);
  }
  return out;
}

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** A line property (`border-top`, `outline`, `boxShadow`) given a fixed 1px weight. */
function fixedLine(property, value) {
  return LINE_PROP.test(kebab(property)) && LINE_1PX.test(value);
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
  const width = LINE_WIDTH.exec(util);
  if (width && Number(width[1]) !== 0) return `fixed line width \`${token}\` (a bare \`border\` reads --BORDER-WIDTH)`;
  const arbitrary = LINE_ARBITRARY.exec(util);
  if (arbitrary && LINE_1PX.test(arbitrary[1].replace(/_/g, " "))) return `fixed line width \`${token}\` ${LINE_HINT}`;
  const z = Z_NUMBER.exec(util);
  if (z && Number(z[1] ?? z[2]) !== 0) return `numeric stacking \`${token}\` ${LAYER_HINT}`;
  return null;
}

/** A token with no class syntax: outside a class context it is a word ("shadow" in a word list). */
const WORD = /^[a-z]+$/;

/**
 * Problems in one string value (a class list, a style value, a constant). Raw
 * literals count everywhere; a plain word counts as a class only where
 * `inClassContext` says the string is one.
 */
export function checkString(value, allow = {}, inClassContext = true) {
  const problems = [];
  for (const token of value.split(/\s+/)) {
    if (!token) continue;
    if (RAW_HEX.test(token)) problems.push(`raw hex colour in \`${token}\``);
    if (RAW_FN.test(token)) problems.push(`raw colour function in \`${token}\``);
    // `_` is a space inside an arbitrary value (`shadow-[0_2px_4px_…]`).
    const lengths = rawLengths(token.replace(/_/g, " "));
    if (lengths.length) problems.push(`raw length ${lengths.join(", ")} in \`${token}\``);
    const problem = (inClassContext || !WORD.test(token)) && checkToken(token, allow);
    if (problem) problems.push(problem);
  }
  return problems;
}

/** The key a string is the value of, in an object literal (`{ boxShadow: "…" }`), or null. */
function styleKey(node) {
  const parent = node.parent;
  if (!parent || !ts.isPropertyAssignment(parent) || parent.initializer !== node) return null;
  return ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name) ? parent.name.text : null;
}

/**
 * Scan a .ts/.tsx source: every string literal and template text, never comments.
 * Every string is read as a possible class list (a class string may be exported
 * and used elsewhere), except that a bare word is judged as a class only in a
 * class context (`scripts/lib/class-tokens.mjs`): data strings such as a word
 * list or a label hold ordinary words that share a utility's name.
 */
export function scanTs(source, fileName, allow = {}) {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind(fileName));
  const classPositions = new Set(classTokens(source, fileName).tokens.map((t) => t.pos));
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
      const start = node.getStart(sf);
      const line = sf.getLineAndCharacterOfPosition(start).line + 1;
      for (const problem of checkString(node.text, allow, classPositions.has(start))) found.push({ line, problem });
      const property = styleKey(node);
      if (property && fixedLine(property, node.text)) {
        found.push({ line, problem: `fixed line weight in \`${property}: "${node.text}"\` ${LINE_HINT}` });
      }
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
    // One line per finding, however many lines the declaration spans.
    const decl = m[0].trim().replace(/\s+/g, " ");
    if (RAW_HEX.test(value)) found.push({ line, problem: `raw hex colour in \`${decl}\`` });
    if (RAW_FN.test(value)) found.push({ line, problem: `raw colour function in \`${decl}\`` });
    const lengths = rawLengths(value);
    if (lengths.length) found.push({ line, problem: `raw length ${lengths.join(", ")} in \`${decl}\`` });
    const z = m[1] === "z-index" && Z_CSS.exec(value);
    if (z && Number(z[1]) !== 0) found.push({ line, problem: `numeric stacking in \`${decl}\` ${LAYER_HINT}` });
    if (fixedLine(m[1], value)) found.push({ line, problem: `fixed line weight in \`${decl}\` ${LINE_HINT}` });
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
    for (const { body } of themeBlocks(blankComments(css))) {
      if (body === null) continue;
      for (const d of body.matchAll(/--([a-z]+)-([A-Za-z0-9-]+)\s*:/g)) {
        const [, ns, name] = d;
        if (name.includes("--")) continue; // `--text-kpi--line-height` is a modifier
        (allow[ns] ??= new Set()).add(name);
      }
    }
  }
  return allow;
}
