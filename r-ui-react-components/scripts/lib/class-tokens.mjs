// Class-token extraction for `verify:utilities-exist`.
//
// Finds the strings that end up in a `class` attribute and splits them into
// tokens. A string counts when it sits in a CLASS CONTEXT:
//
//   - a JSX attribute `class`, `className`, `classNames` or `*ClassName(s)`;
//   - an argument of `cn` / `clsx` / `cx` / `twMerge` / `twJoin` / `cva` / `tv`
//     (object keys included there: clsx's `{ "bg-x": on }` form);
//   - an object property of one of those names (`{ className: "…" }`);
//   - a variable, parameter default or property whose name ends in `class`,
//     `classes`, `className(s)` (`TOP_LAYER_CLASS`, `enterClass = "fade-in"`).
//     The name alone makes a STRING value direct. A lookup table (an array or
//     object literal) under such a name is direct only where some file uses
//     it in a class context: "class" is also an ordinary word
//     (`ERROR_CLASSES = ["5xx server", "Timeouts"]` lists kinds of error), and
//     a table's entries may be labels, while a class string is never anything
//     else. Its tokens come back tagged with `table`; the caller upgrades them
//     to direct when any file's `used` names include it (an exported table is
//     used in another file). Until then they are indirect, which still checks
//     every token Tailwind parses as a utility.
//
// Those are DIRECT. Identifiers met inside a class context are followed to
// their declaration in the same file (a hoisted constant, a lookup table, the
// array a `.map` callback walks); strings reached that way are INDIRECT. The
// caller treats indirect tokens more leniently because a followed constant may
// also hold labels.
//
// Comparison operands (`variant === "ghost"`), the condition of a `? :`, the
// left of `&&`, `!x`, `case` labels and element-access keys are never class
// lists and are skipped, together with every identifier inside them: following
// `shape === "text"` to `shape`'s default would report "text" as a class.
// A token glued to a `${…}` substitution (`bg-${tone}`) is reported as a FRAGMENT: Tailwind only sees
// whole literal class names, so it generates nothing for it.

import ts from "typescript";

import { scriptKind } from "./raw-tailwind.mjs";

const CLASS_CALLS = new Set(["cn", "clsx", "cx", "twMerge", "twJoin", "cva", "tv"]);
const CLASS_ATTR = /^(?:class|className|classNames)$|(?:ClassName|ClassNames)$/;
const CLASS_NAME = /(?:class|classes|classname|classnames)$/i;
const ITERATORS = new Set(["map", "flatMap", "forEach", "filter", "find", "some", "every"]);
const COMPARISON = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);
/** Binary operators whose result is a boolean: nothing on either side is a class. */
const BOOLEAN_RESULT = new Set([
  ...COMPARISON,
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
  ts.SyntaxKind.InKeyword,
  ts.SyntaxKind.InstanceOfKeyword,
]);

const nameText = (name) =>
  name && (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isPrivateIdentifier(name))
    ? name.text
    : undefined;

const calleeName = (expr) =>
  ts.isIdentifier(expr) ? expr.text : ts.isPropertyAccessExpression(expr) ? expr.name.text : undefined;

/** An array or object literal, through `as const` / `satisfies` / parentheses. */
const isLookupTable = (node) => {
  let n = node;
  while (ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isParenthesizedExpression(n)) n = n.expression;
  return ts.isArrayLiteralExpression(n) || ts.isObjectLiteralExpression(n);
};

const isClassCall = (node) => ts.isCallExpression(node) && CLASS_CALLS.has(calleeName(node.expression) ?? "");

/**
 * Every class token in a .ts/.tsx source, and every name a class context in
 * it reaches (`used`: same-file declarations and imports alike).
 * @returns {{ tokens: { token: string, line: number, direct: boolean, fragment: boolean, table?: string }[], used: Set<string> }}
 */
