#!/usr/bin/env node
// Derives what only the component library can say about its components and
// writes it as committed JSON under src/contracts/generated/:
//
//   components.json      every component and compound part the runtime barrel
//                        exports (addressable or not: the curated tables decide
//                        that), with its category, props (name, type, required),
//                        closed value sets, `classNames`
//                        slot keys, React-node props (nested ones too),
//                        whether it spreads native element attributes and
//                        whether those carry a DOM `name` (a form control's);
//   declared-paths.json  every prop path the declarations allow, nested ones
//                        (`items[].href`) included: what the curated tables
//                        are gated against;
//   prop-docs.json       each prop's first doc sentence. Only the reference
//                        (`./reference`) reads it, so the renderer and the
//                        validator never ship it.
//
// Two sources, read from the INSTALLED package (node_modules), never the
// sibling's working tree: the runtime barrel (what renders) and its built
// `dist/**/*.d.ts` (what the props are), read through the TypeScript checker so
// aliases, intersections, `Omit`s and unions resolve the way the compiler
// resolves them. It throws on anything it cannot attribute: a runtime export
// with no declaration, a declared component the barrel lacks, a component with
// no props signature, or a `classNames` no component's props reach.
//
// Usage: node scripts/derive-contracts.mjs [--check] [--out <dir>] [--library <package dir>]
//   --out and --library exist for this script's own test (a tampered copy, a fixture library).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

import { isMain, PKG, pathArg, readText } from "./lib/gate.mjs";

const LIBRARY = "@batthewz/r-ui-react-components";

/** Props every component has or no document writes: not listed. */
const UNLISTED = new Set(["ref", "key", "className", "classNames", "children"]);

/**
 * Native attributes that are URLs. Declared by React rather than the library,
 * they still count as a component's paths, so a table naming one (an image
 * object's `srcSet`) can be gated.
 */
const URL_ATTRIBUTES = new Set(["href", "src", "srcset", "poster", "cite", "action", "formaction", "data"]);

/** How deep nested paths are followed (`plans[].features[].label` is 3). */
const MAX_DEPTH = 4;

const FORWARD_REF = Symbol.for("react.forward_ref");
const MEMO = Symbol.for("react.memo");

function isComponentLike(value) {
  if (typeof value === "function") return true;
  return typeof value === "object" && value !== null && (value.$$typeof === FORWARD_REF || value.$$typeof === MEMO);
}

const isExportedComponent = (name, value) => /^[A-Z]/.test(name) && isComponentLike(value);

/** Every component the barrel exports at runtime, parts as `"Root.Part"`, in barrel order. */
export function runtimeComponents(namespace) {
  const names = [];
  for (const [name, value] of Object.entries(namespace)) {
    if (!isExportedComponent(name, value)) continue;
    names.push(name);
    for (const [part, member] of Object.entries(value)) {
      if (isExportedComponent(part, member)) names.push(`${name}.${part}`);
    }
  }
  return names;
}

/** The installed library's package directory (its entry is `dist/index.js`). */
function installedLibrary() {
  const entry = fileURLToPath(import.meta.resolve(LIBRARY, pathToFileURL(join(PKG, "package.json")).href));
  return join(dirname(entry), "..");
}

const isDeclaredByReact = (declaration) => {
  const file = declaration.getSourceFile().fileName;
  return file.includes(`${sep}@types${sep}`) || file.includes(`${sep}typescript${sep}lib${sep}`);
};

/** Declared by one of React's element attribute interfaces (`HTMLAttributes`, `AriaAttributes`, …). */
const isNativeAttribute = (declaration) =>
  isDeclaredByReact(declaration) && ts.isInterfaceDeclaration(declaration.parent) && /Attributes$/.test(declaration.parent.name.text);

const ownDeclarations = (symbol) => (symbol.declarations ?? []).filter((d) => !isDeclaredByReact(d));

const oneLine = (text) => text.replace(/\s+/g, " ").trim();

