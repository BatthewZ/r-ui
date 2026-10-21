/**
 * A component node's props as the component takes them. Every decision is the
 * contract's or the policy's: forbidden and id props dropped, handlers wired
 * to the dispatcher, markers resolved, then (on the RESOLVED value, so a
 * `$ref` cannot step around them) URL, image, element, Intl and `data-*`
 * judgements, and the coercions into Dates, Sets, icons, formatters,
 * accessors, templates and form handles.
 */

import { createElement, type ReactNode } from "react";

import { type DropReason, dropReason, type NameRole, nameRole, refPropKinds } from "../spec/contract-facts";
import { isHandler, isName, isNodeMarker, isPlainObject } from "../spec/guards";
import {
  CONSTRAINED_DATA_ATTRIBUTES,
  IMAGE_URL_PROPS,
  isAllowedDataAttribute,
  isAllowedDataValue,
  lowerCaseProp,
  URL_PROPS,
} from "../spec/policy";
import { makeIssue } from "../spec/issue";
import { appendPointer } from "../spec/pointer";
import { type ComponentContract, type DateKind, HANDLER_KEY_PATTERN, type Issue, type PropPath } from "../spec/types";
import { DIAGNOSTIC_CLASSES } from "../diagnostics";
import {
  coerceDate,
  coerceDelimiter,
  coerceSet,
  fieldSegments,
  optionElements,
  Refusal,
  rowKeyAccessor,
  rowTextAccessor,
} from "./coerce";
import { coerceColumns } from "./columns";
import { diagnosticElement } from "./diagnostic";
import { createFormatter, formatOptionsWork, toFormatOptions } from "./format";
import { HOST_PROPS } from "./host-policy";
import { DROP, type ParsedPropPath, parsePropPath, transformAt } from "../spec/prop-path";
import { handlerCallback, PropResolver } from "./resolve";
import type { Scope } from "./scope";
import { imageAllowed, intlValueAllowed, srcSetAllowed, urlAllowed } from "./sinks";
import { rowIndexLookup, type RenderAt, templateFunction } from "./templates";

export interface PropsBuild {
  readonly props: Record<string, unknown>;
  /** Elements a coercion adds before the document's children (a Select's options). */
  readonly leading: readonly ReactNode[];
  /** The node cannot render yet: a form it names has not mounted. */
  readonly waiting: boolean;
  /** The node cannot render at all: shown in its place. */
  readonly failure: Issue | undefined;
}

type Nested = ReadonlyMap<string, readonly ParsedPropPath[]>;

/** A contract's prop paths split into top-level names and deeper paths, by top-level prop. */
interface Facts {
  readonly droppedNested: Nested;
  readonly urls: ReadonlySet<string>;
  readonly urlsNested: Nested;
  readonly images: ReadonlySet<string>;
  readonly imagesNested: Nested;
  readonly dates: ReadonlyMap<string, DateKind>;
  readonly datesNested: ReadonlyMap<string, readonly { readonly path: ParsedPropPath; readonly kind: DateKind }[]>;
  readonly sets: ReadonlySet<string>;
  readonly setsNested: Nested;
  readonly icons: ReadonlySet<string>;
  readonly formats: ReadonlySet<string>;
  readonly templates: ReadonlyMap<string, readonly string[]>;
  readonly forms: ReadonlySet<string>;
  readonly namespaced: ReadonlySet<string>;
  readonly nameRole: NameRole;
}

function split(paths: readonly PropPath[] | undefined): [Set<string>, Map<string, ParsedPropPath[]>] {
  const top = new Set<string>();
  const nested = new Map<string, ParsedPropPath[]>();
  for (const path of paths ?? []) {
    const parsed = parsePropPath(path);
    if (parsed.steps.length === 0) top.add(parsed.prop);
    else nested.set(parsed.prop, [...(nested.get(parsed.prop) ?? []), parsed]);
  }
  return [top, nested];
}

const factsCache = new WeakMap<ComponentContract, Facts>();

