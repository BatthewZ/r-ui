"use client";

import type { LanguageFn } from "highlight.js";
import type { createLowlight } from "lowlight";
import { useCallback, useSyncExternalStore } from "react";

/**
 * Syntax highlighting for CodeBlock: lowlight's core, plus one grammar per
 * language, each loaded on first use.
 *
 * The first CodeBlock with a supported `language` fetches lowlight's core and
 * that language's grammar (`highlight.js/lib/languages/<name>`, its own chunk)
 * by dynamic `import()`; subscribing starts the fetch. A page with no code pays
 * nothing, a page of TypeScript pays for TypeScript, and fifty blocks pay once.
 * Until a grammar arrives, and for good if its chunk fails, the block renders
 * its plain text: one readable branch for every cause. A failed load is not
 * retried (a retry behind a render is a loop).
 *
 * lowlight hands back a TREE (hast), never an HTML string, so the code reaches
 * the DOM as React text nodes and nothing here injects markup.
 */

type Lowlight = ReturnType<typeof createLowlight>;
type HastRoot = ReturnType<Lowlight["highlight"]>;
type HastNode = HastRoot["children"][number];

/**
 * The curated grammar set: the languages a dashboard or marketing site built on
 * this library shows its users (API and SDK examples, config, CLI sessions,
 * queries, diffs). Each entry is a static `import()` so the bundler splits every
 * grammar into its own chunk; a computed specifier would pull in all of them.
 *
 * Rule for adding one: a product on this library needs to show it, its aliases
 * go in `ALIASES` and the grammars it embeds in `EMBEDS` (tests compare both
 * with the grammar itself), and it lands with a snippet in
 * `code-highlight.test.ts` that must produce a coloured role.
 */
const GRAMMARS = {
  bash: () => import("highlight.js/lib/languages/bash"),
  css: () => import("highlight.js/lib/languages/css"),
  diff: () => import("highlight.js/lib/languages/diff"),
  go: () => import("highlight.js/lib/languages/go"),
  javascript: () => import("highlight.js/lib/languages/javascript"),
  json: () => import("highlight.js/lib/languages/json"),
  markdown: () => import("highlight.js/lib/languages/markdown"),
  python: () => import("highlight.js/lib/languages/python"),
  rust: () => import("highlight.js/lib/languages/rust"),
  shell: () => import("highlight.js/lib/languages/shell"),
  sql: () => import("highlight.js/lib/languages/sql"),
  typescript: () => import("highlight.js/lib/languages/typescript"),
  xml: () => import("highlight.js/lib/languages/xml"),
  yaml: () => import("highlight.js/lib/languages/yaml"),
} satisfies Record<string, () => Promise<{ default: LanguageFn }>>;

export type CodeLanguage = keyof typeof GRAMMARS;

export const CODE_LANGUAGES = Object.keys(GRAMMARS) as readonly CodeLanguage[];

/**
 * Each grammar's own aliases, known before it loads (a block must know which
 * chunk to fetch). A test holds this to what the grammars declare.
 */
export const ALIASES: Readonly<Record<string, CodeLanguage>> = {
  sh: "bash",
  zsh: "bash",
  patch: "diff",
  golang: "go",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsonc: "json",
  json5: "json",
  md: "markdown",
  mkdown: "markdown",
  mkd: "markdown",
  py: "python",
  gyp: "python",
  ipython: "python",
  rs: "rust",
  console: "shell",
  shellsession: "shell",
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  html: "xml",
  xhtml: "xml",
  rss: "xml",
  atom: "xml",
  xjb: "xml",
  xsd: "xml",
  xsl: "xml",
  plist: "xml",
  wsf: "xml",
  svg: "xml",
  yml: "yaml",
};

/**
 * Curated grammars a grammar hands part of its text to (JSX and `html\``
 * templates are xml; a `<script>` is javascript; a shell session's commands are
 * bash). They load with it, so a block colours the same whatever else the page
 * happens to have loaded. A test holds this to the grammars' `subLanguage`s.
 */
export const EMBEDS: Readonly<Partial<Record<CodeLanguage, readonly CodeLanguage[]>>> = {
  javascript: ["css", "xml"],
  markdown: ["xml"],
  shell: ["bash"],
  typescript: ["css", "xml"],
  xml: ["css", "javascript"],
};

/** A grammar name or alias (untrusted, any case) to its curated grammar, or `null`. */
export function resolveCodeLanguage(language: string): CodeLanguage | null {
  const key = language.trim().toLowerCase();
  // Own-property lookups, so `__proto__` and `constructor` answer null.
  if (Object.hasOwn(GRAMMARS, key)) return key as CodeLanguage;
  return Object.hasOwn(ALIASES, key) ? (ALIASES[key] ?? null) : null;
}

