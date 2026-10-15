// Token resolution for the checks: the default theme is every top-level `:root`
// declaration reachable from the entry; a theme is its `:root[data-theme="x"]` block
// layered on top. Media-query blocks (reduced motion, coarse pointer, more contrast)
// are deliberately ignored: they are axes, not themes.
import { readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { declsFor, loadSheet, parse, splitSelectors } from "./css.mjs";

export const THEME_SELECTOR = /^:root\[data-theme="([a-z0-9-]+)"\]$/;

export function pkgPaths(pkgDir) {
  const root = resolve(pkgDir);
  return {
    root,
    entry: join(root, "src/index.css"),
    themesDir: join(root, "src/examples/themes"),
    template: join(root, "src/_theme-template.css"),
  };
}

export function loadDefaults(pkgDir) {
  return declsFor(loadSheet(pkgPaths(pkgDir).entry), ":root");
}

/** Every theme file: examples, plus any extra paths given (fixtures, a consumer's own). */
export function themeFiles(pkgDir, extra = []) {
  const { themesDir } = pkgPaths(pkgDir);
  let files = [];
  try {
    files = readdirSync(themesDir)
      .filter((f) => f.endsWith(".css"))
      .sort()
      .map((f) => join(themesDir, f));
  } catch {
    /* no examples directory */
  }
  return [...files, ...extra.map((f) => resolve(f))];
}

/** Parse one theme file: its name(s), declarations and every top-level node. */
export function readTheme(file) {
  const nodes = parse(readFileSync(file, "utf8"));
  const decls = new Map();
  const names = new Set();
  for (const n of nodes) {
    if (n.type !== "rule") continue;
    for (const sel of splitSelectors(n.selector)) {
      const m = THEME_SELECTOR.exec(sel);
      if (m) names.add(m[1]);
    }
    if (splitSelectors(n.selector).every((s) => THEME_SELECTOR.test(s))) {
      for (const d of n.decls) decls.set(d.prop, d.value);
    }
  }
  return { file, stem: basename(file, ".css"), names: [...names], decls, nodes };
}

/** All themes to measure: the default (:root) first, then each theme file over it. */
export function allThemes(pkgDir, extra = []) {
  const defaults = loadDefaults(pkgDir);
  const out = [{ name: "default (:root)", tokens: defaults }];
  for (const file of themeFiles(pkgDir, extra)) {
    const t = readTheme(file);
    out.push({ name: t.names[0] ?? t.stem, tokens: new Map([...defaults, ...t.decls]) });
  }
  return out;
}
