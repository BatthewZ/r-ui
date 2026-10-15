#!/usr/bin/env node
// Compile check: src/index.css (and every example theme on top of it) compiles with
// the Tailwind CLI, every `@theme` name in the package yields its utility, every
// `@utility` and region class exists, the role-bearing utilities read their role
// token (a heading size its face, a bare border the line weight), and the Tailwind
// defaults this contract replaces generate nothing, and the print rules (the
// `data-print` conventions, repeated table heads, prose link URLs) and the prose
// link levers reach the output.
// Usage: node scripts/check-compile.mjs [--pkg <dir>]
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isMain, parseArgs } from "./lib/cli.mjs";
import { allNodes, listFiles, parse } from "./lib/css.mjs";
import { pkgPaths, themeFiles } from "./lib/tokens.mjs";

/** Representative utility per Tailwind theme namespace. */
const NAMESPACES = [
  ["--color-", (n) => `bg-${n}`],
  ["--spacing-", (n) => `p-${n}`],
  ["--text-", (n) => `text-${n}`],
  ["--radius-", (n) => `rounded-${n}`],
  ["--shadow-", (n) => `shadow-${n}`],
  ["--font-weight-", (n) => `font-${n}`],
  ["--font-", (n) => `font-${n}`],
  ["--transition-duration-", (n) => `duration-${n}`],
  ["--ease-", (n) => `ease-${n}`],
  ["--animate-", (n) => `animate-${n}`],
  ["--container-", (n) => `max-w-${n}`],
  ["--opacity-", (n) => `opacity-${n}`],
  ["--z-index-", (n) => `z-${n}`],
];

/** Utilities a reader would reach for that are not 1:1 with a theme name. */
const EXTRA_UTILITIES = ["h-control", "h-row", "size-icon", "min-h-hit", "w-column-md", "min-w-column-sm", "gap-r3", "px-gutter", "py-section-1", "text-fg-primary", "border-border", "outline-focus"];
const REGION_SELECTORS = [".prose", "[data-prose]", ".not-prose", "[data-density=\"compact\"]", ".fade-in", ".stagger-item", ".scroll-reveal-hidden"];
/**
 * Utilities whose compiled rules must read a role token. Tailwind's `--text-*`
 * sub-keys cannot carry a family, and its bare `border` defaults to 1px, so a
 * mapping lost here fails silently in the browser rather than at compile time.
 */
const ROLE_READS = [
  ...[1, 2, 3, 4, 5, 6].map((n) => [`text-h${n}`, "font-family", "--FONT-HEADING"]),
  ...[1, 2, 3, 4].map((n) => [`text-display-${n}`, "font-family", "--FONT-DISPLAY"]),
  ["border", "border-width", "--BORDER-WIDTH"],
  ["border-b", "border-bottom-width", "--BORDER-WIDTH"],
  ["border-x", "border-inline-width", "--BORDER-WIDTH"],
  ["divide-y", "border-bottom-width", "--BORDER-WIDTH"],
];

/**
 * Fills that carry meaning (each one's `on-*` pair in the contrast contract): under
 * forced colors each must opt its subtree out, or the browser's text backplate
 * hides the fill's own text. See tokens/forced-colors.css.
 */
const FORCED_FILLS = [
  "bg-primary", "bg-primary-hover", "bg-primary-active", "bg-accent", "bg-accent-hover", "bg-selection",
  "bg-status-error", "bg-status-success", "bg-status-warning", "bg-status-info", "bg-fg-primary",
];

/**
 * Print rules that must survive compilation, inside `@media print` (or, for `only`,
 * `@media not print`): [selector, declaration the rule must hold].
 */