/** The grammar and everything it embeds, transitively. */
export function grammarsFor(language: CodeLanguage): CodeLanguage[] {
  const out = new Set<CodeLanguage>([language]);
  for (const name of out) for (const embedded of EMBEDS[name] ?? []) out.add(embedded);
  return [...out];
}

/** What a highlighted run MEANS. `null` is body ink (plain code, punctuation, unmapped scopes). */
export type CodeRole =
  | "keyword"
  | "string"
  | "number"
  | "function"
  | "type"
  | "comment"
  | "property"
  | "addition"
  | "deletion"
  | "emphasis"
  | "strong";

export interface CodeRun {
  text: string;
  role: CodeRole | null;
}

/**
 * highlight.js scope -> role. A grammar names a sub-scope as a second class on
 * the same element (`hljs-title function_`), so the pair is checked first.
 * Scopes not listed render in body ink: highlight.js' vocabulary is documented
 * but open, and an unmapped scope reading as plain code is quiet, not broken.
 * `plain` resets to body ink inside a coloured parent (`${x}` in a string).
 */
function roleOfClasses(classes: readonly string[]): CodeRole | "plain" | undefined {
  const has = (c: string) => classes.includes(c);
  if (has("hljs-title") && has("class_")) return "type";
  if (has("hljs-title") && has("function_")) return "function";
  if (has("hljs-variable") && has("language_")) return "keyword";
  for (const c of classes) {
    const role = SCOPE_ROLES[c];
    if (role) return role;
  }
  return undefined;
}

const SCOPE_ROLES: Readonly<Record<string, CodeRole | "plain">> = {
  "hljs-comment": "comment",
  "hljs-quote": "comment",
  "hljs-keyword": "keyword",
  "hljs-selector-tag": "keyword",
  "hljs-doctag": "keyword",
  "hljs-meta": "keyword",
  "hljs-name": "keyword",
  "hljs-string": "string",
  "hljs-char": "string",
  "hljs-regexp": "string",
  "hljs-code": "string",
  "hljs-link": "string",
  "hljs-number": "number",
  "hljs-literal": "number",
  "hljs-symbol": "number",
  "hljs-bullet": "number",
  "hljs-title": "function",
  "hljs-section": "function",
  "hljs-built_in": "type",
  "hljs-type": "type",
  "hljs-class": "type",
  "hljs-selector-class": "type",
  "hljs-selector-id": "type",
  "hljs-template-tag": "type",
  "hljs-attr": "property",
  "hljs-attribute": "property",
  "hljs-property": "property",
  "hljs-params": "property",
  "hljs-variable": "property",
  "hljs-selector-attr": "property",
  "hljs-selector-pseudo": "property",
  "hljs-template-variable": "property",
  "hljs-addition": "addition",
  "hljs-deletion": "deletion",
  "hljs-emphasis": "emphasis",
  "hljs-strong": "strong",
  "hljs-subst": "plain",
  "hljs-punctuation": "plain",
  "hljs-operator": "plain",
  "hljs-tag": "plain",
};

/**
 * Above either budget the code renders plain. Highlighting is synchronous on
 * the main thread and several grammars are quadratic in the length of one
 * unbroken run (measured elsewhere on highlight.js: 8k characters on a line
 * 150ms, 32k 2.7s, 80k 17s), and a hang has no error boundary. The line cap is
 * what bounds the cost; the total is the belt. A minified bundle or a base64
 * blob reaches these lengths, so this is not only for hostile input.
 */
export const MAX_HIGHLIGHT_CHARS = 50_000;
export const MAX_HIGHLIGHT_LINE = 2_000;

/** CRLF/CR to LF, and one trailing newline dropped so it is not a phantom last line. */
export function normaliseCode(code: string): string {
  return code.replace(/\r\n?/g, "\n").replace(/\n$/, "");
}

function flatten(nodes: readonly HastNode[], role: CodeRole | null, into: CodeRun[]): void {
  for (const node of nodes) {
    if (node.type === "text") {
      if (node.value !== "") into.push({ text: node.value, role });
    } else if (node.type === "element") {
      const raw = node.properties.className;
      const classes = Array.isArray(raw) ? raw.map(String) : [];
      const own = roleOfClasses(classes);
      // Flattened: the innermost mapped scope wins, exactly what nested spans
      // would paint through inheritance, without nesting the DOM.
      flatten(node.children, own === undefined ? role : own === "plain" ? null : own, into);
    }
  }
}

