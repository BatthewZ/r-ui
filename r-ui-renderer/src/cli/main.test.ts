// @vitest-environment node
import { describe, expect, it } from "vitest";

import { createValidationHandler } from "../spec/handler";
import { type CliIO, main, parseArgs, USAGE, UsageError } from "./main";

const VALID = JSON.stringify({ version: 2, title: "t", root: { component: "Card", children: ["Hi"] } });
const WARNED = JSON.stringify({ version: 2, title: "t", root: { component: "Card", props: { className: "flexx" } } });
const INVALID = '{"version": 2, "title": "t"}';

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
  it("reads a file, --raw, --format, --contracts, --icons, --origin, --allow-origin, --allow-sensitive and --strict", () => {
    expect(parseArgs(["doc.json", "--format", "json", "--strict"])).toEqual({
      help: false,
      file: "doc.json",
      raw: undefined,
      format: "json",
      contracts: undefined,
      icons: undefined,
      origin: undefined,
      allowOrigins: [],
      allowSensitive: false,
      strict: true,
    });
    expect(
      parseArgs(["-", "--icons", "a,b", "--allow-origin", "https://cdn.example/x", "--allow-origin", "https://img.example", "--allow-sensitive"]),
    ).toMatchObject({ icons: "a,b", allowOrigins: ["https://cdn.example", "https://img.example"], allowSensitive: true });
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
    [["--origin", "https://a.test", "--origin", "https://b.test"], "--origin given twice."],
    [["--origin", "app.example"], '--origin must be a URL ("https://app.example"), not "app.example".'],
    [["--allow-origin", "cdn"], '--allow-origin must be a URL ("https://app.example"), not "cdn".'],
    [["--allow-origin"], "--allow-origin needs a value."],
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

  it("exits 2 when there is no document: a terminal on stdin, an unreadable file, or empty input", async () => {
    const tty = io({ stdinIsTTY: true });
    expect(await main([], tty.value)).toBe(2);
    expect(tty.err).toEqual(["No document: give a file, --raw, or pipe one in.\n"]);

    for (const argv of [[], ["--raw", "  \n"], ["empty.json"]]) {
      const empty = io({ readStdin: () => Promise.resolve(""), readFile: () => Promise.resolve("") });
      expect(await main(argv, empty.value)).toBe(2);
      expect(empty.err).toEqual(["No document: the input is empty.\n"]);
      expect(empty.out).toEqual([]);
    }

    const missing = io();
    expect(await main(["missing.json"], missing.value)).toBe(2);
    expect(missing.err).toEqual(["ENOENT: no such file\n"]);
  });
});

