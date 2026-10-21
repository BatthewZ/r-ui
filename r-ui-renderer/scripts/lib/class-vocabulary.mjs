// The class vocabulary: every class a document may write. A document arrives
// long after the host's stylesheet was built, so a class that stylesheet does
// not already hold styles nothing; the renderer's stylesheet therefore lists
// the whole vocabulary with `@source inline(...)`, and the validator warns on
// anything else.
//
// Two halves: the token utilities, derived from the CSS package's own `@theme`
// names (so a token added there forces a decision here), and a short curated
// set of layout utilities.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Utilities per `@theme` spacing name. A name no rule claims throws. */
const SPACING_RULES = [
  {
    keys: /^r\d$/,
    utilities: ["p", "px", "py", "pt", "pb", "ps", "pe", "m", "mx", "my", "mt", "mb", "ms", "me", "gap", "gap-x", "gap-y", "space-x", "space-y"],
  },
  { keys: /^section-\d$/, utilities: ["py", "pt", "pb", "my", "mt", "mb", "gap", "gap-y"] },
  { keys: /^gutter$/, utilities: ["px", "ps", "pe"] },
  { keys: /^control-pad$/, utilities: ["px"] },
  { keys: /^(control|row)$/, utilities: ["h", "min-h"] },
  { keys: /^icon$/, utilities: ["size"] },
  { keys: /^hit$/, utilities: ["min-h", "min-w"] },
];

/** Utilities per `@theme` colour name, by role: inks are text, surfaces and fills are backgrounds, lines are borders. */
const COLOR_RULES = [
  { keys: /^fg-/, utilities: ["text"] },
  { keys: /^(canvas|surface-\d|scrim|selection|status-[a-z]+-bg)$/, utilities: ["bg"] },
  { keys: /^(primary|primary-hover|primary-active|accent-hover)$/, utilities: ["bg"] },
  { keys: /^(accent|status-[a-z]+)$/, utilities: ["bg", "border"] },
  { keys: /^border(-strong)?$/, utilities: ["border", "divide"] },
  // The focus ring is the library's, drawn on focus; a document never paints it.
  { keys: /^focus$/, utilities: [] },
];

/** Utilities per `@theme` container name. */
const CONTAINER_RULES = [
  { keys: /^(measure|page)$/, utilities: ["max-w"] },
  { keys: /^column-(sm|md|lg)$/, utilities: ["w", "min-w", "max-w"] },
];

/** How each `@theme` namespace becomes utilities; `null` marks one that styles no document (motion, layering). */
const NAMESPACES = {
  color: (key) => ruled(COLOR_RULES, "color", key),
  text: (key) => [`text-${key}`],
  radius: (key) => [`rounded-${key}`],
  shadow: (key) => [`shadow-${key}`],
  font: (key) => [`font-${key}`],
  "font-weight": (key) => [`font-${key}`],
  spacing: (key) => ruled(SPACING_RULES, "spacing", key),
  container: (key) => ruled(CONTAINER_RULES, "container", key),
  "z-index": null,
  "transition-duration": null,
  ease: null,
  opacity: null,
  animate: null,
  default: null,
};

function ruled(rules, namespace, key) {
  const rule = rules.find((r) => r.keys.test(key));
  if (!rule) throw new Error(`@theme --${namespace}-${key}: no vocabulary rule claims it; decide its utilities in scripts/lib/class-vocabulary.mjs`);
  return rule.utilities.map((u) => `${u}-${key}`);
}

/** Borders and the "none" ends of the radius and shadow scales: token-driven, not keyed by a name. */
const STATIC_TOKEN_UTILITIES = [
  "border",
  "border-t",
  "border-b",
  "border-s",
  "border-e",
  "border-x",
  "border-y",
  "border-0",
  "divide-x",
  "divide-y",
  "rounded-none",
  "shadow-none",
];

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * The container sizes a Grid's `columns` map steps at, measured on the Grid's
 * own width. A cell spans by the same steps (`@3xl:col-span-2` in a grid of
 * `{ "base": 1, "@3xl": 3 }`), up to the Grid's six columns, so a span never
 * forces implicit columns once the grid narrows.
 */