/** Splits at newlines, which one scope may straddle (a block comment does). */
export function toLines(runs: readonly CodeRun[]): CodeRun[][] {
  const lines: CodeRun[][] = [[]];
  for (const run of runs) {
    run.text.split("\n").forEach((piece, index) => {
      if (index > 0) lines.push([]);
      if (piece !== "") lines[lines.length - 1]?.push({ text: piece, role: run.role });
    });
  }
  return lines;
}

const withinBudget = (code: string) =>
  code.length <= MAX_HIGHLIGHT_CHARS && !code.split("\n").some((line) => line.length > MAX_HIGHLIGHT_LINE);

/* ------------------------------------------------------------------ */
/*  The lazy loads, shared by every CodeBlock on the page              */
/* ------------------------------------------------------------------ */

type Status = "loading" | "ready" | "failed";
const statuses = new Map<CodeLanguage, Status>();
const loads = new Map<CodeLanguage, Promise<boolean>>();
const grammarLoads = new Map<CodeLanguage, Promise<LanguageFn>>();
let core: Promise<Lowlight> | null = null;
let lowlight: Lowlight | null = null;
const listeners = new Set<() => void>();

// Only `createLowlight` is destructured, so the bundler drops lowlight's
// `common` and `all` grammar sets from the chunk.
const loadCore = () => (core ??= import("lowlight").then(({ createLowlight }) => createLowlight()));
const loadGrammar = (name: CodeLanguage) => {
  let pending = grammarLoads.get(name);
  if (!pending) {
    pending = GRAMMARS[name]().then((mod) => mod.default);
    grammarLoads.set(name, pending);
  }
  return pending;
};

function load(name: CodeLanguage): Promise<boolean> {
  const existing = loads.get(name);
  if (existing) return existing;
  statuses.set(name, "loading");
  const [, ...embedded] = grammarsFor(name);
  const pending = Promise.all([loadCore(), loadGrammar(name), Promise.allSettled(embedded.map(loadGrammar))])
    .then(([instance, grammar, embeds]) => {
      const register = (lang: CodeLanguage, fn: LanguageFn) => {
        if (!instance.registered(lang)) instance.register(lang, fn);
      };
      // An embedded grammar that failed only leaves its part plain.
      embeds.forEach((result, index) => {
        const lang = embedded[index];
        if (result.status === "fulfilled" && lang) register(lang, result.value);
      });
      register(name, grammar);
      lowlight = instance;
      return true;
    })
    .catch(() => false)
    .then((ok) => {
      statuses.set(name, ok ? "ready" : "failed");
      for (const listener of listeners) listener();
      return ok;
    });
  loads.set(name, pending);
  return pending;
}

/** The highlighter a CodeBlock uses. */
export interface Highlighter {
  /** Whether `language` (a name or alias, untrusted) is in the curated set. */
  supports(language: string): boolean;
  /**
   * Lines of roled runs, or `null` while the language's grammar has not loaded,
   * when it failed, when the language is not supported or the code is over budget.
   */
  highlight(code: string, language: string): CodeRun[][] | null;
}

export const highlighter: Highlighter = {
  supports: (language) => resolveCodeLanguage(language) !== null,
  highlight(code, language) {
    const name = resolveCodeLanguage(language);
    if (!name || statuses.get(name) !== "ready" || !lowlight || !withinBudget(code)) return null;
    const runs: CodeRun[] = [];
    flatten(lowlight.highlight(name, code).children, null, runs);
    return toLines(runs);
  },
};

/**
 * Starts (once per grammar) and awaits the load for `language`. Resolves the
 * highlighter, or `null` when the language is not supported or its load failed.
 */
export async function loadHighlighter(language: string): Promise<Highlighter | null> {
  const name = resolveCodeLanguage(language);
  return name && (await load(name)) ? highlighter : null;
}

export type HighlightStatus = "pending" | "ready" | "off";

function statusOf(name: CodeLanguage | null): HighlightStatus {
  if (!name) return "off";
  const status = statuses.get(name);
  return status === "ready" ? "ready" : status === "failed" ? "off" : "pending";
}

/**
 * Whether `language`'s grammar is ready: `pending` until it loads, `off` for no
 * language, an unsupported one or a failed load. Subscribing starts the fetch.
 */
export function useHighlightStatus(language: string | undefined): HighlightStatus {
  const name = language === undefined ? null : resolveCodeLanguage(language);
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!name) return () => {};
      listeners.add(listener);
      void load(name);
      return () => {
        listeners.delete(listener);
      };
    },
    [name],
  );
  return useSyncExternalStore(
    subscribe,
    () => statusOf(name),
    () => (name ? "pending" : "off"),
  );
}
