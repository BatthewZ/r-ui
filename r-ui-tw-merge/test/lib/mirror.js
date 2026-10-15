// Compares the utility names r-ui-css declares with the names the merge
// extension registers, namespace by namespace, in both directions.

/** Tailwind namespaces the extension mirrors under `theme`, keyed by CSS prefix (`--<ns>-*`). */
const THEME_NAMESPACES = [
  "color",
  "font",
  "font-weight",
  "text",
  "spacing",
  "container",
  "radius",
  "shadow",
  "ease",
  "animate",
];

/** Namespaces tailwind-merge has no theme key for: CSS prefix -> class prefix in `classGroups`. */
const CLASS_GROUP_NAMESPACES = {
  opacity: "opacity",
  "transition-duration": "duration",
  "z-index": "z",
};

/**
 * The class a theme name generates, for the namespaces where that is one fixed
 * prefix (for colours, the fill: `bg-`). An `@utility` with the same class name
 * EXTENDS that utility (Tailwind emits both blocks under one class; r-ui-css uses
 * it to put a face on `text-h1` and forced-colors handling on `bg-accent`), so it
 * is the theme name, not a second name to mirror.
 */
const THEME_CLASS_PREFIX = {
  color: "bg",
  text: "text",
  font: "font",
  "font-weight": "font",
  radius: "rounded",
  shadow: "shadow",
  ease: "ease",
  animate: "animate",
  opacity: "opacity",
  "transition-duration": "duration",
  "z-index": "z",
};

/** `@utility` classes: every class a `classGroups` entry names outside the namespaces above. */
export const UTILITY = "@utility";

/**
 * Tailwind namespaces the extension does not mirror. Listed so `--text-shadow-x`
 * is not misread as the `text` name `shadow-x`, and so r-ui-css starting to use
 * one fails loudly instead of being skipped.
 */
const UNMIRRORED_TAILWIND = [
  "text-shadow",
  "inset-shadow",
  "drop-shadow",
  "leading",
  "tracking",
  "blur",
  "perspective",
  "aspect",
  "breakpoint",
];

const CSS_PREFIXES = [...THEME_NAMESPACES, ...Object.keys(CLASS_GROUP_NAMESPACES), ...UNMIRRORED_TAILWIND].sort(
  (a, b) => b.length - a.length,
);

const add = (map, ns, name) => (map.get(ns) ?? map.set(ns, new Set()).get(ns)).add(name);

/** Namespace -> names from the parsed CSS, plus anything that could not be classified. */
export function cssNames({ declarations, utilities }) {
  const names = new Map();
  const problems = [];
  for (const { prop, value, file } of declarations) {
    if (value === "initial") continue; // namespace reset or removal of a Tailwind default
    if (prop.startsWith("--default-")) continue; // Tailwind's defaults for bare utilities
    if (prop.indexOf("--", 2) !== -1) continue; // sub-property, e.g. --text-h1--line-height
    if (prop.includes("*")) {
      problems.push(`${prop} in ${file}: a wildcard with a value other than \`initial\``);
      continue;
    }
    const ns = CSS_PREFIXES.find((p) => prop.startsWith(`--${p}-`));
    if (!ns) problems.push(`${prop} in ${file}: no known Tailwind namespace`);
    else if (UNMIRRORED_TAILWIND.includes(ns)) problems.push(`${prop} in ${file}: namespace \`${ns}\` has no mirror`);
    else add(names, ns, prop.slice(ns.length + 3));
  }
  const themeClasses = new Set();
  for (const [ns, prefix] of Object.entries(THEME_CLASS_PREFIX)) {
    for (const name of names.get(ns) ?? []) themeClasses.add(`${prefix}-${name}`);
  }
  for (const name of utilities) {
    if (name.endsWith("-*")) problems.push(`@utility ${name}: functional utilities have no mirror`);
    else if (!themeClasses.has(name)) add(names, UTILITY, name);
  }
  return { names, problems };
}

/** Namespace -> names registered by a tailwind-merge extension built like `tailwindMergeExtension`. */
export function mirrorNames(extension) {
  const names = new Map();
  for (const [key, list] of Object.entries(extension.theme ?? {})) {
    for (const name of list) if (typeof name === "string") add(names, key, name);
  }
  const groupPrefixToNs = Object.fromEntries(Object.entries(CLASS_GROUP_NAMESPACES).map(([ns, p]) => [p, ns]));
  for (const group of Object.values(extension.classGroups ?? {})) {
    for (const entry of group) {
      if (typeof entry === "string") {
        add(names, UTILITY, entry);
        continue;
      }
      if (!entry || typeof entry !== "object") continue;
      for (const [prefix, values] of Object.entries(entry)) {
        for (const value of values) {
          if (typeof value !== "string") continue;
          if (groupPrefixToNs[prefix]) add(names, groupPrefixToNs[prefix], value);
          else add(names, UTILITY, `${prefix}-${value}`);
        }
      }
    }
  }
  return names;
}

/**
 * Per namespace: the CSS names and the mirror names (sorted), what the mirror
 * lacks (`missing`) and what it has that the CSS does not (`stale`).
 */
export function compareMirror(css, mirror) {
  const namespaces = [...new Set([...css.keys(), ...mirror.keys()])].sort();
  const byNamespace = {};
  const missing = [];
  const stale = [];
  for (const ns of namespaces) {
    const c = [...(css.get(ns) ?? [])].sort();
    const m = [...(mirror.get(ns) ?? [])].sort();
    byNamespace[ns] = { css: c, mirror: m };
    for (const name of c) if (!m.includes(name)) missing.push(`${ns}: ${name}`);
    for (const name of m) if (!c.includes(name)) stale.push(`${ns}: ${name}`);
  }
  return { namespaces, byNamespace, missing, stale };
}
