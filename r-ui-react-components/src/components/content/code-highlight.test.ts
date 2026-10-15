import type { LanguageFn } from "highlight.js";
import hljs from "highlight.js/lib/core";
import { beforeAll, describe, expect, it } from "vitest";

import {
  ALIASES,
  CODE_LANGUAGES,
  type CodeLanguage,
  type CodeRole,
  type CodeRun,
  EMBEDS,
  grammarsFor,
  highlighter as hl,
  loadHighlighter,
  MAX_HIGHLIGHT_LINE,
  normaliseCode,
  resolveCodeLanguage,
  toLines,
} from "./code-highlight";

beforeAll(async () => {
  const loaded = await Promise.all(CODE_LANGUAGES.map(loadHighlighter));
  // The live configuration, not the fallback: a loader that swallowed its own
  // failure would leave every block plain and every other test here vacuous.
  expect(loaded.every((h) => h === hl)).toBe(true);
});

const rolesOf = (lines: CodeRun[][] | null) => new Set(lines?.flat().flatMap((run) => (run.role ? [run.role] : [])));
const runOf = (lines: CodeRun[][] | null, text: string) => lines?.flat().find((run) => run.text === text);

/**
 * One snippet per curated grammar and a role it must produce. A grammar in
 * CODE_LANGUAGES without a row here fails, so the set and its proof cannot drift.
 */
const SNIPPETS: Record<(typeof CODE_LANGUAGES)[number], { code: string; token: string; role: CodeRole }> = {
  bash: { code: 'if [ -f "$FILE" ]; then echo ok; fi', token: "if", role: "keyword" },
  css: { code: ".card { color: red; padding: 4px; }", token: ".card", role: "type" },
  diff: { code: "--- a\n+++ b\n-old line\n+new line", token: "+new line", role: "addition" },
  go: { code: 'package main\nfunc main() { fmt.Println("hi") }', token: "func", role: "keyword" },
  javascript: { code: "const answer = 42; // the answer", token: "42", role: "number" },
  json: { code: '{ "name": "r-ui", "count": 3 }', token: '"name"', role: "property" },
  markdown: { code: "# Title\n\nSome *text*.", token: "# Title", role: "function" },
  python: { code: "def greet(name):\n    return f\"hi {name}\"", token: "greet", role: "function" },
  rust: { code: "fn main() { let x: u32 = 5; }", token: "u32", role: "type" },
  shell: { code: "$ npm install lowlight", token: "$ ", role: "keyword" },
  sql: { code: "SELECT id FROM users WHERE id = 1;", token: "SELECT", role: "keyword" },
  typescript: { code: "interface User { id: number }\nfunction load(): Promise<User> {}", token: "load", role: "function" },
  xml: { code: '<div class="x">hi</div>', token: "div", role: "keyword" },
  yaml: { code: "name: r-ui\nversion: 1", token: "name:", role: "property" },
};

describe("the curated grammar set", () => {
  it.each([...CODE_LANGUAGES])("%s is registered and colours its snippet", (language) => {
    const snippet = SNIPPETS[language];
    expect(snippet).toBeDefined();
    expect(hl.supports(language)).toBe(true);
    const lines = hl.highlight(snippet.code, language);
    expect(runOf(lines, snippet.token)?.role).toBe(snippet.role);
  });

  it("answers the aliases authors write", () => {
    for (const alias of ["ts", "tsx", "js", "jsx", "html", "svg", "sh", "zsh", "yml", "py", "rs", "md", "patch", "golang"]) {
      expect(hl.supports(alias), alias).toBe(true);
    }
  });

  it("refuses names outside the set, including object-prototype keys", () => {
    for (const name of ["__proto__", "constructor", "toString", "hasOwnProperty", "brainfuck", "php", ""]) {
      expect(hl.supports(name), name).toBe(false);
      expect(hl.highlight("x", name)).toBeNull();
    }
  });

  it("matches the language case-insensitively", () => {
    expect(rolesOf(hl.highlight("const a = 1", "TypeScript")).has("keyword")).toBe(true);
  });
});

