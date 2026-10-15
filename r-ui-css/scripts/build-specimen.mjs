#!/usr/bin/env node
// Builds specimen/dist/specimen.css: the package entry, every example theme (found on
// disk, never listed by name), and the utilities specimen/index.html uses.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { PKG_DIR } from "./lib/cli.mjs";
import { pkgPaths, themeFiles } from "./lib/tokens.mjs";

const { root } = pkgPaths(PKG_DIR);
const dist = join(root, "specimen/dist");
mkdirSync(dist, { recursive: true });

const themes = themeFiles(root).map((f) => `@import "../../src/examples/themes/${basename(f)}";`);
writeFileSync(
  join(dist, "input.css"),
  ['@import "../../src/index.css";', ...themes, '@source "../index.html";',
    // Classes the page assembles in script, which the scanner cannot see.
    '@source inline("{bg-status-,text-status-,text-fg-on-,text-fg-}{error,success,warning,info}");',
    '@source inline("bg-status-{error,success,warning,info}-bg w-r{1,2,3,4,5,6} rounded-{sm,md,lg,xl,full} shadow-{sm,md,lg} animate-{fade-up,fade-in,scale-in,fade-start,morph-expand}");',
    "",
  ].join("\n"),
);

const cli = [join(root, "node_modules/.bin/tailwindcss"), join(root, "../node_modules/.bin/tailwindcss")].find(existsSync);
execFileSync(cli, ["-i", join(dist, "input.css"), "-o", join(dist, "specimen.css")], { stdio: "inherit" });
console.log(`specimen: ${join(dist, "specimen.css")} (${themes.length} example theme(s))`);