const PRINT_RULES = [
  ['[data-print~="hide"]', /display:\s*none\s*!important/],
  ['[data-print~="break-before"]', /break-before:\s*page\s*!important/],
  ['[data-print~="avoid-break"]', /break-inside:\s*avoid\s*!important/],
  ['[data-print~="exact"]', /(^|[;\s])print-color-adjust:\s*exact\s*!important/],
  ['[data-print~="flow"]', /overflow:\s*visible\s*!important/],
  ["thead", /display:\s*table-header-group/],
  ["*, ::before, ::after", /transition:\s*none\s*!important/],
  ['a[href^="http"]:not([class])::after', /content:[^;]*attr\(href\)/],
];
const SCREEN_RULES = [['[data-print~="only"]', /display:\s*none\s*!important/]];
/** Prose rules that must read their brand lever: [selector, declaration]. */
const PROSE_RULES = [
  ["a:not([class])", /text-decoration-line:\s*var\(--LINK-DECORATION\)/],
  ["a:not([class])", /text-underline-offset:\s*var\(--LINK-UNDERLINE-OFFSET\)/],
];

/** The text inside every `@media <query> {…}` block whose query is exactly `query`. */
export function mediaBlocks(css, query) {
  const out = [];
  const needle = `@media ${query} {`;
  for (let at = css.indexOf(needle); at !== -1; at = css.indexOf(needle, at + 1)) {
    let depth = 0;
    for (let i = at + needle.length - 1; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) {
        out.push(css.slice(at + needle.length, i));
        break;
      }
    }
  }
  return out.join("\n");
}

/** Is there a rule for `selector` in `css` whose body matches `decl`? */
const hasRule = (css, selector, decl) => {
  for (let at = css.indexOf(`${selector} {`); at !== -1; at = css.indexOf(`${selector} {`, at + 1)) {
    const open = css.indexOf("{", at);
    if (decl.test(css.slice(open + 1, css.indexOf("}", open)))) return true;
  }
  return false;
};

/** Does a rule body declare `prop` with a value that reads `token` (exactly that name)? */
const reads = (body, prop, token) => new RegExp(`(^|[;\\s])${prop}:[^;]*var\\(${token}[,)]`).test(body);
/** Tailwind defaults this contract removes: each must generate NOTHING. */
const REMOVED_DEFAULTS = ["bg-blue-500", "text-white", "text-sm", "rounded", "shadow-xl", "font-bold", "font-sans", "leading-tight", "tracking-tight", "ease-in-out"];

/**
 * Container sizes that double as container variants: every `--container-*` in a
 * non-inline `@theme` with a literal length, and the `:root` alias that points it
 * back at its lever (`--container-column-md: var(--COLUMN-MD)`), with that lever's
 * `:root` default. A container query cannot read a custom property, so the
 * variant is only honest while the literal equals the lever's default.
 */
export function containerSizes(srcDir) {
  const literal = new Map();
  const rootDecls = new Map();
  for (const n of sourceNodes(srcDir)) {
    if (n.type === "at" && n.name === "theme" && !/\binline\b/.test(n.prelude)) {
      for (const d of n.decls) if (d.prop.startsWith("--container-")) literal.set(d.prop, d.value);
    }
    if (n.type === "rule" && n.selector === ":root") for (const d of n.decls) rootDecls.set(d.prop, d.value);
  }
  return [...literal].map(([name, value]) => {
    const lever = /^var\((--[\w-]+)\)$/.exec(rootDecls.get(name) ?? "")?.[1] ?? null;
    return { name, value, lever, leverDefault: lever ? (rootDecls.get(lever) ?? null) : null };
  });
}

/** Every node of every stylesheet under `srcDir`, depth first. */
function* sourceNodes(srcDir) {
  for (const file of listFiles(srcDir)) {
    if (file.endsWith(".css")) yield* allNodes(parse(readFileSync(file, "utf8")));
  }
}

/**
 * `@theme` names (wildcard resets and `--default-*` excluded) and `@utility`
 * class names declared anywhere under src/.
 */
export function sourceNames(srcDir) {
  const names = new Set();
  const utilities = new Set();
  for (const n of sourceNodes(srcDir)) {
    if (n.type === "at" && n.name === "theme") {
      for (const d of n.decls) if (!d.prop.includes("*") && !d.prop.startsWith("--default-")) names.add(d.prop);
    }
    if (n.type === "at" && n.name === "utility") utilities.add(n.prelude);
  }
  return { theme: [...names].sort(), utilities: [...utilities].sort() };
}