/** Every `subLanguage` a grammar's mode tree names. */
function subLanguagesOf(name: string): Set<string> {
  const found = new Set<string>();
  const seen = new Set<object>();
  const walk = (mode: unknown) => {
    if (!mode || typeof mode !== "object" || seen.has(mode)) return;
    seen.add(mode);
    const { subLanguage } = mode as { subLanguage?: string | string[] };
    for (const sub of [subLanguage ?? []].flat()) found.add(sub);
    for (const value of Object.values(mode)) {
      if (Array.isArray(value)) value.forEach(walk);
      else walk(value);
    }
  };
  walk(hljs.getLanguage(name));
  found.delete(name);
  return found;
}

describe("the grammar tables match the grammars", () => {
  beforeAll(async () => {
    const grammars = await Promise.all(
      CODE_LANGUAGES.map(async (name) => [name, (await import(`highlight.js/lib/languages/${name}`)) as { default: LanguageFn }] as const),
    );
    for (const [name, mod] of grammars) hljs.registerLanguage(name, mod.default);
  });

  it("knows every alias each grammar declares, and no other", () => {
    const declared = Object.fromEntries(
      CODE_LANGUAGES.flatMap((name) => (hljs.getLanguage(name)?.aliases ?? []).map((alias) => [alias, name] as const)),
    );
    expect({ ...ALIASES }).toEqual(declared);
  });

  it("loads with each grammar the curated grammars it embeds", () => {
    for (const name of CODE_LANGUAGES) {
      const embedded = [...subLanguagesOf(name)].filter((sub): sub is CodeLanguage => resolveCodeLanguage(sub) === sub);
      expect([...(EMBEDS[name] ?? [])].sort(), name).toEqual(embedded.sort());
    }
  });

  it("closes the embeds transitively", () => {
    expect(grammarsFor("typescript").sort()).toEqual(["css", "javascript", "typescript", "xml"]);
    expect(grammarsFor("rust")).toEqual(["rust"]);
  });
});

describe("scopes to roles", () => {
  it("maps a function title, a class title and a keyword", () => {
    const lines = hl.highlight("class Store {}\nfunction save() {}", "javascript");
    expect(runOf(lines, "Store")?.role).toBe("type");
    expect(runOf(lines, "save")?.role).toBe("function");
    expect(runOf(lines, "class")?.role).toBe("keyword");
  });

  it("resets a substitution to body ink inside a string", () => {
    const lines = hl.highlight("const s = `a ${name} b`;", "javascript");
    expect(runOf(lines, "`a ")?.role).toBe("string");
    expect(runOf(lines, "${name}")?.role).toBeNull();
  });

  it("keeps the comment role across the lines one comment spans", () => {
    const lines = hl.highlight("/* one\ntwo */\nx", "javascript");
    expect(lines).toHaveLength(3);
    expect(lines?.[0]).toEqual([{ text: "/* one", role: "comment" }]);
    expect(lines?.[1]).toEqual([{ text: "two */", role: "comment" }]);
  });

  it("renders a scope with no mapping in body ink", () => {
    // `hljs-operator` and punctuation are deliberately plain.
    const roles = hl.highlight("a = b", "python")?.flat().map((run) => run.role);
    expect(roles?.every((role) => role === null)).toBe(true);
  });
});

describe("the budget", () => {
  it("highlights a line exactly at the cap and refuses one past it", () => {
    const at = `x = "${"a".repeat(MAX_HIGHLIGHT_LINE - 6)}"`;
    expect(at).toHaveLength(MAX_HIGHLIGHT_LINE);
    expect(hl.highlight(at, "python")).not.toBeNull();
    expect(hl.highlight(`${at}a`, "python")).toBeNull();
  });

  it("refuses a long-and-narrow source: one unbroken run, the pathological shape", () => {
    const start = performance.now();
    expect(hl.highlight("a".repeat(100_000), "typescript")).toBeNull();
    expect(performance.now() - start).toBeLessThan(200);
  });
});

describe("text handling", () => {
  it("normalises CRLF and CR and drops one trailing newline", () => {
    expect(normaliseCode("a\r\nb\rc\n")).toBe("a\nb\nc");
    expect(normaliseCode("a\n\n")).toBe("a\n");
  });

  it("splits plain text into lines, keeping empty ones", () => {
    expect(toLines([{ text: "a\n\nb", role: null }])).toEqual([[{ text: "a", role: null }], [], [{ text: "b", role: null }]]);
    expect(toLines([{ text: "", role: null }])).toEqual([[]]);
  });
});