const GRID_CONTAINER_SIZES = ["@sm", "@md", "@lg", "@xl", "@2xl", "@3xl", "@4xl", "@5xl"];

/** Layout: arrangement, never size or colour. */
export const LAYOUT_UTILITIES = [
  ...["block", "inline-block", "inline", "flex", "inline-flex", "grid", "hidden", "sr-only"],
  ...["flex-row", "flex-col", "flex-wrap", "flex-nowrap", "flex-1", "flex-auto", "flex-none", "grow", "shrink-0"],
  ...range(1, 12).map((n) => `grid-cols-${n}`),
  ...range(1, 12).map((n) => `col-span-${n}`),
  "col-span-full",
  ...GRID_CONTAINER_SIZES.flatMap((size) => range(2, 6).map((n) => `${size}:col-span-${n}`)),
  ...["start", "center", "end", "baseline", "stretch"].map((v) => `items-${v}`),
  ...["start", "center", "end", "between"].map((v) => `justify-${v}`),
  ...["start", "center", "end", "stretch"].map((v) => `self-${v}`),
  "place-items-center",
  ...["w-full", "h-full", "size-full", "min-w-0", "min-h-0", "max-w-full"],
  ...["overflow-hidden", "overflow-auto", "overflow-x-auto", "overflow-y-auto"],
  ...["text-start", "text-center", "text-end", "truncate", "whitespace-nowrap", "break-words"],
  ...["tabular-nums", "italic", "underline", "no-underline"],
  ...["relative", "mx-auto", "ms-auto", "me-auto", "p-0", "m-0", "gap-0"],
  ...["aspect-square", "aspect-video", "object-cover", "object-contain"],
];

/** Tailwind defaults the CSS package replaces: never in the vocabulary, whatever they compile to. */
export const REPLACED_DEFAULTS = ["p-4", "m-2", "gap-4", "text-sm", "text-lg", "bg-blue-500", "text-gray-700", "rounded", "shadow", "font-bold", "leading-tight", "w-[37%]"];

/** Every `--name: …` declared inside an `@theme` block of a CSS file. */
function themeNames(css) {
  const names = [];
  for (const match of css.matchAll(/@theme\b[^{]*\{/g)) {
    let depth = 1;
    let at = match.index + match[0].length;
    const start = at;
    while (depth > 0 && at < css.length) {
      if (css[at] === "{") depth += 1;
      else if (css[at] === "}") depth -= 1;
      at += 1;
    }
    for (const decl of css.slice(start, at - 1).matchAll(/(--[A-Za-z0-9-]+)\s*:/g)) names.push(decl[1]);
  }
  return names;
}

/** The CSS package's `@theme` names, `--namespace-key` → [namespace, key]; resets and sub-keys left out. */
export function themeTokens(cssPackageDir) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name !== "examples") walk(join(dir, entry.name));
      } else if (entry.name.endsWith(".css") && !entry.name.startsWith("_")) files.push(join(dir, entry.name));
    }
  };
  walk(join(cssPackageDir, "src"));
  const tokens = new Map();
  for (const file of files.sort()) {
    for (const name of themeNames(readFileSync(file, "utf8"))) {
      if (name.includes("--", 2) || name.endsWith("-")) continue;
      const namespace = Object.keys(NAMESPACES)
        .sort((a, b) => b.length - a.length)
        .find((ns) => name === `--${ns}` || name.startsWith(`--${ns}-`));
      if (namespace === undefined) throw new Error(`@theme ${name}: an unknown namespace; decide it in scripts/lib/class-vocabulary.mjs`);
      if (name === `--${namespace}`) continue;
      tokens.set(name, [namespace, name.slice(namespace.length + 3)]);
    }
  }
  return tokens;
}

/** The vocabulary, sorted: token utilities from `@theme`, the static token utilities and the layout set. */
export function classVocabulary(cssPackageDir) {
  const classes = new Set([...STATIC_TOKEN_UTILITIES, ...LAYOUT_UTILITIES]);
  for (const [namespace, key] of themeTokens(cssPackageDir).values()) {
    const make = NAMESPACES[namespace];
    if (make) for (const cls of make(key)) classes.add(cls);
  }
  return [...classes].sort();
}