/** Bodies of every rule whose selector names `.cls` exactly (not `.cls-x`, not `.cls\/7`). */
export function ruleBodies(css, cls) {
  const bodies = [];
  const needle = `.${escapeClass(cls)}`;
  for (let at = css.indexOf(needle); at !== -1; at = css.indexOf(needle, at + 1)) {
    if (!/[\s{>:),[]/.test(css[at + needle.length] ?? "")) continue;
    const open = css.indexOf("{", at);
    const close = css.indexOf("}", open);
    if (open !== -1 && close !== -1) bodies.push(css.slice(open + 1, close));
  }
  return bodies;
}

/** Bodies of every rule whose selector is `.cls *` (or `.cls[…] *`): what the fill sets on its descendants. */
function descendantBodies(css, cls) {
  const bodies = [];
  const re = new RegExp(`\\.${escapeClass(cls).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")}(\\[[^\\]]*\\])? \\* \\{([^}]*)\\}`, "g");
  for (const m of css.matchAll(re)) bodies.push(m[2]);
  return bodies;
}

export function utilityFor(themeName) {
  if (themeName.includes("--", 2)) return null; // sub-property, e.g. --text-h1--line-height
  for (const [prefix, make] of NAMESPACES) {
    if (themeName.startsWith(prefix)) return make(themeName.slice(prefix.length));
  }
  return null;
}

const escapeClass = (c) => c.replace(/[@:[\]/.]/g, (m) => `\\${m}`);

function findTailwind(root) {
  for (const p of [join(root, "node_modules/.bin/tailwindcss"), join(root, "../node_modules/.bin/tailwindcss")]) {
    if (existsSync(p)) return p;
  }
  throw new Error("Tailwind CLI not found: run bun install");
}

function compile(cli, input, workDir) {
  const inFile = join(workDir, "in.css");
  const outFile = join(workDir, "out.css");
  writeFileSync(inFile, input);
  let stderr = "";
  try {
    stderr = execFileSync(cli, ["-i", inFile, "-o", outFile], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    return { ok: false, log: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
  return { ok: true, css: readFileSync(outFile, "utf8"), log: stderr };
}

export function checkCompile(pkgDir) {
  const { root, entry } = pkgPaths(pkgDir);
  const cli = findTailwind(root);
  const errors = [];
  const declared = sourceNames(join(root, "src"));
  const expected = [...new Set([...declared.theme.map(utilityFor).filter(Boolean), ...EXTRA_UTILITIES, ...declared.utilities])];
  const containers = containerSizes(join(root, "src"));
  for (const c of containers) {
    if (!c.lever) errors.push(`${c.name}: no :root alias back to its lever (\`${c.name}: var(--LEVER)\`), so a theme cannot move its boxes`);
    else if (c.leverDefault !== c.value) errors.push(`${c.name}: the container variant compiles to ${c.value}, but ${c.lever} defaults to ${c.leverDefault}`);
  }
  const variantClasses = containers.flatMap((c) => {
    const n = c.name.slice("--container-".length);
    return [`@${n}:flex`, `@max-${n}:flex`];
  });
  const roleClasses = [...ROLE_READS.map(([cls]) => cls), ...FORCED_FILLS, "aria-selected:bg-selection", ...variantClasses];
  // A name in no namespace generates nothing, whatever it is called.
  for (const name of declared.theme) {
    if (!name.includes("--", 2) && !utilityFor(name)) errors.push(`@theme name ${name} is in no namespace this check knows: it generates nothing`);
  }
  const work = mkdtempSync(join(tmpdir(), "r-ui-css-compile-"));
  try {
    const source = `@source inline(${JSON.stringify([...expected, ...roleClasses, ...REMOVED_DEFAULTS].join(" "))});`;
    const base = compile(cli, `@import ${JSON.stringify(entry)};\n${source}\n`, work);
    if (!base.ok) return { errors: [`src/index.css failed to compile:\n${base.log}`], expected };
    for (const u of expected) {
      if (!base.css.includes(`.${escapeClass(u)} {`)) errors.push(`missing utility .${u}`);
    }
    for (const [cls, prop, token] of ROLE_READS) {
      if (!ruleBodies(base.css, cls).some((body) => reads(body, prop, token))) errors.push(`.${cls} does not read ${token} in ${prop}`);
    }
    for (const cls of [...FORCED_FILLS, "aria-selected:bg-selection"]) {
      const bodies = ruleBodies(base.css, cls);
      if (!bodies.some((body) => /forced-color-adjust:\s*none/.test(body))) errors.push(`.${cls} does not opt out under forced colors`);
      // Inside the kept fill a status label must take the fill's ink, and so must a
      // descendant's focus ring; the default CanvasText / Highlight can match the fill.
      else if (!bodies.some((body) => /--C-TEXT-ERROR:/.test(body))) errors.push(`.${cls} does not remap the status text roles inside its fill`);
      if (!base.css.includes(`.${escapeClass(cls)}`) || !descendantBodies(base.css, cls).some((body) => /--C-FOCUS:/.test(body))) {
        errors.push(`.${cls} does not remap --C-FOCUS for its descendants`);
      }
      // On paper a dropped fill would leave its light on-* ink on white.
      if (!bodies.some((body) => /(^|[;\s])print-color-adjust:\s*exact/.test(body))) errors.push(`.${cls} does not keep its fill in print (print-color-adjust: exact)`);
    }
    for (const c of containers) {
      const n = c.name.slice("--container-".length);
      for (const [cls, cond] of [[`@${n}:flex`, `width >= ${c.value}`], [`@max-${n}:flex`, `width < ${c.value}`]]) {
        const at = base.css.indexOf(`.${escapeClass(cls)} {`);
        const query = at === -1 ? "" : base.css.slice(base.css.lastIndexOf("@container", at), at);
        if (!query.includes(cond)) errors.push(`variant ${cls} does not compile to @container (${cond})`);
      }
    }
    const print = mediaBlocks(base.css, "print");
    for (const [sel, decl] of PRINT_RULES) {
      if (!hasRule(print, sel, decl)) errors.push(`print: no \`${sel}\` rule matching ${decl} inside @media print`);
    }
    const screen = mediaBlocks(base.css, "not print");
    for (const [sel, decl] of SCREEN_RULES) {
      if (!hasRule(screen, sel, decl)) errors.push(`print: no \`${sel}\` rule matching ${decl} inside @media not print`);
    }
    for (const [sel, decl] of PROSE_RULES) {
      if (!hasRule(base.css, sel, decl)) errors.push(`prose: no \`${sel}\` rule matching ${decl}`);
    }
    for (const sel of REGION_SELECTORS) {
      if (!base.css.includes(sel)) errors.push(`missing selector ${sel}`);
    }
    for (const u of REMOVED_DEFAULTS) {
      if (base.css.includes(`.${escapeClass(u)} {`)) errors.push(`Tailwind default .${u} still generates`);
    }
    for (const theme of themeFiles(pkgDir)) {
      const r = compile(cli, `@import ${JSON.stringify(entry)};\n@import ${JSON.stringify(theme)};\n`, work);
      if (!r.ok) errors.push(`${theme} failed to compile:\n${r.log}`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return { errors, expected };
}

function main(argv) {
  const { pkg } = parseArgs(argv);
  const { errors, expected } = checkCompile(pkg);
  if (errors.length) {
    for (const e of errors) console.log(`FAIL ${e}`);
    console.error(`compile: ${errors.length} problem(s)`);
    process.exit(1);
  }
  console.log(`ok   compiles; ${expected.length} utilities present; ${REMOVED_DEFAULTS.length} replaced Tailwind defaults absent`);
}

if (isMain(import.meta.url)) main(process.argv.slice(2));