function factsOf(contract: ComponentContract): Facts {
  const cached = factsCache.get(contract);
  if (cached !== undefined) return cached;
  const [, droppedNested] = split(contract.droppedProps);
  const [urls, urlsNested] = split(contract.urlProps);
  const [images, imagesNested] = split(contract.imageProps);
  const [sets, setsNested] = split(contract.setProps);
  const dates = new Map<string, DateKind>();
  const datesNested = new Map<string, { path: ParsedPropPath; kind: DateKind }[]>();
  for (const [path, kind] of Object.entries(contract.dateProps ?? {})) {
    const parsed = parsePropPath(path);
    if (parsed.steps.length === 0) dates.set(parsed.prop, kind);
    else datesNested.set(parsed.prop, [...(datesNested.get(parsed.prop) ?? []), { path: parsed, kind }]);
  }
  const templates = new Map<string, readonly string[]>();
  for (const [path, names] of Object.entries(contract.templateProps ?? {})) {
    if (parsePropPath(path).steps.length === 0) templates.set(path, names);
  }
  const facts: Facts = {
    droppedNested,
    urls,
    urlsNested,
    images,
    imagesNested,
    dates,
    datesNested,
    sets,
    setsNested,
    icons: new Set(contract.iconProps ?? []),
    formats: new Set(contract.formatProps ?? []),
    templates,
    forms: new Set(contract.formProps ?? []),
    namespaced: new Set(contract.namespacedProps ?? []),
    nameRole: nameRole(contract),
  };
  factsCache.set(contract, facts);
  return facts;
}

const DROP_MESSAGES: { readonly [R in DropReason]: (name: string, key: string) => string } = {
  forbidden: (_, key) => `\`${key}\` is never passed to a component.`,
  "dom-name": (name) => `${name}'s \`name\` is a DOM name: documents write none (a Field names its control).`,
  "id-reference": (_, key) => `\`${key}\` is the renderer's: documents write no DOM ids.`,
  dropped: (name, key) => `${name} takes no \`${key}\` from a document.`,
  "dialog-open": () => "The renderer owns `open`; seed it with `defaultOpen`.",
};

const UNIVERSAL_URLS: ReadonlySet<string> = new Set<string>(URL_PROPS);
const UNIVERSAL_IMAGES: ReadonlySet<string> = new Set<string>(IMAGE_URL_PROPS);

function own<T>(record: { readonly [key: string]: T } | undefined, key: string): T | undefined {
  return record !== undefined && Object.hasOwn(record, key) ? record[key] : undefined;
}

/** The icon `name` names in the view's set, or a missing-icon diagnostic in its place. */
export function iconElement(scope: Scope, name: string, path: string): ReactNode {
  const icons = scope.ctx.icons;
  const Glyph = icons !== undefined && Object.hasOwn(icons, name) ? icons[name] : undefined;
  if (Glyph !== undefined) return createElement(Glyph, { "aria-hidden": true });
  const issue = makeIssue("unknown-icon", path, `No icon is named "${name}".`);
  scope.ctx.report(issue, { inPlace: true });
  return diagnosticElement({ ...issue, message: "" }, undefined, DIAGNOSTIC_CLASSES.missingIcon);
}