export function classTokens(source, fileName) {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind(fileName));

  // Same-file declarations by name: variables, functions, and parameters.
  const decls = new Map();
  const index = (node) => {
    if (
      (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node) || ts.isFunctionDeclaration(node)) &&
      node.name &&
      ts.isIdentifier(node.name)
    ) {
      const list = decls.get(node.name.text) ?? [];
      list.push(node);
      decls.set(node.name.text, list);
    }
    ts.forEachChild(node, index);
  };
  index(sf);

  const found = new Map(); // `${pos}:${token}` -> entry
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  let table; // the class-named table being collected, if any
  const add = (token, node, direct, fragment = false) => {
    if (!token) return;
    const key = `${node.getStart(sf)}:${token}`;
    const prev = found.get(key);
    if (prev) {
      prev.direct ||= direct;
      return;
    }
    found.set(key, { token, line: lineOf(node), direct, fragment, ...(table && { table }) });
  };
  const addText = (text, node, direct) => {
    for (const t of text.split(/\s+/)) add(t, node, direct);
  };

  const followed = new Set();

  /** Collect the class strings reachable from `node`. */
  const collect = (node, direct, inClassCall = false) => {
    if (!node) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const p = node.parent;
      if (ts.isCaseClause(p)) return;
      if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return;
      if ((ts.isPropertyAssignment(p) || ts.isPropertyAccessExpression(p)) && p.name === node && !inClassCall) return;
      addText(node.text, node, direct);
      return;
    }
    if (ts.isTemplateExpression(node)) {
      const parts = [node.head, ...node.templateSpans.map((s) => s.literal)];
      parts.forEach((lit, i) => {
        const tokens = lit.text.split(/\s+/);
        const gluedBefore = i > 0 && !/^\s/.test(lit.text); // `${x}-thing`
        const gluedAfter = i < parts.length - 1 && !/\s$/.test(lit.text); // `bg-${x}`
        tokens.forEach((t, j) => {
          const fragment = (j === 0 && gluedBefore) || (j === tokens.length - 1 && gluedAfter);
          add(t, lit, direct, fragment && t !== "");
        });
      });
      for (const span of node.templateSpans) collect(span.expression, direct, inClassCall);
      return;
    }
    if (ts.isIdentifier(node)) {
      follow(node.text);
      return;
    }
    if (ts.isPropertyAccessExpression(node)) {
      collect(node.expression, false);
      return;
    }
    if (ts.isElementAccessExpression(node)) {
      collect(node.expression, false);
      return;
    }
    if (ts.isCallExpression(node)) {
      if (isClassCall(node)) {
        for (const a of node.arguments) collect(a, direct, true);
      } else if (ts.isIdentifier(node.expression)) {
        follow(node.expression.text); // a local helper that returns classes
      }
      return;
    }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) {
      if (node.body && !ts.isBlock(node.body)) collect(node.body, false);
      else if (node.body) {
        const visitReturns = (n) => {
          if (ts.isReturnStatement(n)) collect(n.expression, false);
          else if (!ts.isFunctionLike(n)) ts.forEachChild(n, visitReturns);
        };
        ts.forEachChild(node.body, visitReturns);
      }
      return;
    }
    if (ts.isPropertyAssignment(node)) {
      if (inClassCall) collect(node.name, direct, true);
      collect(node.initializer, direct, inClassCall);
      return;
    }
    if (ts.isShorthandPropertyAssignment(node)) {
      follow(node.name.text);
      return;
    }
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return;
    // Only the operands that can BE the value reach the class list. A test's
    // result is a boolean, so neither side of a comparison, the condition of a
    // `? :`, the left of `&&` (it yields only its falsy self) or a `!x` can
    // contribute a class, and following them reaches values such as a
    // parameter default (`shape = "text"` behind `shape === "text"`).
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      if (BOOLEAN_RESULT.has(op)) return;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.CommaToken) {
        collect(node.right, direct, inClassCall);
        return;
      }
    }
    if (ts.isConditionalExpression(node)) {
      collect(node.whenTrue, direct, inClassCall);
      collect(node.whenFalse, direct, inClassCall);
      return;
    }
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) return;
    if (ts.isTypeOfExpression(node)) return;
    ts.forEachChild(node, (child) => collect(child, direct, inClassCall));
  };

  /** Follow a name to its same-file declarations; their strings are indirect. */
  const follow = (name) => {
    if (followed.has(name)) return;
    followed.add(name);
    for (const d of decls.get(name) ?? []) {
      if (ts.isVariableDeclaration(d) || ts.isBindingElement(d)) collect(d.initializer, false);
      else if (ts.isFunctionDeclaration(d)) collect(d, false);
      else if (ts.isParameter(d)) {
        collect(d.initializer, false);
        // `LIST.map((cls) => …)`: the parameter ranges over LIST.
        const fn = d.parent;
        const call = fn?.parent;
        if (
          call &&
          ts.isCallExpression(call) &&
          ts.isPropertyAccessExpression(call.expression) &&
          ITERATORS.has(call.expression.name.text) &&
          fn.parameters[0] === d
        ) {
          collect(call.expression.expression, false);
        }
      }
    }
  };

  const visit = (node) => {
    if (ts.isJsxAttribute(node) && CLASS_ATTR.test(nameText(node.name) ?? "") && node.initializer) {
      collect(ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer, true);
      return;
    }
    if (isClassCall(node)) {
      for (const a of node.arguments) collect(a, true, true);
      return;
    }
    if (ts.isPropertyAssignment(node) && CLASS_ATTR.test(nameText(node.name) ?? "")) {
      collect(node.initializer, true);
      return;
    }
    if (
      (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node) || ts.isPropertyDeclaration(node)) &&
      node.initializer &&
      CLASS_NAME.test(nameText(node.name) ?? "")
    ) {
      if (isLookupTable(node.initializer)) namedTables.push(node);
      else collect(node.initializer, true);
    }
    ts.forEachChild(node, visit);
  };
  const namedTables = [];
  visit(sf);
  // After the walk, `followed` holds every name a class context reached. A
  // table it did not reach waits, tagged, for the caller's cross-file verdict.
  const used = new Set(followed);
  for (const node of namedTables) {
    const name = nameText(node.name);
    if (name !== undefined && used.has(name)) collect(node.initializer, true);
    else {
      table = name;
      collect(node.initializer, false);
      table = undefined;
    }
  }

  return { tokens: [...found.values()].sort((a, b) => a.line - b.line), used };
}
