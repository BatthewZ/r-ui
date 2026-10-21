/**
 * The README is a claim about this package, so it is checked like one. Every
 * named code block (a `ts`/`tsx` block whose first line is `// <path>`, a
 * `json` block whose info string is its path) is typechecked against the
 * package's source and run here; the unnamed snippets are typechecked; the
 * CLI transcript is replayed; each hardening row is provoked; and every
 * number the prose states is measured.
 */

import { readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { compileFunction } from "node:vm";

import * as library from "@batthewz/r-ui-react-components";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

import { queryDiagnostics, renderThrowing, stubPopover } from "../test-utils";
import * as cli from "./cli/main";
import * as iconsEntry from "./icons";
import * as root from "./index";
import * as referenceEntry from "./reference";
import * as specEntry from "./spec";

const PACKAGE = join(dirname(fileURLToPath(import.meta.url)), "..");
const README = readFileSync(join(PACKAGE, "README.md"), "utf8");
const manifest = JSON.parse(readFileSync(join(PACKAGE, "package.json"), "utf8")) as {
  version: string;
  engines: { node: string };
};

/* ---- the README's blocks ------------------------------------------------ */

interface Block {
  readonly lang: string;
  /** Its file path, for a named block. */
  readonly path?: string;
  readonly code: string;
}

function readBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const match of markdown.matchAll(/^```(\w+)([^\n]*)\n([\s\S]*?)^```$/gm)) {
    const [, lang = "", info = "", code = ""] = match;
    const named = /^\/\/ (\S+\.(?:tsx?|json))\n/.exec(code);
    const path = lang === "json" ? info.trim() || undefined : named?.[1];
    blocks.push({ lang, path, code });
  }
  return blocks;
}

const BLOCKS = readBlocks(README);
/** Virtual files: each named block, at its path under this folder. */
const ROOT = join(PACKAGE, "readme-blocks");
const FILES = new Map(BLOCKS.flatMap((block) => (block.path === undefined ? [] : [[join(ROOT, block.path), block.code] as const])));
const SNIPPETS = BLOCKS.filter((block) => block.path === undefined && (block.lang === "ts" || block.lang === "tsx"));

function named(path: string): string {
  const code = FILES.get(join(ROOT, path));
  if (code === undefined) throw new Error(`The README has no block named ${path}.`);
  return code;
}

/** What an unnamed snippet may use without importing it. */
const SNIPPET_PRELUDE = `
import { ViewRenderer, type ViewSpec } from "@batthewz/r-ui-renderer";
import { icons } from "@batthewz/r-ui-renderer/icons";
import { renderViewSpecReference } from "@batthewz/r-ui-renderer/reference";
import { validateViewSpec } from "@batthewz/r-ui-renderer/spec";
import { contracts } from "../shared/contracts";
import { registry } from "../src/registry";
declare const spec: ViewSpec;
declare const text: string;
declare function log(value: unknown): void;
`;

/* ---- running a named block ---------------------------------------------- */

const PACKAGES: { readonly [specifier: string]: unknown } = {
  "@batthewz/r-ui-renderer": root,
  "@batthewz/r-ui-renderer/spec": specEntry,
  "@batthewz/r-ui-renderer/icons": iconsEntry,
  "@batthewz/r-ui-renderer/reference": referenceEntry,
  "@batthewz/r-ui-react-components": library,
  react: React,
  "react/jsx-runtime": jsxRuntime,
};

const loaded = new Map<string, unknown>();