export function buildProps(
  name: string,
  contract: ComponentContract,
  rawProps: unknown,
  scope: Scope,
  render: RenderAt,
): PropsBuild {
  const facts = factsOf(contract);
  const resolver = new PropResolver(scope, render);
  const { ctx, env } = scope;
  const propsPath = appendPointer(scope.path, "props");
  const props: Record<string, unknown> = {};
  let leading: ReactNode[] = [];
  let waiting = false;
  let failure: Issue | undefined;
  let dialogId: unknown;

  const source = isPlainObject(rawProps) ? rawProps : {};
  if (rawProps !== undefined && !isPlainObject(rawProps)) {
    resolver.drop("invalid-type", propsPath, "`props` is an object.");
  }
  const getRows = () => props.rows;

  /**
   * A refused image: `src` becomes `""`, the library's "nothing to load" (an
   * Image shows its error fallback and requests nothing; `null` would read as
   * an address still on its way); any other image prop is dropped.
   */
  const refuseImage = (key: string, path: string, url: string): unknown => {
    const dropped = resolver.drop("refused-url", path, `The host's image policy refuses "${url}".`);
    return key === "src" ? "" : dropped;
  };

  /** One top-level prop: the value to set, or DROP. */
  const judge = (key: string, raw: unknown, path: string): unknown => {
    const lower = lowerCaseProp(key);
    const dropped = dropReason(contract, key);
    if (dropped !== undefined) return resolver.drop("forbidden-prop", path, DROP_MESSAGES[dropped](name, key));
    if (contract.dialog === true && key === "dialogId") {
      dialogId = raw;
      return DROP;
    }
    if (HANDLER_KEY_PATTERN.test(key)) {
      if (isHandler(raw)) return handlerCallback(raw, scope, path, own(contract.eventValue, key));
      return resolver.drop("forbidden-prop", path, `\`${key}\` holds no action, so it is dropped.`);
    }

    const coercion = own(contract.coercions, key);
    if (coercion?.kind === "columns") {
      return coerceColumns(resolver, raw, path, {
        cellNames: own(contract.templateProps, `${key}[].cell`),
        rowIndex: rowIndexLookup(getRows),
      });
    }
    const templateNames = facts.templates.get(key);
    if (templateNames !== undefined) {
      if (!isNodeMarker(raw)) return resolver.drop("invalid-prop-value", path, `\`${key}\` is a row template: { "$node": … }.`);
      return templateFunction(raw.$node, templateNames, scope, path, render, { rowIndex: rowIndexLookup(getRows) });
    }

    let value = resolver.resolve(raw, path);
    if (value === undefined) return DROP;

    if (lower.startsWith("data-")) {
      if (!isAllowedDataAttribute(key)) return resolver.drop("forbidden-prop", path, `\`${key}\` is not an attribute a document may set.`);
      if (isAllowedDataValue(key, value)) return value;
      const options = own(CONSTRAINED_DATA_ATTRIBUTES, key);
      return resolver.drop("invalid-prop-value", path, `\`${key}\` takes ${options === undefined ? "text, a number or a boolean" : options.join(" or ")}.`);
    }
    if (key === "name" && facts.nameRole === "field" && !isName(value)) {
      return resolver.drop("invalid-prop-value", path, "`name` is a field name: letters, digits and _, not starting with a digit.");
    }

    if (typeof value === "string") {
      if ((UNIVERSAL_URLS.has(lower) || facts.urls.has(key)) && !urlAllowed(value)) {
        return resolver.drop("refused-url", path, `"${value}" is not a URL a document may use.`);
      }
      if (lower === "srcset" ? !srcSetAllowed(value, ctx.adapters) : (UNIVERSAL_IMAGES.has(lower) || facts.images.has(key)) && !imageAllowed(value, ctx.adapters)) {
        return refuseImage(key, path, value);
      }
    }
    const elements = own(contract.elementProps, key);
    if (elements !== undefined && (typeof value !== "string" || !elements.includes(value))) {
      return resolver.drop("invalid-prop-value", path, `\`${key}\` is one of ${elements.join(", ")}.`);
    }
    const levels = own(contract.headingLevelProps, key);
    if (levels !== undefined && (typeof value !== "number" || !levels.includes(value))) {
      return resolver.drop("invalid-prop-value", path, `\`${key}\` is one of ${levels.join(", ")}.`);
    }
    const refKinds = refPropKinds(contract, key);
    if (refKinds !== undefined && !refKinds.includes(typeof value)) {
      return resolver.drop("invalid-prop-value", path, `\`${key}\` takes ${refKinds.length === 0 ? "nothing a document can write" : refKinds.join(" or ")}: a ref cannot come from a document.`);
    }
    const intl = own(contract.intlProps, key);
    if (intl !== undefined && !intlValueAllowed(value, intl)) {
      return resolver.drop("invalid-prop-value", path, `\`${key}\` is not a ${intl === "currency" ? "currency code (ISO 4217)" : "unit"} Intl knows.`);
    }

    if (coercion?.kind === "accessor") {
      const segments = fieldSegments(value);
      if (segments === null) return resolver.drop("invalid-prop-value", path, `\`${key}\` is a dot path into the row.`);
      props[coercion.to] = /Key$/.test(coercion.to)
        ? rowKeyAccessor(segments, getRows, (duplicate) =>
            resolver.drop("duplicate-key", path, `Two rows share the key ${JSON.stringify(duplicate)}; their positions are used instead.`),
          )
        : rowTextAccessor(segments);
      return DROP;
    }
    if (coercion?.kind === "delimiter") value = coerceDelimiter(value);
    if (coercion?.kind === "options") {
      const built = optionElements(value);
      if (built instanceof Refusal) return resolver.drop("invalid-prop-value", path, built.reason);
      if (built.skipped > 0) resolver.drop("invalid-prop-value", path, "Choices are { value, label } with text values; some were skipped.");
      leading = built.options;
      return DROP;
    }

    if (facts.forms.has(key)) {
      if (typeof value !== "string") return resolver.drop("invalid-prop-value", path, `\`${key}\` names a declared form.`);
      const handle = own(ctx.forms, value);
      if (handle !== undefined) return handle;
      if (env.formNames.has(value) || !ctx.streaming.complete) waiting = true;
      else failure = makeIssue("undeclared-name", path, `No form is named "${value}".`);
      return DROP;
    }
    if (facts.namespaced.has(key)) {
      if (typeof value !== "string") return resolver.drop("invalid-prop-value", path, `\`${key}\` is text.`);
      return `r-ui-renderer:${ctx.namespace}:${value}`;
    }
    if (facts.sets.has(key)) value = coerceSet(value);
    const dateKind = facts.dates.get(key);
    if (dateKind !== undefined) value = coerceDate(value, dateKind, false);
    if (facts.icons.has(key) && typeof value === "string") value = iconElement(scope, value, path);
    if (facts.formats.has(key)) {
      const options = toFormatOptions(value);
      if (options === null) return resolver.drop("invalid-prop-value", path, `\`${key}\` is a FormatSpec: a style, or { style, … }.`);
      if (!formatOptionsWork(options, env.locale)) resolver.drop("invalid-prop-value", path, `Intl refuses \`${key}\`'s options; numbers format plainly.`);
      value = createFormatter(options, env.locale);
    }
    if (value instanceof Refusal) return resolver.drop("invalid-prop-value", path, value.reason);
    return nested(key, value, path);
  };

  /** The contract's deeper paths under `key`: dropped members, URLs, images, dates, Sets. */
  const nested = (key: string, value: unknown, path: string): unknown => {
    let out = value;
    for (const parsed of facts.droppedNested.get(key) ?? []) {
      out = transformAt(out, parsed.steps, (_leaf, pointer) =>
        resolver.drop("forbidden-prop", path + pointer, `${name} takes no \`${parsed.prop}${pointer.replaceAll("/", ".")}\` from a document.`),
      );
    }
    for (const parsed of facts.urlsNested.get(key) ?? []) {
      out = transformAt(out, parsed.steps, (leaf, pointer) =>
        typeof leaf === "string" && !urlAllowed(leaf) ? resolver.drop("refused-url", path + pointer, `"${leaf}" is not a URL a document may use.`) : leaf,
      );
    }
    for (const parsed of facts.imagesNested.get(key) ?? []) {
      const last = parsed.steps.at(-1);
      const srcSet = last?.kind === "key" && lowerCaseProp(last.key) === "srcset";
      out = transformAt(out, parsed.steps, (leaf, pointer) => {
        if (typeof leaf !== "string") return leaf;
        const allowed = srcSet ? srcSetAllowed(leaf, ctx.adapters) : urlAllowed(leaf) && imageAllowed(leaf, ctx.adapters);
        return allowed || last?.kind !== "key" ? leaf : refuseImage(last.key, path + pointer, leaf);
      });
    }
    for (const { path: parsed, kind } of facts.datesNested.get(key) ?? []) {
      out = transformAt(out, parsed.steps, (leaf, pointer, inCollection) => {
        const date = coerceDate(leaf, kind, inCollection);
        return date instanceof Refusal ? resolver.drop("invalid-prop-value", path + pointer, date.reason) : date;
      });
    }
    for (const parsed of facts.setsNested.get(key) ?? []) {
      out = transformAt(out, parsed.steps, (leaf, pointer) => {
        const set = coerceSet(leaf);
        return set instanceof Refusal ? resolver.drop("invalid-prop-value", path + pointer, set.reason) : set;
      });
    }
    return out;
  };

  for (const key of Object.keys(source)) {
    const path = appendPointer(propsPath, key);
    const value = judge(key, source[key], path);
    if (value !== DROP) props[key] = value;
  }

  if (contract.dialog === true) {
    const id = typeof dialogId === "string" && dialogId.length > 0 ? dialogId : `#${scope.path}`;
    const seed = props.defaultOpen === true;
    delete props.defaultOpen;
    props.open = ctx.dialogs.isOpen(id, seed);
    const documentHandler = props.onOpenChange;
    props.onOpenChange = (open: boolean) => {
      ctx.dialogs.setOpen(id, open);
      if (typeof documentHandler === "function") return (documentHandler as (open: boolean) => unknown)(open);
      return undefined;
    };
  }
  for (const [prop, read] of Object.entries(own(HOST_PROPS, name) ?? {})) props[prop] = read(env);

  return { props, leading, waiting, failure };
}
