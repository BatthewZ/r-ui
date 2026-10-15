// Minimal CSS reader for the checks: comments, strings and parentheses aware.
// Enough for token files; not a general-purpose CSS parser.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function stripComments(css) {
  let out = "";
  let quote = null;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      out += c;
      if (c === "\\") out += css[++i] ?? "";
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
      out += c;
    } else if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end === -1 ? css.length : end + 1;
    } else out += c;
  }
  return out;
}

/** Parse into nodes: {type:"rule",selector,decls,children} | {type:"at",name,prelude,children|null} */
export function parse(css) {
  const src = stripComments(css);
  let i = 0;

  function readChunk() {
    let quote = null;
    let depth = 0;
    const start = i;
    for (; i < src.length; i++) {
      const c = src[i];
      if (quote) {
        if (c === "\\") i++;
        else if (c === quote) quote = null;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === "(") depth++;
      else if (c === ")") depth--;
      else if (depth === 0 && (c === "{" || c === ";" || c === "}")) break;
    }
    return { text: src.slice(start, i).trim(), term: src[i] };
  }

  function block() {
    const nodes = [];
    const decls = [];
    while (i < src.length) {
      const { text, term } = readChunk();
      if (term === "{") {
        i++;
        const inner = block();
        if (text.startsWith("@")) {
          const m = /^@([\w-]+)\s*([\s\S]*)$/.exec(text);
          nodes.push({ type: "at", name: m[1], prelude: m[2].trim(), children: inner.nodes, decls: inner.decls });
        } else {
          nodes.push({ type: "rule", selector: text, decls: inner.decls, children: inner.nodes });
        }
        continue;
      }
      if (text) {
        if (text.startsWith("@")) {
          const m = /^@([\w-]+)\s*([\s\S]*)$/.exec(text);
          nodes.push({ type: "at", name: m[1], prelude: m[2].trim(), children: null, decls: [] });
        } else {
          const colon = text.indexOf(":");
          if (colon > 0) {
            let value = text.slice(colon + 1).trim();
            const important = /!important\s*$/i.test(value);
            if (important) value = value.replace(/\s*!important\s*$/i, "");
            decls.push({ prop: text.slice(0, colon).trim(), value, important });
          }
        }
      }
      i++; // consume ; or }
      if (term === "}" || term === undefined) break;
    }
    return { nodes, decls };
  }

  return block().nodes;
}

/** Read a stylesheet, inlining relative @imports. Bare specifiers (e.g. "tailwindcss") are skipped. */
export function loadSheet(file, seen = new Set()) {
  const abs = resolve(file);
  if (seen.has(abs)) return [];
  seen.add(abs);
  const nodes = parse(readFileSync(abs, "utf8"));
  const out = [];
  for (const n of nodes) {
    if (n.type === "at" && n.name === "import") {
      const m = /^(?:url\()?\s*["']([^"']+)["']/.exec(n.prelude);
      if (m && (m[1].startsWith("./") || m[1].startsWith("../"))) {
        out.push(...loadSheet(resolve(dirname(abs), m[1]), seen));
        continue;
      }
    }
    out.push(n);
  }
  return out;
}

export const splitSelectors = (sel) => sel.split(",").map((s) => s.trim().replace(/\s+/g, " "));

/** Top-level (not inside any at-rule) declarations of rules whose selector list contains `selector`. */
export function declsFor(nodes, selector) {
  const map = new Map();
  for (const n of nodes) {
    if (n.type === "rule" && splitSelectors(n.selector).includes(selector)) {
      for (const d of n.decls) map.set(d.prop, d.value);
    }
  }
  return map;
}

/** Find the index of the paren matching the "(" at `open`. */
function matchParen(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")" && --depth === 0) return i;
  }
  throw new Error(`unbalanced parentheses in: ${s}`);
}

/** Substitute var() references recursively against `map`. Throws on a missing token with no fallback. */
export function resolveVars(value, map, stack = []) {
  let out = value;
  for (let guard = 0; guard < 100; guard++) {
    const at = out.indexOf("var(");
    if (at === -1) return out.trim();
    const close = matchParen(out, at + 3);
    const inner = out.slice(at + 4, close);
    const comma = inner.indexOf(",");
    const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma === -1 ? null : inner.slice(comma + 1).trim();
    let sub;
    if (map.has(name)) {
      if (stack.includes(name)) throw new Error(`var() cycle: ${[...stack, name].join(" -> ")}`);
      sub = resolveVars(map.get(name), map, [...stack, name]);
    } else if (fallback !== null) sub = resolveVars(fallback, map, stack);
    else throw new Error(`${name} is not declared${stack.length ? ` (via ${stack.join(" -> ")})` : ""}`);
    out = out.slice(0, at) + sub + out.slice(close + 1);
  }
  throw new Error(`too many var() substitutions in ${value}`);
}
