// @vitest-environment node
import { describe, expect, it } from "vitest";

import { type CliIO, main, parseArgs, USAGE, UsageError } from "./main";

function io(overrides: Partial<CliIO> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const value: CliIO = {
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
    readFile: () => Promise.reject(new Error("ENOENT: no such file")),
    readStdin: () => Promise.resolve(""),
    stdinIsTTY: false,
    ...overrides,
  };
  return { value, out, err };
}

describe("parseArgs", () => {
  it("reads a file, --raw, --format, --contracts, --origin and --strict", () => {
    expect(parseArgs(["doc.json", "--format", "json", "--strict"])).toEqual({
      help: false,
      file: "doc.json",
      raw: undefined,
      format: "json",
      contracts: undefined,
      origin: undefined,
      strict: true,
    });
    expect(parseArgs(["--raw", "{}", "--contracts", "extra.json", "--origin", "https://app.example"])).toMatchObject({
      raw: "{}",
      contracts: "extra.json",
      origin: "https://app.example",
      format: "text",
    });
    expect(parseArgs(["-"]).file).toBe("-");
  });

  it.each([
    [["--format", "yaml"], "--format must be one of text, json, model."],
    [["--raw"], "--raw needs a value."],
    [["a.json", "b.json"], "Give one file at most."],
    [["a.json", "--raw", "{}"], "Give a file or --raw, not both."],
    [["--fast"], "Unknown option --fast."],
    [["--origin", "a", "--origin", "b"], "--origin given twice."],
  ])("refuses %j", (argv, message) => {
    expect(() => parseArgs(argv)).toThrow(new UsageError(message));
  });
});

describe("main", () => {
  it("prints the help and exits 0", async () => {
    const { value, out, err } = io();
    expect(await main(["--help"], value)).toBe(0);
    expect(out).toEqual([USAGE]);
    expect(err).toEqual([]);
  });

  it("exits 2 with the reason and the usage on a bad argument", async () => {
    const { value, out, err } = io();
    expect(await main(["--format", "yaml"], value)).toBe(2);
    expect(out).toEqual([]);
    expect(err).toEqual([`--format must be one of text, json, model.\n\n${USAGE}`]);
  });

  it("exits 2 when there is no document: a terminal on stdin, or an unreadable file", async () => {
    const tty = io({ stdinIsTTY: true });
    expect(await main([], tty.value)).toBe(2);
    expect(tty.err).toEqual(["No document: give a file, --raw, or pipe one in.\n"]);

    const missing = io();
    expect(await main(["missing.json"], missing.value)).toBe(2);
    expect(missing.err).toEqual(["ENOENT: no such file\n"]);
  });
});