function resolveVirtual(from: string, specifier: string): string {
  const base = normalize(join(dirname(from), specifier));
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`]) if (FILES.has(candidate)) return candidate;
  throw new Error(`${from} imports ${specifier}, which no README block provides.`);
}

/** A named block's exports, run as a CommonJS module against this package's source. */
function load(path: string): Record<string, unknown> {
  const cached = loaded.get(path);
  if (cached !== undefined) return cached as Record<string, unknown>;
  const source = FILES.get(path);
  if (source === undefined) throw new Error(`No README block at ${path}.`);
  if (path.endsWith(".json")) {
    const value = JSON.parse(source) as Record<string, unknown>;
    loaded.set(path, value);
    return value;
  }
  const { outputText } = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const module = { exports: {} as Record<string, unknown> };
  loaded.set(path, module.exports);
  const require = (specifier: string): unknown => {
    if (specifier.startsWith(".")) return load(resolveVirtual(path, specifier));
    if (!Object.hasOwn(PACKAGES, specifier)) throw new Error(`${path} imports ${specifier}, which this test does not provide.`);
    return PACKAGES[specifier];
  };
  compileFunction(outputText, ["require", "module", "exports"], { filename: path })(require, module, module.exports);
  return module.exports;
}

function exported<T>(path: string, name: string): T {
  const value = load(join(ROOT, path))[name];
  if (value === undefined) throw new Error(`${path} exports no ${name}.`);
  return value as T;
}

/* ---- the numbers in the prose ------------------------------------------- */

function stated(pattern: RegExp): number {
  const match = pattern.exec(README);
  if (match?.[1] === undefined) throw new Error(`The README no longer says ${String(pattern)}.`);
  return Number(match[1]);
}

const bytes = (text: string) => new TextEncoder().encode(text).length;
const QUICKSTART_PATH = "src/service-health.json";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("README code blocks", () => {
  it("names the blocks this test runs, and nothing else under those names", () => {
    expect([...FILES.keys()].map((file) => file.slice(ROOT.length + 1)).sort()).toEqual([
      "server/check.ts",
      "server/generate-view.ts",
      "server/prompt.ts",
      "server/validate.ts",
      "shared/contracts.ts",
      "src/GeneratedView.tsx",
      "src/HostedView.tsx",
      "src/ServiceHealth.tsx",
      "src/StreamedAnswer.tsx",
      "src/registry.tsx",
      "src/service-health.json",
      "vite.config.ts",
    ]);
    expect(SNIPPETS.length).toBeGreaterThan(0);
  });

  it(
    "typecheck against the package source, snippets included",
    () => {
      const snippetFiles = SNIPPETS.map(
        (block, index) => [join(ROOT, "snippets", `${index}.tsx`), `${SNIPPET_PRELUDE}\nexport function snippet(): void {\n${block.code}\n}\n`] as const,
      );
      const virtual = new Map([...FILES, ...snippetFiles]);
      const config = ts.getParsedCommandLineOfConfigFile(join(PACKAGE, "tsconfig.json"), {}, {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
          throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
        },
      });
      if (config === undefined) throw new Error("tsconfig.json did not parse.");
      const options: ts.CompilerOptions = {
        ...config.options,
        baseUrl: PACKAGE,
        paths: { "@batthewz/r-ui-renderer": ["src/index.ts"], "@batthewz/r-ui-renderer/*": ["src/*/index.ts"] },
      };
      const host = ts.createCompilerHost(options);
      const getSourceFile = host.getSourceFile.bind(host);
      const fileExists = host.fileExists.bind(host);
      const readFile = host.readFile.bind(host);
      const directoryExists = host.directoryExists?.bind(host);
      host.directoryExists = (directory) =>
        [...virtual.keys()].some((file) => file.startsWith(`${normalize(directory)}/`)) || (directoryExists?.(directory) ?? true);
      host.fileExists = (file) => virtual.has(normalize(file)) || fileExists(file);
      host.readFile = (file) => virtual.get(normalize(file)) ?? readFile(file);
      host.getSourceFile = (file, language, onError, create) => {
        const code = virtual.get(normalize(file));
        return code === undefined ? getSourceFile(file, language, onError, create) : ts.createSourceFile(file, code, language);
      };
      const rootNames = [...virtual.keys()].filter((file) => !file.endsWith(".json"));
      const program = ts.createProgram({ rootNames, options, host });
      const errors = ts
        .getPreEmitDiagnostics(program)
        .filter((diagnostic) => diagnostic.file !== undefined && virtual.has(normalize(diagnostic.file.fileName)))
        .map((diagnostic) => {
          const file = diagnostic.file as ts.SourceFile;
          const { line } = file.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
          return `${file.fileName.slice(ROOT.length + 1)}:${line + 1} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`;
        });
      expect(rootNames.length).toBe(FILES.size - 1 + SNIPPETS.length);
      expect(errors).toEqual([]);
    },
    120_000,
  );
});

describe("Render your first document", () => {
  it("the quickstart document validates with no issue at all", () => {
    expect(specEntry.validateViewSpec(named(QUICKSTART_PATH))).toEqual({
      ok: true,
      spec: JSON.parse(named(QUICKSTART_PATH)),
      issues: [],
    });
  });

  it("the host renders what the README says you should see, with no diagnostic", () => {
    const ServiceHealth = exported<React.ComponentType>("src/ServiceHealth.tsx", "ServiceHealth");
    render(<ServiceHealth />);
    expect(screen.getByRole("heading", { level: 1, name: "Service health" })).toBeInTheDocument();
    expect(README).toContain("uptime (99.93%)");
    expect(screen.getByText("99.93%")).toBeInTheDocument();
    expect(screen.getByText("Open incidents")).toBeInTheDocument();
    expect(screen.getByText("Public API")).toBeInTheDocument();
    expect(screen.getByText("Degraded")).toBeInTheDocument();
    expect(queryDiagnostics()).toEqual([]);
  });
});

describe("Streaming", () => {
  it("text: a prefix shows what has closed, the whole text shows the rest", async () => {
    const StreamedAnswer = exported<React.ComponentType<{ text: string; done: boolean }>>("src/StreamedAnswer.tsx", "StreamedAnswer");
    const text = named(QUICKSTART_PATH);
    const cut = text.indexOf('"component": "DescriptionList"');
    expect(cut).toBeGreaterThan(0);
    const { rerender } = render(<StreamedAnswer text={text.slice(0, cut)} done={false} />);
    expect(await screen.findByText("99.93%")).toBeInTheDocument();
    expect(screen.queryByText("Public API")).toBeNull();
    rerender(<StreamedAnswer text={text} done />);
    expect(await screen.findByText("Public API")).toBeInTheDocument();
    expect(queryDiagnostics()).toEqual([]);
  });

  it("a stream: a Response read in chunks renders the whole document", async () => {
    const GeneratedView = exported<React.ComponentType<{ response: Response }>>("src/GeneratedView.tsx", "GeneratedView");
    const text = named(QUICKSTART_PATH);
    const chunks: string[] = [];
    for (let at = 0; at < text.length; at += 64) chunks.push(text.slice(at, at + 64));
    expect(chunks.length).toBeGreaterThan(10);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      },
    });
    const response = new Response(body);
    render(<GeneratedView response={response} />);
    expect(await screen.findByText("Degraded")).toBeInTheDocument();
    expect(screen.getByText("99.93%")).toBeInTheDocument();
    expect(queryDiagnostics()).toEqual([]);
  });
});

describe("Validate on a server", () => {
  const BROKEN = '{"version":2,"root":{"component":"Stak","children":["Hi"]}}';

  it("check returns the document when it conforms, and nothing when it does not", () => {
    const check = exported<(text: string) => unknown>("server/check.ts", "check");
    expect(check(named(QUICKSTART_PATH))).toEqual(JSON.parse(named(QUICKSTART_PATH)));
    expect(check(BROKEN)).toBeUndefined();
  });

  it("generateView feeds the issues back and returns the next attempt that validates", async () => {
    type Turn = { role: string; content: string };
    const generateView = exported<(model: (turns: readonly Turn[]) => Promise<string>, request: string) => Promise<unknown>>(
      "server/generate-view.ts",
      "generateView",
    );
    const seen: Turn[][] = [];
    const answers = [BROKEN, named(QUICKSTART_PATH)];
    const model = vi.fn(async (turns: readonly Turn[]) => {
      seen.push([...turns]);
      return answers[seen.length - 1] as string;
    });
    expect(await generateView(model, "Show service health")).toEqual(JSON.parse(named(QUICKSTART_PATH)));
    expect(model).toHaveBeenCalledTimes(2);
    const retry = seen[1] as Turn[];
    expect(retry.map((turn) => turn.role)).toEqual(["user", "assistant", "user"]);
    expect(retry[1]?.content).toBe(BROKEN);
    expect(retry[2]?.content.split("\n")).toEqual([
      "The document is not valid: 1 error, 1 warning. Fix each one and send the whole document again.",
      "(document) error missing-key: Missing `title`.",
      '/root/component warning unknown-component: No component is registered as `Stak`. Use "Stack".',
    ]);
  });

  it("generateView gives up after its attempts", async () => {
    const generateView = exported<(model: () => Promise<string>, request: string, attempts?: number) => Promise<unknown>>(
      "server/generate-view.ts",
      "generateView",
    );
    const model = vi.fn(async () => BROKEN);
    await expect(generateView(model, "Show service health", 2)).rejects.toThrow("No valid view after 2 attempts.");
    expect(model).toHaveBeenCalledTimes(2);
  });

  it("the handler answers as the README says, with the size limit it states", async () => {
    const validate = exported<(request: Request) => Promise<Response>>("server/validate.ts", "validate");
    const post = (body: string) => validate(new Request("https://app.example.com/validate", { method: "POST", body }));

    const valid = await post(named(QUICKSTART_PATH));
    expect(valid.status).toBe(200);
    expect(await valid.json()).toEqual({ ok: true, issues: [], feedback: "The document is valid: no issues." });

    const invalid = await post(BROKEN);
    expect(invalid.status).toBe(200);
    const body = (await invalid.json()) as { ok: boolean; issues: unknown[]; feedback: string };
    expect(body.ok).toBe(false);
    expect(body.issues).toHaveLength(2);
    expect(body.feedback.startsWith("The document is not valid: 1 error")).toBe(true);

    expect((await validate(new Request("https://app.example.com/validate"))).status).toBe(405);

    const limit = stated(/(\d+) MiB by default/) * 1024 * 1024;
    expect((await post(" ".repeat(limit + 1))).status).toBe(413);
    expect((await post(" ".repeat(limit))).status).toBe(200);
  });
});

describe("The command line", () => {
  function run(argv: readonly string[]) {
    let stdout = "";
    let stderr = "";
    const io: cli.CliIO = {
      stdout: (text) => {
        stdout += text;
      },
      stderr: (text) => {
        stderr += text;
      },
      readFile: async () => named(QUICKSTART_PATH),
      readStdin: async () => named(QUICKSTART_PATH),
      stdinIsTTY: false,
    };
    return cli.main(argv, io).then((code) => ({ code, stdout, stderr }));
  }

  it("the transcript is what r-ui-validate prints, and it exits 1", async () => {
    const block = BLOCKS.find((candidate) => candidate.lang === "console");
    if (block === undefined) throw new Error("The README has no console transcript.");
    const [command = "", ...output] = block.code.split("\n");
    const raw = /^\$ npx r-ui-validate --raw '([^']*)'$/.exec(command)?.[1];
    if (raw === undefined) throw new Error(`Unexpected transcript command: ${command}`);
    expect(output.length).toBeGreaterThan(1);
    expect(await run(["--raw", raw])).toEqual({ code: 1, stdout: output.join("\n"), stderr: "" });
  });

  it("every command in the usage block parses", () => {
    const block = BLOCKS.find((candidate) => candidate.lang === "sh" && candidate.code.includes("r-ui-validate"));
    if (block === undefined) throw new Error("The README has no r-ui-validate usage block.");
    const commands = block.code
      .split("\n")
      .map((line) => /npx r-ui-validate([^#]*)/.exec(line)?.[1]?.trim())
      .filter((args): args is string => args !== undefined);
    expect(commands.length).toBeGreaterThan(2);
    for (const args of commands) expect(() => cli.parseArgs(args.split(/\s+/)), args).not.toThrow();
  });

  it("the exit table is the CLI's", async () => {
    const exits = [...README.matchAll(/^\| (\d) \| /gm)].map((match) => Number(match[1]));
    expect(exits).toEqual([0, 1, 2, 3]);
    expect((await run(["-"])).code).toBe(0);
    expect((await run(["--raw", '{"version":2}'])).code).toBe(1);
    expect((await run(["--bogus"])).code).toBe(2);
    expect(cli.USAGE).toContain("3 internal error");
  });

  it("states the Node version the package declares", () => {
    expect(manifest.engines.node).toBe(`>=${stated(/Node (\d+) or later/)}`);
  });
});

describe("Prompt a model with the reference", () => {
  it("the sizes in the prose are measured (within 10%)", () => {
    const scoped = exported<string>("server/prompt.ts", "reference");
    const full = referenceEntry.renderViewSpecReference();
    expect(full).toBe(readFileSync(join(PACKAGE, "VIEWSPEC.md"), "utf8"));
    const near = (kb: number, measured: number) => Math.abs(kb * 1000 - measured) <= measured * 0.1;
    expect(near(stated(/whole reference is about (\d+) KB/), bytes(full)), `full: ${bytes(full)} bytes`).toBe(true);
    expect(near(stated(/scope above is about (\d+) KB/), bytes(scoped)), `scoped: ${bytes(scoped)} bytes`).toBe(true);
    expect(bytes(scoped)).toBeLessThan(bytes(full));
  });
});

describe("Adapters", () => {
  it("the host's fetch, navigate and toast serve the document", async () => {
    const popover = stubPopover();
    try {
      const fetchStub = vi.fn(async () => Response.json({ name: "Ada" }));
      vi.stubGlobal("fetch", fetchStub);
      const go = vi.fn();
      const HostedView = exported<React.ComponentType<{ spec: root.ViewSpec; go: (to: string) => void }>>("src/HostedView.tsx", "HostedView");
      const spec: root.ViewSpec = {
        version: 2,
        title: "Hosted",
        data: { me: { type: "api", endpoint: "/api/me" } },
        root: {
          component: "Stack",
          children: [
            { component: "Text", children: [{ $ref: "data.me.name" }] },
            { component: "Button", props: { onClick: { action: "navigate", payload: { to: "/services" } } }, children: ["Open"] },
            { component: "Button", props: { onClick: { action: "showToast", payload: { title: "Saved" } } }, children: ["Save"] },
          ],
        },
      };
      render(
        <library.ToastProvider>
          <HostedView spec={spec} go={go} />
        </library.ToastProvider>,
      );
      expect(await screen.findByText("Ada")).toBeInTheDocument();
      expect(fetchStub).toHaveBeenCalledTimes(1);
      expect(fetchStub).toHaveBeenCalledWith(expect.stringMatching(/\/api\/me$/), expect.objectContaining({ credentials: "same-origin" }));
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Open" }));
      expect(go).toHaveBeenCalledTimes(1);
      expect(go).toHaveBeenCalledWith("/services");
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(await screen.findByText("Saved")).toBeInTheDocument();
      expect(queryDiagnostics()).toEqual([]);
    } finally {
      popover.restore();
    }
  });
});

describe("Custom components", () => {
  const REGION = (region: string): root.ViewSpec => ({
    version: 2,
    title: "Regions",
    root: { component: "RegionMap", props: { region } },
  });

  it("the registry renders it and the contracts make the validator know it", () => {
    const contracts = exported<root.ComponentContracts>("shared/contracts.ts", "contracts");
    const registry = exported<root.ComponentRegistry>("src/registry.tsx", "registry");
    render(<root.ViewRenderer spec={REGION("eu")} registry={registry} contracts={contracts} />);
    expect(screen.getByText("Data centres in eu")).toBeInTheDocument();
    expect(queryDiagnostics()).toEqual([]);

    expect(specEntry.validateViewSpec(REGION("eu"), { contracts }).issues).toEqual([]);
    const codes = (spec: root.ViewSpec, options?: specEntry.ValidateOptions) =>
      specEntry.validateViewSpec(spec, options).issues.map((issue) => issue.code);
    expect(codes(REGION("mars"), { contracts })).toEqual(["invalid-prop-value"]);
    expect(codes(REGION("eu"))).toEqual(["unknown-component"]);
    expect(codes(REGION("eu"), { components: ["RegionMap"] })).toEqual([]);
    expect(referenceEntry.renderViewSpecReference({ contracts, include: ["Stack", "RegionMap"] })).toContain("`RegionMap`");
  });
});

describe("Hardening", () => {
  const ORIGIN = { origin: "https://app.example.com" };
  const doc = (root: unknown, top: object = {}): unknown => ({ version: 2, title: "Hostile", ...top, root });
  const validated = (...inputs: unknown[]) => inputs.map((input) => specEntry.validateViewSpec(input, ORIGIN).issues.map((issue) => issue.code));

  /** Renders `props` and returns the issue codes the view reported. */
  async function rendered(props: root.ViewRendererProps, throwing = false): Promise<string[]> {
    const codes: string[] = [];
    const ui = <root.ViewRenderer {...props} onIssue={(issue) => codes.push(issue.code)} />;
    if (throwing) renderThrowing(ui);
    else render(ui);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    return codes;
  }

  let deep: unknown = "leaf";
  for (let level = 0; level < stated(/nests nodes past (\d+) deep/) + 5; level += 1) deep = { component: "Stack", children: [deep] };
  let chain: unknown = { action: "showToast", payload: { title: "Done" } };
  for (let level = 0; level < stated(/chains handlers past (\d+)/) + 2; level += 1) {
    chain = { action: "apiCall", payload: { endpoint: "/api/next", onSuccess: chain } };
  }

  function Boom(): never {
    throw new Error("boom");
  }

  /** One probe per row, keyed by a phrase of the row's first cell: each returns the codes per hostile input. */
  const PROBES: { readonly [phrase: string]: () => Promise<string[][]> | string[][] } = {
    "`javascript:`": () =>
      validated(
        doc({ component: "Link", props: { href: "JavaScript:alert(1)" }, children: ["x"] }),
        doc({ component: "Link", props: { href: "vbscript:msgbox" }, children: ["x"] }),
        doc({ component: "Link", props: { href: "data:text/html,<script>alert(1)</script>" }, children: ["x"] }),
        doc({ component: "Link", props: { href: { $concat: ["java", "script:alert(1)"] } }, children: ["x"] }),
      ),
    "another origin": () =>
      validated(
        doc({ component: "Card" }, { data: { leak: { type: "api", endpoint: "https://evil.example/collect" } } }),
        doc({ component: "Image", props: { src: "https://tracker.example/pixel.gif", alt: "" } }),
      ),
    "no `fetch`": async () => [
      await rendered({ spec: doc({ component: "Card" }, { data: { me: { type: "api", endpoint: "/api/me" } } }) as root.ViewSpec }),
    ],
    "`dangerouslySetInnerHTML`": () =>
      validated(
        doc({ component: "Card", props: { dangerouslySetInnerHTML: { __html: "<img src=x onerror=alert(1)>" } } }),
        doc({ component: "Card", props: { Style: { color: "red" } } }),
        doc({ component: "Button", props: { onClick: "alert(1)" }, children: ["b"] }),
      ),
    "`__proto__`": () =>
      validated(
        '{"version":2,"title":"T","root":{"component":"Card","props":{"__proto__":{"x":1}}}}',
        doc({ component: "Text", children: [{ $ref: "state.__proto__.polluted" }] }),
        doc({ $each: "state.rows", as: "constructor", node: "x" }, { state: { rows: [] } }),
      ),
    "DOM `id`": () =>
      validated(
        doc({ component: "Input", props: { id: "email" } }),
        doc({ component: "Card", props: { "aria-labelledby": "email" } }),
        doc({ component: "Input", props: { name: "email" } }),
      ),
    "sets a theme": () => validated(doc({ component: "Card" }, { theme: "aurora" }), doc({ component: "Card", props: { "data-theme": "aurora" } })),
    "chooses an element": () =>
      validated(doc({ component: "Stack", props: { as: "script" } }), doc({ component: "Heading", props: { level: 9 }, children: ["h"] })),
    "`PasswordInput`": () => validated(doc({ component: "PasswordInput" }), doc({ component: "OTPInput" })),
    "nests nodes": () => validated(doc(deep), doc({ component: "Button", props: { onClick: chain }, children: ["b"] })),
    "does not exist": async () => [
      ...validated(doc({ component: "Stak" })),
      await rendered(
        { spec: doc({ component: "Boom" }) as root.ViewSpec, registry: root.extendRegistry(root.defaultRegistry, { Boom }) },
        true,
      ),
    ],
    "malformed": async () => {
      const text = named(QUICKSTART_PATH);
      return [...validated('{"version": 2, "title": '), await rendered({ text: text.slice(0, text.length / 2), complete: true })];
    },
  };

  const rows = [...README.matchAll(/^\| (.+?) \| (.+?) \| (.+?) \|$/gm)]
    .map(([, first = "", , codes = ""]) => ({ first, codes: [...codes.matchAll(/`([a-z-]+)`/g)].map((match) => match[1] as string) }))
    .filter((row) => /^(puts|requests|asks|sets|writes|chooses|nests|names|is) /.test(row.first));

  it("has a probe for every row and a row for every probe", () => {
    expect(rows.length).toBe(Object.keys(PROBES).length);
    for (const phrase of Object.keys(PROBES)) expect(rows.filter((row) => row.first.includes(phrase)), phrase).toHaveLength(1);
  });

  it.each(Object.keys(PROBES))("the row for %s names what its hostile inputs get", async (phrase) => {
    const row = rows.find((candidate) => candidate.first.includes(phrase));
    if (row === undefined) throw new Error(`No hardening row mentions ${phrase}.`);
    expect(row.codes.length).toBeGreaterThan(0);
    const results = await (PROBES[phrase] as () => Promise<string[][]> | string[][])();
    for (const codes of results) expect(codes.some((code) => row.codes.includes(code)), `${phrase}: ${codes.join(", ")}`).toBe(true);
    expect(new Set(results.flat().filter((code) => row.codes.includes(code)))).toEqual(new Set(row.codes));
  });

  it("states the limits the policy holds", () => {
    expect(stated(/nests nodes past (\d+) deep/)).toBe(specEntry.LIMITS.depth);
    expect(stated(/chains handlers past (\d+)/)).toBe(specEntry.LIMITS.actionDepth);
  });
});

describe("The prose", () => {
  it("names only issue codes that exist", () => {
    const codes = new Set(Object.keys(specEntry.ISSUE_CODE_INFO));
    const kebab = [...README.matchAll(/`([a-z]+(?:-[a-z]+)+)`/g)].map((match) => match[1] as string);
    const notCodes = kebab.filter((token) => !codes.has(token) && !/^(?:data|r)-/.test(token) && token !== "response-ui-renderer");
    expect(kebab.length).toBeGreaterThan(10);
    expect(notCodes).toEqual([]);
  });

  it("states the package's version", () => {
    expect(README).toContain(`pre-release (${manifest.version})`);
  });
});