describe("main: verdicts", () => {
  const files = (map: Record<string, string>) => (path: string) =>
    Object.hasOwn(map, path) ? Promise.resolve(map[path] as string) : Promise.reject(new Error(`ENOENT: ${path}`));

  it("exits 0 on a valid document from a file, --raw or stdin", async () => {
    for (const [argv, overrides] of [
      [["doc.json"], { readFile: files({ "doc.json": VALID }) }],
      [["--raw", VALID], {}],
      [[], { readStdin: () => Promise.resolve(VALID) }],
      [["-"], { readStdin: () => Promise.resolve(VALID), stdinIsTTY: true }],
    ] as const) {
      const { value, out, err } = io(overrides);
      expect(await main(argv, value)).toBe(0);
      expect(out).toEqual(["valid: no issues\n"]);
      expect(err).toEqual([]);
    }
  });

  it("exits 1 on an invalid document and prints each issue path first", async () => {
    const { value, out } = io();
    expect(await main(["--raw", INVALID], value)).toBe(1);
    expect(out).toEqual(["error  (document)  missing-key: Missing `root`.\n1 error(s), 0 warning(s)\n"]);
  });

  it("prints a parse error with its line and column", async () => {
    const { value, out } = io();
    expect(await main(["--raw", '{\n  "version": }'], value)).toBe(1);
    expect(out[0]).toMatch(/^error {2}\(document\) \(line 2, column 14\) {2}invalid-json: /);
  });

  it("passes warnings (exit 0) unless --strict (exit 1), showing the suggestion", async () => {
    const plain = io();
    expect(await main(["--raw", WARNED], plain.value)).toBe(0);
    expect(plain.out[0]).toContain("warning  /root/props/className  unknown-class: ");
    expect(plain.out[0]).toContain('\n    "flex"\n');
    expect(await main(["--raw", WARNED, "--strict"], io().value)).toBe(1);
    expect(await main(["--raw", VALID, "--strict"], io().value)).toBe(0);
  });

  it("prints JSON (the validation handler's body) or the producer's feedback on request", async () => {
    const json = io();
    expect(await main(["--raw", INVALID, "--format", "json"], json.value)).toBe(1);
    expect(JSON.parse(json.out.join(""))).toEqual({
      ok: false,
      renderable: false,
      issues: [{ code: "missing-key", path: "", severity: "error", message: "Missing `root`." }],
      feedback: "The document is not valid: 1 error, 0 warnings. Fix each one and send the whole document again.\n(document) error missing-key: Missing `root`.",
    });
    const handled = await createValidationHandler()(new Request("https://app.example/v", { method: "POST", body: VALID }));
    const valid = io();
    expect(await main(["--raw", `\`\`\`json\n${VALID}\n\`\`\``, "--format", "json"], valid.value)).toBe(0);
    expect(JSON.parse(valid.out.join(""))).toEqual(await handled.json());
    // --strict fails on a warning, and the body says so.
    const strict = io();
    expect(await main(["--raw", WARNED, "--format", "json", "--strict"], strict.value)).toBe(1);
    expect(JSON.parse(strict.out.join(""))).toMatchObject({ ok: false, renderable: true });
    const model = io();
    expect(await main(["--raw", INVALID, "--format", "model"], model.value)).toBe(1);
    expect(model.out.join("")).toBe(
      "The document is not valid: 1 error, 0 warnings. Fix each one and send the whole document again.\n(document) error missing-key: Missing `root`.\n",
    );
  });

  it("judges URLs against --origin and each --allow-origin", async () => {
    const doc = JSON.stringify({ version: 2, title: "t", root: { component: "Avatar", props: { src: "https://app.example/me.png", alt: "Me" } } });
    expect(await main(["--raw", doc, "--strict"], io().value)).toBe(1);
    expect(await main(["--raw", doc, "--strict", "--origin", "https://app.example"], io().value)).toBe(0);
    expect(await main(["--raw", doc, "--strict", "--allow-origin", "https://app.example"], io().value)).toBe(0);
    const api = JSON.stringify({ version: 2, title: "t", data: { d: { type: "api", endpoint: "https://api.example/x" } }, root: "x" });
    expect(await main(["--raw", api, "--strict", "--origin", "https://app.example"], io().value)).toBe(1);
    expect(await main(["--raw", api, "--strict", "--origin", "https://app.example", "--allow-origin", "https://api.example"], io().value)).toBe(0);
  });

  it("mirrors the host's icon set (--icons) and allowSensitive (--allow-sensitive)", async () => {
    const icon = JSON.stringify({ version: 2, title: "t", root: { component: "Icon", props: { name: "rocket-ship" } } });
    expect(await main(["--raw", icon, "--strict"], io().value)).toBe(1);
    expect(await main(["--raw", icon, "--strict", "--icons", "check, rocket-ship"], io().value)).toBe(0);
    const fromFile = io({ readFile: files({ "icons.json": '["rocket-ship"]' }) });
    expect(await main(["--raw", icon, "--strict", "--icons", "icons.json"], fromFile.value)).toBe(0);
    const badFile = io({ readFile: files({ "icons.json": '{"a": 1}' }) });
    expect(await main(["--raw", icon, "--icons", "icons.json"], badFile.value)).toBe(2);
    expect(badFile.err).toEqual(["icons.json must be a JSON array of icon names.\n"]);

    const secret = JSON.stringify({ version: 2, title: "t", root: { component: "Input", props: { type: "password", "aria-label": "Password" } } });
    expect(await main(["--raw", secret, "--strict"], io().value)).toBe(1);
    expect(await main(["--raw", secret, "--strict", "--allow-sensitive"], io().value)).toBe(0);
  });

  it("adds --contracts to the defaults, and refuses a malformed contracts file as an input error", async () => {
    const doc = JSON.stringify({ version: 2, title: "t", root: { component: "OrgChart", props: { depth: 2 } } });
    const known = io({ readFile: files({ "extra.json": JSON.stringify({ OrgChart: { props: [{ name: "depth", type: "number", required: false }] } }) }) });
    expect(await main(["--raw", doc, "--contracts", "extra.json", "--strict"], known.value)).toBe(0);
    expect(await main(["--raw", doc, "--strict"], io().value)).toBe(1);

    for (const [contents, message] of [
      ["[]", "extra.json must be a JSON object of contracts (name -> contract object).\n"],
      ['{"OrgChart": {"props": 5}}', "extra.json: OrgChart.props must be an array.\n"],
      ['{"OrgChart": {"props": [{"type": "x"}]}}', "extra.json: OrgChart.props[0] must be an object with a string `name`.\n"],
      ['{"OrgChart": {"colour": "red"}}', "extra.json: OrgChart.colour is not a contract field.\n"],
    ] as const) {
      const bad = io({ readFile: files({ "extra.json": contents }) });
      expect(await main(["--raw", doc, "--contracts", "extra.json"], bad.value)).toBe(2);
      expect(bad.err).toEqual([message]);
      expect(bad.out).toEqual([]);
    }
  });

  it("refuses a contracts file whose fields hold the wrong JSON inside (exit 2), rather than crashing (exit 3)", async () => {
    const doc = JSON.stringify({
      version: 2,
      title: "t",
      root: { component: "OrgChart", props: { size: "big", as: "div", level: 2, render: { $node: { component: "Card" } }, href: "/a" } },
    });
    const props = ["size", "as", "level", "render", "href"].map((name) => ({ name, type: "string", required: false }));
    for (const [over, message] of [
      [{ propEnums: { size: 5 } }, "extra.json: OrgChart.propEnums.size must be an array.\n"],
      [{ elementProps: { as: "div" } }, "extra.json: OrgChart.elementProps.as must be an array.\n"],
      [{ headingLevelProps: { level: 2 } }, "extra.json: OrgChart.headingLevelProps.level must be an array.\n"],
      [{ templateProps: { render: "row" } }, "extra.json: OrgChart.templateProps.render must be an array.\n"],
      [{ urlProps: [5] }, "extra.json: OrgChart.urlProps[0] must be a string.\n"],
      [{ nodeProps: [5] }, "extra.json: OrgChart.nodeProps[0] must be a string.\n"],
      [{ droppedProps: [5] }, "extra.json: OrgChart.droppedProps[0] must be a string.\n"],
      [{ props: [{ name: "size", type: 5 }] }, "extra.json: OrgChart.props[0].type must be a string.\n"],
    ] as const) {
      const bad = io({ readFile: files({ "extra.json": JSON.stringify({ OrgChart: { props, ...over } }) }) });
      expect(await main(["--raw", doc, "--contracts", "extra.json"], bad.value)).toBe(2);
      expect(bad.err).toEqual([message]);
      expect(bad.out).toEqual([]);
    }
  });
});
