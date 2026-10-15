#!/usr/bin/env node
// Compile check: src/index.css (and every example theme on top of it) compiles with
// the Tailwind CLI, every `@theme` name in the package yields its utility, the
// package's own utilities and region classes exist, and the Tailwind defaults this
// contract replaces generate nothing.
// Usage: node scripts/check-compile.mjs [--pkg <dir>]
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "./lib/css.mjs";
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
];

/** Utilities a reader would reach for that are not 1:1 with a theme name. */
const EXTRA_UTILITIES = ["h-control", "h-row", "size-icon", "min-h-hit", "w-column-md", "min-w-column-sm", "gap-r3", "px-gutter", "py-section-1", "text-fg-primary", "border-border", "outline-focus"];
const PACKAGE_UTILITIES = ["focus-ring", "focus-ring-inset", "hit-area"];
const REGION_SELECTORS = [".prose", "[data-prose]", ".not-prose", "[data-density=\"compact\"]", ".fade-in", ".stagger-item", ".scroll-reveal-hidden"];
/** Tailwind defaults this contract removes: each must generate NOTHING. */
const REMOVED_DEFAULTS = ["bg-blue-500", "text-white", "text-sm", "rounded", "shadow-xl", "font-bold", "font-sans", "leading-tight", "tracking-tight", "ease-in-out"];

/** Every `--x` declared inside an `@theme` block anywhere under src/ (wildcard resets excluded). */
export function themeNames(srcDir) {
  const names = new Set();
  const visit = (nodes) => {
    for (const n of nodes) {
      if (n.type === "at" && n.name === "theme") {
        for (const d of n.decls) if (!d.prop.includes("*") && !d.prop.startsWith("--default-")) names.add(d.prop);
      }
      if (n.children) visit(n.children);
    }
  };
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".css")) visit(parse(readFileSync(p, "utf8")));
    }
  };
  walk(srcDir);
  return [...names].sort();
}

export function utilityFor(themeName) {
  if (themeName.includes("--", 2)) return null; // sub-property, e.g. --text-h1--line-height
  for (const [prefix, make] of NAMESPACES) {
    if (themeName.startsWith(prefix)) return make(themeName.slice(prefix.length));
  }
  return null;
}

const escapeClass = (c) => c.replace(/[:[\]/.]/g, (m) => `\\${m}`);

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
  const expected = [
    ...themeNames(join(root, "src"))
      .map(utilityFor)
      .filter(Boolean),
    ...EXTRA_UTILITIES,
    ...PACKAGE_UTILITIES,
  ];
  const work = mkdtempSync(join(tmpdir(), "r-ui-css-compile-"));
  try {
    const source = `@source inline(${JSON.stringify([...expected, ...REMOVED_DEFAULTS].join(" "))});`;
    const base = compile(cli, `@import ${JSON.stringify(entry)};\n${source}\n`, work);
    if (!base.ok) return { errors: [`src/index.css failed to compile:\n${base.log}`], expected };
    for (const u of expected) {
      if (!base.css.includes(`.${escapeClass(u)} {`)) errors.push(`missing utility .${u}`);
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
  let pkg = new URL("..", import.meta.url).pathname;
  for (let i = 0; i < argv.length; i++) if (argv[i] === "--pkg") pkg = argv[++i];
  const { errors, expected } = checkCompile(pkg);
  if (errors.length) {
    for (const e of errors) console.log(`FAIL ${e}`);
    console.error(`compile: ${errors.length} problem(s)`);
    process.exit(1);
  }
  console.log(`ok   compiles; ${expected.length} utilities present; ${REMOVED_DEFAULTS.length} replaced Tailwind defaults absent`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