/** The first sentence of the doc comment's first paragraph. */
function firstSentence(symbol, checker) {
  const text = ts.displayPartsToString(symbol.getDocumentationComment(checker));
  const paragraph = oneLine(text.split(/\n\s*\n/)[0] ?? "");
  if (paragraph === "") return undefined;
  const end = /[.!?](?=\s+[A-Z`(])/.exec(paragraph);
  return end ? paragraph.slice(0, end.index + 1) : paragraph;
}

const COMPILER_OPTIONS = {
  strict: true,
  skipLibCheck: true,
  noEmit: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
};

/** A program over the library's declarations plus one virtual module of `lines`. */
function compile(root, lines, oldProgram) {
  const synthetic = join(root, "dist", "__derive_contracts__.ts");
  const text = ['import * as L from "./index";', 'import type { ReactElement } from "react";', ...lines].join("\n");
  const host = ts.createCompilerHost(COMPILER_OPTIONS);
  const getSourceFile = host.getSourceFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.getSourceFile = (file, language, ...rest) =>
    file === synthetic ? ts.createSourceFile(file, text, language, true) : getSourceFile(file, language, ...rest);
  host.fileExists = (file) => file === synthetic || fileExists(file);
  const program = ts.createProgram([synthetic], COMPILER_OPTIONS, host, oldProgram);
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(synthetic);
  const errors = ts.getPreEmitDiagnostics(program, source).map((d) => ts.flattenDiagnosticMessageText(d.messageText, " "));
  const exports = new Map(checker.getExportsOfModule(checker.getSymbolAtLocation(source)).map((s) => [s.name, s]));
  return { program, checker, errors, exports };
}

/**
 * The checker over every runtime export, named through the barrel's
 * declarations (a name they lack is a compile error, reported). A generic
 * component whose type parameters all have defaults (`as` defaults to `"div"`)
 * is also instantiated with them, because its native attributes only exist once
 * the element is known.
 */
function createDeriver(root, names) {
  const ids = new Map(names.map((name, index) => [name, `c${index}`]));
  const lines = [
    "export declare const __element: ReactElement;",
    ...names.map((name) => `export declare const ${ids.get(name)}: typeof L.${name};`),
  ];
  const first = compile(root, lines);
  if (first.errors.length > 0) {
    throw new Error(
      `the runtime barrel exports names its declarations (${relative(PKG, join(root, "dist", "index.d.ts"))}) lack:\n  ${first.errors.join("\n  ")}`,
    );
  }

  const instantiations = [];
  for (const name of names) {
    const type = first.checker.getTypeOfSymbol(first.exports.get(ids.get(name)));
    const parameters = type.getCallSignatures()[0]?.getTypeParameters() ?? [];
    if (parameters.length === 0) continue;
    const defaults = parameters.map((p) => first.checker.getDefaultFromTypeParameter(p));
    if (defaults.some((d) => d === undefined)) continue;
    const args = defaults.map((d) => first.checker.typeToString(d, undefined, ts.TypeFormatFlags.NoTruncation));
    instantiations.push([name, `export declare const ${ids.get(name)}i: typeof L.${name}<${args.join(", ")}>;`]);
  }
  const final = compile(root, [...lines, ...instantiations.map(([, line]) => line)], first.program);
  if (final.errors.length > 0) throw new Error(`could not instantiate generic components with their defaults:\n  ${final.errors.join("\n  ")}`);

  const instantiated = new Set(instantiations.map(([name]) => name));
  const { checker, program, exports } = final;
  return {
    checker,
    program,
    root,
    elementType: checker.getTypeOfSymbol(exports.get("__element")),
    typeOf: (name) => checker.getTypeOfSymbol(exports.get(ids.get(name))),
    instanceOf: (name) => (instantiated.has(name) ? checker.getTypeOfSymbol(exports.get(`${ids.get(name)}i`)) : null),
  };
}

/** Members of a union, `undefined` removed (an optional prop's type includes it). */
function members(type) {
  return (type.isUnion() ? type.types : [type]).filter((t) => !(t.flags & ts.TypeFlags.Undefined));
}

/** Literal values in the order a union type node writes them, following aliases; null when it is not that simple. */
function writtenOrder(checker, node, depth = 0) {
  if (!node || depth > 4) return null;
  if (ts.isParenthesizedTypeNode(node)) return writtenOrder(checker, node.type, depth + 1);
  if (ts.isLiteralTypeNode(node)) {
    if (ts.isStringLiteral(node.literal)) return [node.literal.text];
    if (ts.isNumericLiteral(node.literal)) return [Number(node.literal.text)];
    return null;
  }
  if (ts.isUnionTypeNode(node)) {
    const out = [];
    for (const member of node.types) {
      const values = writtenOrder(checker, member, depth + 1);
      if (values === null) return null;
      out.push(...values);
    }
    return out;
  }
  if (ts.isTypeReferenceNode(node) && !node.typeArguments) {
    let symbol = checker.getSymbolAtLocation(node.typeName);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const alias = symbol?.declarations?.find(ts.isTypeAliasDeclaration);
    return alias ? writtenOrder(checker, alias.type, depth + 1) : null;
  }
  return null;
}

/**
 * The closed set a type bounds a value to, or null. Booleans and anything open
 * are not sets. In written order where the declaration spells it out.
 */
function literalSet(checker, symbol, type) {
  const parts = members(type);
  if (parts.length < 2 && !(parts.length === 1 && parts[0].isLiteral())) return null;
  if (!parts.every((t) => t.isStringLiteral() || t.isNumberLiteral())) return null;
  const values = parts.map((t) => t.value);
  for (const declaration of ownDeclarations(symbol)) {
    const written = writtenOrder(checker, declaration.type);
    if (written && written.length === values.length && values.every((v) => written.includes(v))) return written;
  }
  return values.every((v) => typeof v === "number") ? values.sort((a, b) => a - b) : values;
}

function typeText(checker, symbol, type) {
  const set = literalSet(checker, symbol, type);
  if (set) return set.map((v) => JSON.stringify(v)).join(" | ");
  const parts = members(type);
  if (parts.length === 1 && parts[0].flags & ts.TypeFlags.TypeParameter) {
    const constraint = checker.getBaseConstraintOfType(parts[0]);
    if (constraint) return oneLine(checker.typeToString(constraint, undefined, ts.TypeFormatFlags.NoTruncation));
  }
  const declared = ownDeclarations(symbol).find((d) => d.type);
  if (declared) return oneLine(declared.type.getText());
  return oneLine(checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation));
}

const isAnyOrUnknown = (type) => (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0;

/** Takes only a function: every member has a call signature. */
const onlyFunctions = (type) => {
  const parts = members(type);
  return parts.length > 0 && parts.every((t) => t.getCallSignatures().length > 0);
};

/** Typed as a React node: an element is assignable to it. */
function takesNode(ctx, type) {
  if (isAnyOrUnknown(type)) return false;
  return ctx.checker.isTypeAssignableTo(ctx.elementType, type);
}

/** The props parameter's type for a component's type (function, exotic or class). */
function propsTypeOf(ctx, name, type) {
  const signature = type.getCallSignatures()[0] ?? type.getConstructSignatures()[0];
  if (!signature) throw new Error(`${name}: declared with no call or construct signature, so it has no props to read`);
  const parameter = signature.getParameters()[0];
  if (!parameter) return null;
  return ctx.checker.getTypeOfSymbol(parameter);
}

/** Every property of an object type, across a union's members: name → symbols, required in all. */
function collectProperties(ctx, type) {
  const constituents = type.isUnion() ? type.types : [type];
  const merged = new Map();
  for (const constituent of constituents) {
    for (const symbol of ctx.checker.getPropertiesOfType(constituent)) {
      const entry = merged.get(symbol.name) ?? { symbols: [], present: 0, required: true };
      entry.symbols.push(symbol);
      entry.present += 1;
      if (symbol.flags & ts.SymbolFlags.Optional) entry.required = false;
      merged.set(symbol.name, entry);
    }
  }
  for (const entry of merged.values()) if (entry.present < constituents.length) entry.required = false;
  return merged;
}

const isOwnProp = (entry) => entry.symbols.some((s) => ownDeclarations(s).length > 0);

function propType(ctx, symbol) {
  return ctx.checker.getTypeOfSymbol(symbol);
}

/** Object types worth descending into: the library declared at least one of their properties. */
function nestedObjects(ctx, type) {
  const out = [];
  for (const part of members(type)) {
    if (part.flags & ts.TypeFlags.Null) continue;
    if (ctx.checker.isArrayType(part) || ctx.checker.isTupleType(part)) continue;
    if (part.getCallSignatures().length > 0) continue;
    if (!(part.flags & ts.TypeFlags.Object) && !part.isIntersection()) continue;
    if (ctx.checker.getPropertiesOfType(part).some((p) => ownDeclarations(p).length > 0)) out.push(part);
  }
  return out;
}

function elementTypes(ctx, type) {
  const out = [];
  for (const part of members(type)) {
    if (ctx.checker.isArrayType(part)) out.push(ctx.checker.getTypeArguments(part)[0]);
    else if (ctx.checker.isTupleType(part)) out.push(...ctx.checker.getTypeArguments(part));
  }
  return out.filter(Boolean);
}

const isDeclaredInTypes = (symbol) => (symbol.declarations ?? []).some((d) => d.getSourceFile().fileName.includes(`${sep}@types${sep}`));

/**
 * The keys of the closed record a prop takes, or null: every object member of
 * its type has only optional keys and no index signature (`{ base?: N } &
 * Partial<Record<"@sm" | …, N>>`), other members being non-objects (`N`).
 * React's own attribute bags (`CSSProperties`) are not records a document writes.
 */
function recordKeys(ctx, types) {
  const keys = new Set();
  for (const type of types) {
    for (const part of members(type)) {
      if (!(part.flags & ts.TypeFlags.Object) && !part.isIntersection()) continue;
      if (ctx.checker.isArrayType(part) || ctx.checker.isTupleType(part) || part.getCallSignatures().length > 0) return null;
      if (ctx.checker.getIndexInfoOfType(part, ts.IndexKind.String)) return null;
      const properties = ctx.checker.getPropertiesOfType(part);
      if (properties.length === 0 || properties.some((p) => !(p.flags & ts.SymbolFlags.Optional) || isDeclaredInTypes(p))) return null;
      for (const property of properties) keys.add(property.name);
    }
  }
  return keys.size > 0 ? [...keys].sort() : null;
}

/** Value types behind a string index signature (`Record<string, X>`): the `.*` step. */
function indexValueTypes(ctx, type) {
  const out = [];
  for (const part of members(type)) {
    if (!(part.flags & ts.TypeFlags.Object) || ctx.checker.isArrayType(part) || ctx.checker.isTupleType(part)) continue;
    const info = ctx.checker.getIndexInfoOfType(part, ts.IndexKind.String);
    if (info) out.push(info.type);
  }
  return out;
}

/** The standard-library classes a value of `type` may be, among Date, Set and RegExp. */
function builtinsIn(type) {
  const found = new Set();
  for (const part of members(type)) {
    const name = part.getSymbol()?.getName();
    const declarations = part.getSymbol()?.declarations ?? [];
    if (!declarations.some(isDeclaredByReact)) continue;
    if (name === "Date") found.add("date");
    else if (name === "Set" || name === "ReadonlySet") found.add("set");
    else if (name === "RegExp") found.add("regexp");
  }
  return found;
}

/**
 * What a callback hands back that JSON cannot hold: a Date or a Set in its
 * first argument, or one field down (`{ start: Date, end: Date }`).
 */
function callbackKinds(ctx, type) {
  const found = new Set();
  for (const part of members(type)) {
    const parameter = part.getCallSignatures()[0]?.getParameters()[0];
    if (!parameter) continue;
    const argument = ctx.checker.getTypeOfSymbol(parameter);
    for (const kind of builtinsIn(argument)) found.add(kind);
    for (const object of members(argument)) {
      if (!(object.flags & ts.TypeFlags.Object)) continue;
      for (const field of ctx.checker.getPropertiesOfType(object)) {
        for (const kind of builtinsIn(ctx.checker.getTypeOfSymbol(field))) found.add(kind);
      }
    }
  }
  return found;
}

/** Records what one path's type is: a React node, a function, a Date, a Set or a RegExp. */
function classify(ctx, sink, path, type, nested) {
  sink.paths.add(path);
  if (nested && takesNode(ctx, type)) sink.nodes.add(path);
  if (onlyFunctions(type)) {
    sink.functions.add(path);
    for (const kind of callbackKinds(ctx, type)) sink.callbacks[kind]?.add(path);
  }
  for (const kind of builtinsIn(type)) sink[kind].add(path);
}

/** Walks a prop's type for its nested paths: array elements (`[]`), record values (`.*`), object fields. */
function walkNested(ctx, sink, prefix, type, depth, seen) {
  if (depth > MAX_DEPTH) return;
  for (const element of elementTypes(ctx, type)) {
    const path = `${prefix}[]`;
    classify(ctx, sink, path, element, true);
    walkNested(ctx, sink, path, element, depth + 1, seen);
  }
  for (const value of indexValueTypes(ctx, type)) {
    const path = `${prefix}.*`;
    classify(ctx, sink, path, value, true);
    walkNested(ctx, sink, path, value, depth + 1, seen);
  }
  for (const object of nestedObjects(ctx, type)) {
    if (seen.has(object)) continue;
    const inner = new Set(seen).add(object);
    for (const [name, entry] of collectProperties(ctx, object)) {
      const own = isOwnProp(entry);
      if (!own && !URL_ATTRIBUTES.has(name.toLowerCase())) continue;
      const path = `${prefix}.${name}`;
      const valueType = propType(ctx, entry.symbols[0]);
      if (!own) {
        sink.paths.add(path);
        continue;
      }
      classify(ctx, sink, path, valueType, true);
      walkNested(ctx, sink, path, valueType, depth + 1, inner);
    }
  }
}

function describe(ctx, name, classNamesSeen) {
  const { checker } = ctx;
  const propsType = propsTypeOf(ctx, name, ctx.typeOf(name));
  const sink = {
    paths: new Set(),
    nodes: new Set(),
    functions: new Set(),
    date: new Set(),
    set: new Set(),
    regexp: new Set(),
    callbacks: { date: new Set(), set: new Set() },
  };
  const record = { props: [], sink, docs: [] };
  if (propsType === null) return record;

  const properties = collectProperties(ctx, propsType);
  const enums = {};
  const records = {};
  let native = false;
  let domName = false;
  const readNative = (prop, entry) => {
    const isNative = entry.symbols.some((s) => (s.declarations ?? []).some(isNativeAttribute));
    native ||= isNative;
    domName ||= isNative && prop === "name";
    if (URL_ATTRIBUTES.has(prop.toLowerCase())) sink.paths.add(prop);
  };
  for (const [prop, entry] of properties) {
    const own = isOwnProp(entry);
    if (!own) {
      readNative(prop, entry);
      continue;
    }
    if (prop === "classNames") {
      for (const s of entry.symbols) for (const d of ownDeclarations(s)) classNamesSeen.add(d);
      const keys = new Set();
      for (const s of entry.symbols) {
        for (const part of members(propType(ctx, s))) {
          for (const key of checker.getPropertiesOfType(part)) keys.add(key.name);
        }
      }
      if (keys.size === 0) throw new Error(`${name}: declares classNames but no slot key could be read from its type`);
      record.slots = [...keys];
      continue;
    }
    if (prop === "ref" || prop === "key") continue;
    const types = entry.symbols.map((s) => propType(ctx, s));
    sink.paths.add(prop);
    if (UNLISTED.has(prop)) continue;
    let texts = [...new Set(entry.symbols.map((s, i) => typeText(checker, s, types[i])))].filter((t) => t !== "never");
    if (texts.includes("true") && texts.includes("false")) texts = ["boolean", ...texts.filter((t) => t !== "true" && t !== "false")];
    if (texts.length > 1) texts = texts.map((t) => (t.includes("=>") ? `(${t})` : t));
    const description = entry.symbols.map((s) => firstSentence(s, checker)).find(Boolean);
    if (description) record.docs.push({ name: prop, description });
    record.props.push({ name: prop, type: texts.join(" | "), required: entry.required });
    const sets = entry.symbols.map((s, i) => literalSet(checker, s, types[i]));
    if (sets.every(Boolean)) enums[prop] = [...new Set(sets.flat())];
    const keys = recordKeys(ctx, types);
    if (keys) records[prop] = keys;
    if (types.some((t) => takesNode(ctx, t))) sink.nodes.add(prop);
    if (types.every(onlyFunctions)) sink.functions.add(prop);
    for (const t of types) for (const kind of onlyFunctions(t) ? callbackKinds(ctx, t) : []) sink.callbacks[kind]?.add(prop);
    for (const t of types) {
      for (const kind of builtinsIn(t)) sink[kind].add(prop);
      walkNested(ctx, sink, prop, t, 0, new Set());
    }
  }
  const instance = ctx.instanceOf(name);
  if (instance) {
    const instanceProps = propsTypeOf(ctx, name, instance);
    for (const [prop, entry] of collectProperties(ctx, instanceProps)) if (!isOwnProp(entry)) readNative(prop, entry);
  }
  record.props.sort((a, b) => a.name.localeCompare(b.name));
  if (Object.keys(enums).length > 0) record.propEnums = Object.fromEntries(Object.entries(enums).sort(([a], [b]) => a.localeCompare(b)));
  if (Object.keys(records).length > 0) record.recordKeys = Object.fromEntries(Object.entries(records).sort(([a], [b]) => a.localeCompare(b)));
  if (record.slots) record.slots.sort();
  if (sink.nodes.size > 0) record.nodeProps = [...sink.nodes].sort();
  if (native) record.nativeAttributes = true;
  if (domName) record.domName = true;
  return record;
}

/** The library group a component's declaration lives in: `components/<group>/…`, else `hooks` or `util`. */
function categoryOf(ctx, barrel, name) {
  const exported = barrel.get(name);
  const target = exported && exported.flags & ts.SymbolFlags.Alias ? ctx.checker.getAliasedSymbol(exported) : exported;
  for (const declaration of target?.declarations ?? []) {
    const file = relative(join(ctx.root, "dist"), declaration.getSourceFile().fileName).split(sep);
    if (file[0] === "components" && file.length > 2) return file[1];
    if ((file[0] === "hooks" || file[0] === "util") && file.length > 1) return file[0];
  }
  throw new Error(`${name}: its declaration is not under dist/components/<group>/, hooks/ or util/, so it has no category`);
}

/**
 * Every `classNames` declared in a type the barrel exports (a public props
 * type), so one no component's props reach is reported. Internal helpers'
 * props (unexported) are not a consumer's surface.
 */
function publicClassNamesDeclarations(ctx, barrel) {
  const found = [];
  for (const file of ctx.program.getSourceFiles()) {
    const path = relative(join(ctx.root, "dist", "components"), file.fileName);
    if (path.startsWith("..") || !path.endsWith(".d.ts")) continue;
    const visit = (node) => {
      if (ts.isPropertySignature(node) && node.name.getText() === "classNames") {
        let owner = node.parent;
        while (owner && !ts.isInterfaceDeclaration(owner) && !ts.isTypeAliasDeclaration(owner)) owner = owner.parent;
        if (owner && barrel.has(owner.name.text)) found.push(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return found;
}

/** Derives every generated file from the library package at `root` (its runtime entry and its declarations). */
export async function derive(root = installedLibrary()) {
  const namespace = await import(pathToFileURL(join(root, "dist", "index.js")).href);
  const names = runtimeComponents(namespace);
  if (names.length === 0) throw new Error(`${relative(PKG, root)}: the barrel exports no component; the scan is broken`);
  const ctx = createDeriver(root, names);

  // A component the declarations export that the runtime barrel lacks.
  const declared = new Set();
  const barrelModule = ctx.checker.getSymbolAtLocation(ctx.program.getSourceFile(join(root, "dist", "index.d.ts")));
  const barrel = new Map(ctx.checker.getExportsOfModule(barrelModule).map((s) => [s.name, s]));
  for (const symbol of barrel.values()) {
    if (!/^[A-Z]/.test(symbol.name) || !(symbol.flags & ts.SymbolFlags.Alias)) continue;
    const target = ctx.checker.getAliasedSymbol(symbol);
    if (!(target.flags & (ts.SymbolFlags.Function | ts.SymbolFlags.Variable | ts.SymbolFlags.Class))) continue;
    const type = ctx.checker.getTypeOfSymbol(target);
    if (type.getCallSignatures().length + type.getConstructSignatures().length > 0) declared.add(symbol.name);
  }
  const roots = new Set(names.filter((n) => !n.includes(".")));
  const extra = [...declared].filter((n) => !roots.has(n));
  if (extra.length > 0) {
    // Only a PascalCase callable the barrel does not export as a component is a mismatch.
    const notComponents = extra.filter((n) => isComponentLike(namespace[n]));
    if (notComponents.length > 0) throw new Error(`declared as components but not exported at runtime: ${notComponents.join(", ")}`);
  }

  const seen = new Set();
  const components = {};
  const declaredPaths = {};
  const propDocs = {};
  const sorted = (set) => [...set].sort();
  for (const name of [...names].sort()) {
    const { sink, docs, ...record } = describe(ctx, name, seen);
    components[name] = { category: categoryOf(ctx, barrel, name.split(".")[0]), ...record };
    if (docs.length > 0) propDocs[name] = docs.sort((a, b) => a.name.localeCompare(b.name));
    declaredPaths[name] = {
      paths: sorted(sink.paths),
      ...(sink.functions.size > 0 && { functions: sorted(sink.functions) }),
      ...(sink.date.size > 0 && { dates: sorted(sink.date) }),
      ...(sink.set.size > 0 && { sets: sorted(sink.set) }),
      ...(sink.regexp.size > 0 && { regexps: sorted(sink.regexp) }),
      ...(sink.callbacks.date.size > 0 && { dateCallbacks: sorted(sink.callbacks.date) }),
      ...(sink.callbacks.set.size > 0 && { setCallbacks: sorted(sink.callbacks.set) }),
    };
  }

  const publicSlots = publicClassNamesDeclarations(ctx, barrel);
  if (publicSlots.length === 0) throw new Error("found no public classNames declaration; the slot scan is broken");
  const unplaced = publicSlots.filter((d) => !seen.has(d));
  if (unplaced.length > 0) {
    const where = unplaced.map((d) => {
      const file = d.getSourceFile();
      const { line } = file.getLineAndCharacterOfPosition(d.getStart());
      return `${relative(root, file.fileName)}:${line + 1}`;
    });
    throw new Error(`classNames declared where no component's props reach it (its slot keys would vanish):\n  ${where.join("\n  ")}`);
  }

  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  return {
    "components.json": { library: { name: pkg.name, version: pkg.version }, components },
    "declared-paths.json": declaredPaths,
    "prop-docs.json": propDocs,
  };
}

const isFlat = (value) =>
  Array.isArray(value)
    ? value.every((v) => v === null || typeof v !== "object")
    : Object.values(value).every((v) => v === null || typeof v !== "object");

/** Indented JSON with each flat array or object (a prop row, a value set) on one line, so diffs stay per entry. */
export function serialise(value) {
  const write = (v, indent) => {
    if (v === null || typeof v !== "object" || isFlat(v)) return JSON.stringify(v);
    const inner = `${indent}  `;
    const rows = Array.isArray(v)
      ? v.map((item) => `${inner}${write(item, inner)}`)
      : Object.entries(v).map(([key, item]) => `${inner}${JSON.stringify(key)}: ${write(item, inner)}`);
    const [open, close] = Array.isArray(v) ? ["[", "]"] : ["{", "}"];
    return rows.length === 0 ? `${open}${close}` : `${open}\n${rows.join(",\n")}\n${indent}${close}`;
  };
  return `${write(value, "")}\n`;
}

async function main() {
  const check = process.argv.includes("--check");
  const outDir = pathArg("--out", join(PKG, "src", "contracts", "generated"));
  const files = await derive(pathArg("--library", undefined));
  const stale = [];
  for (const [file, value] of Object.entries(files)) {
    const path = join(outDir, file);
    const next = serialise(value);
    if (readText(path) === next) continue;
    if (check) stale.push(relative(PKG, path));
    else writeFileSync(path, next);
  }
  if (check && stale.length > 0) {
    console.error(
      `derive-contracts --check — stale: ${stale.join(", ")}\n` +
        "The installed library's declarations moved. Decide what the new or changed components mean in the curated tables first, then run `bun run derive:contracts`.",
    );
    process.exit(1);
  }
  const count = Object.keys(files["components.json"].components).length;
  console.log(`derive-contracts — ${check ? "OK" : "written"} (${count} components and parts)`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(`derive-contracts — ${error.message}`);
    process.exit(1);
  });
}
