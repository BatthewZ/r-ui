// @vitest-environment node
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const SOURCE = fileURLToPath(new URL("./code-highlight.ts", import.meta.url));
const PACKAGE = path.resolve(path.dirname(SOURCE), "../../..");

/** The declarations the build emits for the module, under the package's own compiler options. */
function emitDeclarations(): string {
  const config = ts.getParsedCommandLineOfConfigFile(path.join(PACKAGE, "tsconfig.json"), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    },
  });
  if (!config) throw new Error("tsconfig.json did not parse");
  const program = ts.createProgram([SOURCE], {
    ...config.options,
    noEmit: false,
    declaration: true,
    emitDeclarationOnly: true,
  });
  let emitted = "";
  const result = program.emit(program.getSourceFile(SOURCE), (_, text) => {
    emitted = text;
  });
  expect(result.emitSkipped).toBe(false);
  return emitted;
}

/** Type-checks `text` as a consumer would meet it: a `.d.ts` in the package, with `skipLibCheck: false`. */
function consumerErrors(text: string): string[] {
  const file = path.join(PACKAGE, "dist", "components", "content", "code-highlight.d.ts");
  const options: ts.CompilerOptions = {
    strict: true,
    skipLibCheck: false,
    noEmit: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const { getSourceFile, fileExists, readFile } = host;
  host.fileExists = (name) => name === file || fileExists(name);
  host.readFile = (name) => (name === file ? text : readFile(name));
  host.getSourceFile = (name, version, ...rest) =>
    name === file ? ts.createSourceFile(name, text, version, true) : getSourceFile(name, version, ...rest);
  const program = ts.createProgram([file], options, host);
  const source = program.getSourceFile(file);
  return [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)].map(
    (d) => `TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`,
  );
}

describe("code-highlight's emitted declarations", () => {
  it("name no wildcard module and type-check for a consumer with skipLibCheck off", { timeout: 30_000 }, () => {
    const declarations = emitDeclarations();
    // The positive control: the emit carries the module's public surface.
    expect(declarations).toContain("export type CodeLanguage");
    // A wildcard specifier resolves only while something else loads the
    // package's ambient declarations, so the check below alone could pass by luck.
    expect(declarations).not.toMatch(/import\("[^"]*\*[^"]*"\)/);
    expect(consumerErrors(declarations)).toEqual([]);
  });
});
