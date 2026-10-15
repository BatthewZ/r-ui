// Minimal CSS reading for the gates. Not a CSS parser: it reads the flat
// shapes this package and the CSS package write (`selector { --name: value; }`
// rules, `@theme` blocks, one level of at-rule nesting) and nothing else.

/** Blank comment bodies (keeping newlines) so prose can neither satisfy nor trip a scan. */
export const blankComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

/** 1-based line number of `offset` in `text`. */
export const lineAt = (text, offset) => text.slice(0, offset).split("\n").length;

/**
 * Every innermost `{ … }` block with the text before it (its selector or
 * at-rule prelude) and its declarations. A `@media (…) { :root { … } }` yields
 * the inner `:root` block with `parents: ["@media (…)"]`.
 */
export function readBlocks(css) {
  const text = blankComments(css);
  const blocks = [];
  const stack = []; // { prelude, start }
  let preludeStart = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") {
      stack.push({ prelude: text.slice(preludeStart, i).trim(), start: i + 1, hasChild: false });
      if (stack.length > 1) stack[stack.length - 2].hasChild = true;
      preludeStart = i + 1;
    } else if (ch === "}") {
      const open = stack.pop();
      if (open && !open.hasChild) {
        const body = text.slice(open.start, i);
        blocks.push({
          prelude: open.prelude,
          parents: stack.map((s) => s.prelude),
          body,
          line: lineAt(text, open.start),
          decls: readDecls(body, text, open.start),
        });
      }
      preludeStart = i + 1;
    } else if (ch === ";" && stack.length === 0) {
      // A top-level statement (`@import …;`) ends here; it is no selector.
      preludeStart = i + 1;
    }
  }
  return blocks;
}

/** `--name: value;` declarations inside a block body, with line numbers. */
function readDecls(body, text, bodyOffset) {
  const decls = [];
  const re = /(--[A-Za-z0-9-]+)\s*:\s*([^;]*?)\s*(?:;|$)/g;
  for (const m of body.matchAll(re)) {
    decls.push({ name: m[1], value: m[2].trim(), line: lineAt(text, bodyOffset + m.index) });
  }
  return decls;
}
