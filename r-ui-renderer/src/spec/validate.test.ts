// @vitest-environment node
import { describe, expect, it } from "vitest";

import { extendContracts } from "../contracts";
import { defaultContracts } from "../contracts";
import { type Issue, ISSUE_CODE_INFO, LIMITS, RUNTIME_ISSUE_CODES, type ValidationResult } from "./index";
import { validateViewSpec, type ValidateOptions } from "./validate";

function doc(root: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { version: 2, title: "Fixture", ...extra, root };
}

const pairs = (result: ValidationResult) => result.issues.map((issue) => [issue.code, issue.path]);

function only(input: unknown, options?: ValidateOptions): Issue {
  const { issues } = validateViewSpec(input, options);
  expect(issues).toHaveLength(1);
  return issues[0] as Issue;
}

const card = (props: Record<string, unknown>, children?: unknown[]) => ({ component: "Card", props, ...(children ? { children } : {}) });

describe("validateViewSpec: input", () => {
  it("accepts a valid document as text and as a value, with no issues", () => {
    const value = doc({ component: "Stack", props: { gap: "r3" }, children: ["Hello", { component: "Badge", children: ["New"] }] });
    for (const input of [value, JSON.stringify(value), `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``]) {
      const result = validateViewSpec(input);
      expect(result.issues).toEqual([]);
      expect(result.ok).toBe(true);
      expect(result.spec).toEqual(value);
    }
  });

  it("places a parse error by line and column in the text as given, fence included", () => {
    const text = '```json\n{\n  "version": 2,\n  "title": "x",\n  "root": }\n```';
    expect(only(text)).toMatchObject({ code: "invalid-json", path: "", severity: "error", line: 5, column: 11 });
    expect(only('{"version": 2, "title": "x", "root": {"component": "Card"')).toMatchObject({ code: "invalid-json", line: 1, column: 58 });
    expect(only("   ")).toMatchObject({ code: "invalid-json", line: 1, column: 1 });
    expect(validateViewSpec("{} trailing").ok).toBe(false);
  });

  it("refuses a value that is not JSON at the place it stops being JSON", () => {
    const cyclic: Record<string, unknown> = { component: "Card" };
    cyclic.props = { self: cyclic };
    expect(only(doc(cyclic))).toMatchObject({ code: "invalid-type", path: "/root/props/self" });
    expect(only(doc({ component: "Card", props: { at: new Date(0) } }))).toMatchObject({ code: "invalid-type", path: "/root/props/at" });
    expect(only(doc({ component: "Card", props: { n: Number.NaN } }))).toMatchObject({ code: "invalid-type", path: "/root/props/n" });
    expect(only(doc(["a", undefined]))).toMatchObject({ code: "invalid-type", path: "/root/1" });
    expect(validateViewSpec(doc("x", { description: undefined })).ok).toBe(true);
  });

  it("never throws on hostile input", () => {
    const nest = (levels: number) => {
      let node: unknown = "leaf";
      for (let i = 0; i < levels; i += 1) node = { component: "Stack", children: [node] };
      return node;
    };
    const hostile: [unknown, string[]][] = [
      [JSON.parse('{"version":2,"title":"t","root":{"component":"Card","props":{"__proto__":{"polluted":true},"constructor":1}}}'), ["forbidden-prop", "forbidden-prop"]],
      [JSON.parse('{"version":2,"title":"t","state":{"__proto__":{"x":1}},"root":"x"}'), ["invalid-name"]],
      [doc({ component: "Stack", children: Array.from({ length: 20_000 }, (_, i) => `row ${i}`) }), []],
      ["null", ["invalid-type"]],
      ["[]", ["invalid-type"]],
      [42, ["invalid-type"]],
    ];
    for (const [input, codes] of hostile) expect(validateViewSpec(input).issues.map((issue) => issue.code)).toEqual(codes);
    // Whether 1000 levels fit the call stack depends on the engine; either answer is one issue, never a throw.
    const thousand = validateViewSpec(doc(nest(1000))).issues;
    expect(thousand).toHaveLength(1);
    expect(["limit-exceeded", "too-deep"]).toContain(thousand[0]?.code);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const deepResult = validateViewSpec(doc(nest(300)));
    expect(deepResult.ok).toBe(true);
    expect(pairs(deepResult)).toEqual([["limit-exceeded", `/root${"/children/0".repeat(LIMITS.depth + 1)}`]]);
  });

  it("reports a document nested past any call stack as too-deep, an error, without throwing", () => {
    let deep = '"leaf"';
    for (let i = 0; i < 200_000; i += 1) deep = `{"component":"Stack","children":[${deep}]}`;
    const result = validateViewSpec(`{"version":2,"title":"t","root":${deep}}`);
    expect(result.ok).toBe(false);
    expect(pairs(result)).toEqual([["too-deep", ""]]);
  });

  it("gives every issue the severity its code has", () => {
    const result = validateViewSpec(doc(card({ varient: "x", onClick: { action: "toast", payload: {} } }), { theme: "aurora" }));
    expect(result.issues.length).toBeGreaterThan(2);
    for (const issue of result.issues) expect(issue.severity).toBe(ISSUE_CODE_INFO[issue.code].severity);
  });
});

describe("validateViewSpec: errors are conformance", () => {
  it("checks the document's own keys", () => {
    const result = validateViewSpec({ version: 3, title: "", theme: "aurora", density: "cosy" });
    expect(result.ok).toBe(false);
    expect(pairs(result)).toEqual([
      ["missing-key", ""],
      ["unknown-key", "/theme"],
      ["unsupported-version", "/version"],
      ["invalid-value", "/title"],
      ["invalid-value", "/density"],
    ]);
    expect(result.issues[4]?.suggestion).toBeUndefined();
    expect(validateViewSpec(doc("x", { title: "t".repeat(LIMITS.title + 1) })).ok).toBe(false);
    expect(validateViewSpec(doc("x", { title: "😀".repeat(LIMITS.title) })).ok).toBe(true);
  });

  it("suggests the key or value meant", () => {
    const result = validateViewSpec(doc({ component: "Card", chidren: [] }, { densty: "compact" }));
    expect(result.issues.map((issue) => [issue.code, issue.path, issue.suggestion])).toEqual([
      ["unknown-key", "/densty", '"density"'],
      ["unknown-key", "/root/chidren", '"children"'],
    ]);
  });

  it("says which node shape a bad node breaks, at the node", () => {
    const result = validateViewSpec(
      doc({
        component: "Stack",
        children: [
          5,
          null,
          {},
          { component: "Card", $ref: "data.x" },
          { $each: "data.rows", as: "row" },
          { $each: "data.rows", as: "data", node: "x" },
          { $cond: { ref: "state.x" }, then: "a" },
          { $cond: { ref: "state.x", eq: 1, ne: 2 }, then: "a" },
          { $ref: "data..x" },
          { $ref: "data.__proto__" },
          { component: "" },
          { component: "Card", props: [] },
          { component: "Card", children: "text" },
        ],
      }),
    );
    expect(pairs(result).filter(([code]) => ISSUE_CODE_INFO[code as keyof typeof ISSUE_CODE_INFO].severity === "error")).toEqual([
      ["invalid-node", "/root/children/0"],
      ["invalid-node", "/root/children/1"],
      ["invalid-node", "/root/children/2"],
      ["invalid-node", "/root/children/3"],
      ["missing-key", "/root/children/4"],
      ["invalid-name", "/root/children/5/as"],
      ["invalid-value", "/root/children/6/$cond"],
      ["invalid-value", "/root/children/7/$cond"],
      ["invalid-ref", "/root/children/8/$ref"],
      ["invalid-ref", "/root/children/9/$ref"],
      ["invalid-value", "/root/children/10/component"],
      ["invalid-type", "/root/children/11/props"],
      ["invalid-type", "/root/children/12/children"],
    ]);
  });

  it("checks markers wherever they sit in props, and leaves objects with other keys beside them as data", () => {
    const props = {
      a: { $ref: "state..x" },
      b: { deep: [{ $node: 5 }] },
      c: { $format: { value: 1, style: "currency" } },
      d: { $format: { value: 1, style: "money" } },
      e: { $ref: "not a marker", other: 1 },
      f: { $node: { component: "Badge" }, label: "data" },
      g: { $ref: 5 },
    };
    const result = validateViewSpec(doc(card(props)));
    expect(pairs(result).filter(([, path]) => !String(path).endsWith("/component"))).toEqual([
      ["invalid-ref", "/root/props/a/$ref"],
      ["invalid-node", "/root/props/b/deep/0/$node"],
      ["missing-key", "/root/props/c/$format"],
      ["invalid-value", "/root/props/d/$format/style"],
      ["invalid-ref", "/root/props/g/$ref"],
      ...[["unknown-prop", "/root/props/a"], ["unknown-prop", "/root/props/b"], ["unknown-prop", "/root/props/c"], ["unknown-prop", "/root/props/d"], ["unknown-prop", "/root/props/e"], ["unknown-prop", "/root/props/f"], ["unknown-prop", "/root/props/g"]],
    ]);
    expect(result.issues[3]?.suggestion).toBeUndefined();
  });

  it("holds an action under an on… key to the action's shape, at any depth, and drops anything else there", () => {
    const result = validateViewSpec(
      doc(
        card({
          onClick: { action: "toast", payload: { title: "Hi" } },
          items: [{ onSelect: { action: "setState", payload: { path: "items", value: 1 } } }],
          onHover: [{ action: "showToast", payload: { title: "a" } }, 5],
          onFocus: "not a handler",
          data: { action: "whatever", payload: 1 },
        }),
      ),
    );
    const errors = result.issues.filter((issue) => issue.severity === "error");
    expect(errors.map((issue) => [issue.code, issue.path, issue.suggestion])).toEqual([
      ["invalid-value", "/root/props/onClick/action", '"showToast"'],
      ["invalid-ref", "/root/props/items/0/onSelect/payload/path", undefined],
      ["invalid-value", "/root/props/onHover", undefined],
    ]);
    expect(pairs(result)).toContainEqual(["forbidden-prop", "/root/props/onFocus"]);
    expect(pairs(result)).not.toContainEqual(["invalid-value", "/root/props/data/action"]);
  });

  it("checks data bindings, forms and handler payloads", () => {
    const result = validateViewSpec(
      doc("x", {
        state: { "bad name": 1, ok: { $ref: "anything goes in seeds" } },
        data: {
          a: { type: "rest", endpoint: "/x" },
          b: { endpoint: "/x" },
          c: { type: "api", endpoint: "/x", method: "PUT" },
          d: { type: "static" },
        },
        forms: {
          f: {
            fields: { "a.b": {}, n: { type: "integer", rules: { minLength: -1 } } },
            onSubmit: [],
            onInvalid: { action: "apiCall", payload: { endpoint: "/x", into: "result", onSuccess: { action: "navigate", payload: {} } } },
          },
        },
      }),
    );
    expect(pairs(result)).toEqual([
      ["invalid-name", "/state/bad name"],
      ["invalid-value", "/data/a/type"],
      ["missing-key", "/data/b"],
      ["invalid-value", "/data/c/method"],
      ["missing-key", "/data/d"],
      ["invalid-name", "/forms/f/fields/a.b"],
      ["invalid-value", "/forms/f/fields/n/type"],
      ["invalid-value", "/forms/f/fields/n/rules/minLength"],
      ["invalid-value", "/forms/f/onSubmit"],
      ["invalid-ref", "/forms/f/onInvalid/payload/into"],
      ["missing-key", "/forms/f/onInvalid/payload/onSuccess/payload"],
    ]);
  });
});

describe("validateViewSpec: warnings", () => {
  const warnings = (input: unknown, options?: ValidateOptions) => {
    const result = validateViewSpec(input, options);
    expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(result.ok).toBe(true);
    return result.issues.map((issue) => [issue.code, issue.path, issue.suggestion]);
  };

  it("names unknown and excluded components, suggesting a part only for a part", () => {
    expect(
      warnings(
        doc({
          component: "Card",
          children: [{ component: "Cardd" }, { component: "Card.Heder" }, { component: "Kanban" }, { component: "TreeView.Item" }, { component: "Header" }],
        }),
      ),
    ).toEqual([
      ["unknown-component", "/root/children/0/component", '"Card"'],
      ["unknown-component", "/root/children/1/component", '"Card.Header"'],
      ["not-addressable", "/root/children/2/component", undefined],
      ["not-addressable", "/root/children/3/component", undefined],
      ["unknown-component", "/root/children/4/component", undefined],
    ]);
  });

  it("knows a host's names, contracted or not", () => {
    const contracts = extendContracts(defaultContracts, { OrgChart: { props: [{ name: "depth", type: "number", required: false }] } });
    expect(warnings(doc({ component: "Stack", children: [{ component: "OrgChart", props: { depth: 2, dpeth: 1 } }, { component: "Gauge", props: { anything: 1 } }] }), { contracts, components: ["Gauge"] })).toEqual([
      ["unknown-prop", "/root/children/0/props/dpeth", '"depth"'],
    ]);
  });

  it("places parts inside their root and placement-bound components inside their parent", () => {
    expect(
      warnings(
        doc({
          component: "Stack",
          children: [
            { component: "Card.Header" },
            { component: "Card", children: [{ component: "Stack", children: [{ component: "Card.Header" }] }] },
            { component: "Radio", props: { value: "a" } },
            { component: "RadioGroup", children: [{ component: "Radio", props: { value: "a" } }] },
          ],
        }),
      ),
    ).toEqual([
      ["misplaced-part", "/root/children/0/component", undefined],
      ["misplaced-part", "/root/children/2/component", undefined],
    ]);
  });

  it("checks props against the contract: unknown names, closed sets, elements, heading levels", () => {
    expect(
      warnings(
        doc({
          component: "Stack",
          props: { gap: "r9", as: "main", varient: "x", className: "p-r3 p-4", "aria-label": "Main", title: "native" },
          children: [
            { component: "Button", props: { variant: "primay", type: "submit" }, children: ["Go"] },
            { component: "Card", children: [{ component: "Card.Title", props: { as: "h1" } }] },
            { component: "EmptyState", props: { title: "None", headingLevel: 1 } },
            { component: "Card", props: { classNames: { body: "p-r3" } } },
            { component: "Badge", props: { classNames: { icn: "p-r3" } } },
            { component: "Dialog", props: { className: "p-r3", children: ["x"] } },
          ],
        }),
      ),
    ).toEqual([
      ["invalid-prop-value", "/root/props/gap", undefined],
      ["invalid-prop-value", "/root/props/as", undefined],
      ["unknown-prop", "/root/props/varient", undefined],
      ["unknown-class", "/root/props/className", undefined],
      ["invalid-prop-value", "/root/children/0/props/variant", '"primary"'],
      ["invalid-prop-value", "/root/children/1/children/0/props/as", undefined],
      ["invalid-prop-value", "/root/children/2/props/headingLevel", undefined],
      ["unknown-prop", "/root/children/3/props/classNames", undefined],
      ["unknown-prop", "/root/children/3/props/classNames/body", undefined],
      ["unknown-prop", "/root/children/4/props/classNames/icn", '"icon"'],
      ["unknown-prop", "/root/children/5/props/className", undefined],
      ["unknown-prop", "/root/children/5/props/children", undefined],
    ]);
  });

  it("drops forbidden, id, name, data-* and contract-dropped props", () => {
    expect(
      warnings(
        doc({
          component: "Stack",
          props: {
            STYLE: "color: red",
            dangerouslySetInnerHTML: { __html: "x" },
            id: "main",
            "aria-labelledby": "h",
            name: "q",
            "data-theme": "aurora",
            "data-density": "cosy",
            "data-Track": "x",
            "data-ok": "fine",
            "data-obj": { a: 1 },
          },
          children: [
            { component: "Link", props: { href: "/a", as: "a" } },
            { component: "Field", props: { name: "email" } },
            { component: "Pricing", props: { plans: [], labels: { saving: "x" } } },
            { component: "Dialog", props: { dialogId: "edit", open: true } },
          ],
        }),
      ),
    ).toEqual([
      ["forbidden-prop", "/root/props/STYLE", undefined],
      ["forbidden-prop", "/root/props/dangerouslySetInnerHTML", undefined],
      ["forbidden-prop", "/root/props/id", undefined],
      ["forbidden-prop", "/root/props/aria-labelledby", undefined],
      ["unknown-prop", "/root/props/name", undefined],
      ["forbidden-prop", "/root/props/data-theme", undefined],
      ["invalid-prop-value", "/root/props/data-density", undefined],
      ["forbidden-prop", "/root/props/data-Track", undefined],
      ["invalid-prop-value", "/root/props/data-obj", undefined],
      ["forbidden-prop", "/root/children/0/props/as", undefined],
      ["undeclared-name", "/root/children/1/props/name", undefined],
      ["forbidden-prop", "/root/children/2/props/labels/saving", undefined],
      ["forbidden-prop", "/root/children/3/props/open", undefined],
    ]);
  });

  it("reads `name` and ref-typed props the way the renderer does", () => {
    expect(
      warnings(
        doc({
          component: "Stack",
          children: [
            { component: "Input", props: { name: "email", "aria-label": "Email" } },
            { component: "Slider", props: { name: "volume" } },
            { component: "Avatar", props: { name: "Ada Lovelace" } },
            { component: "Icon", props: { name: "arrow-up-right" } },
            { component: "Icon", props: { name: "arow-up-right" } },
            { component: "Popover", children: [{ component: "Popover.Content", props: { initialFocus: { current: null } } }] },
            { component: "Popover", children: [{ component: "Popover.Content", props: { initialFocus: 1 } }] },
            { component: "Dialog", props: { dialogId: "d" }, children: [{ component: "Dialog.Content", props: { initialFocus: 1 } }] },
          ],
        }),
      ),
    ).toEqual([
      ["forbidden-prop", "/root/children/0/props/name", undefined],
      ["forbidden-prop", "/root/children/1/props/name", undefined],
      ["unknown-icon", "/root/children/4/props/name", '"arrow-up-right"'],
      ["invalid-prop-value", "/root/children/5/children/0/props/initialFocus", undefined],
      ["forbidden-prop", "/root/children/7/children/0/props/initialFocus", undefined],
    ]);
  });

  it("refuses URLs by scheme anywhere in props, and images and endpoints by origin", () => {
    const value = doc(
      {
        component: "Stack",
        children: [
          { component: "Link", props: { href: "JavaScript:alert(1)" }, children: ["x"] },
          { component: "Image", props: { src: "https://cdn.elsewhere.test/a.png", alt: "", width: 1, height: 1, placeholder: "data:image/svg+xml,<svg/>" } },
          { component: "Image", props: { src: "/a.png", srcSet: "/a.png 1x, https://cdn.elsewhere.test/b.png 2x", alt: "", width: 1, height: 1 } },
          { component: "Avatar", props: { src: "https://app.example/me.png", name: "Me" } },
          { component: "TreeView", props: { items: [{ id: "a", label: "A", href: "vbscript:x" }] } },
          { component: "Card", props: { data: { nested: { href: "javascript:x", to: "/fine" } } } },
          { component: "Button", props: { onClick: { action: "navigate", payload: { to: "javascript:x" } } }, children: ["Go"] },
          { component: "Button", props: { onClick: { action: "apiCall", payload: { endpoint: "/\\evil.test/x" } } }, children: ["Go"] },
        ],
      },
      { data: { a: { type: "api", endpoint: "https://api.elsewhere.test/x" }, b: { type: "api", endpoint: "https://app.example/x" } } },
    );
    const found = warnings(value, { origin: "https://app.example" }).filter(([code]) => code === "refused-url");
    expect(found.map(([, path]) => path)).toEqual([
      "/data/a/endpoint",
      "/root/children/0/props/href",
      "/root/children/1/props/placeholder",
      "/root/children/1/props/src",
      "/root/children/2/props/srcSet",
      "/root/children/4/props/items/0/href",
      "/root/children/5/props/data/nested/href",
      "/root/children/6/props/onClick/payload/to",
      "/root/children/7/props/onClick/payload/endpoint",
    ]);
    // Without an origin, only relative URLs are the view's own.
    expect(warnings(value).filter(([code, path]) => code === "refused-url" && path === "/root/children/3/props/src")).toHaveLength(1);
  });

  it("checks class names, icons, dates, sets, Intl codes and the ref-typed initialFocus", () => {
    expect(
      warnings(
        doc({
          component: "Stack",
          children: [
            { component: "Card", props: { className: "flex gap-r3 text-sm" } },
            { component: "Icon", props: { name: "chek" } },
            { component: "Button", props: { iconStart: "plus", iconEnd: "nope-nope" }, children: ["Add"] },
            { component: "Calendar", props: { defaultValue: "2026-02-30", min: "2026-01-01" } },
            { component: "DataTable", props: { columns: [{ id: "a" }], rows: [], selectedKeys: "a" } },
            { component: "Pricing", props: { plans: [], currency: "EURO" } },
            { component: "Popover", children: [{ component: "Popover.Content", props: { initialFocus: { current: null } } }] },
            { component: "Popover", children: [{ component: "Popover.Content", props: { initialFocus: 1 } }] },
            { component: "Popover", children: [{ component: "Popover.Content", props: { initialFocus: "first" } }] },
          ],
        }),
      ),
    ).toEqual([
      ["unknown-class", "/root/children/0/props/className", undefined],
      ["unknown-icon", "/root/children/1/props/name", '"check"'],
      ["unknown-icon", "/root/children/2/props/iconEnd", undefined],
      ["invalid-prop-value", "/root/children/3/props/defaultValue", undefined],
      ["invalid-prop-value", "/root/children/4/props/selectedKeys", undefined],
      ["invalid-prop-value", "/root/children/5/props/currency", undefined],
      ["invalid-prop-value", "/root/children/6/children/0/props/initialFocus", undefined],
      ["invalid-prop-value", "/root/children/8/children/0/props/initialFocus", undefined],
    ]);
    expect(warnings(doc(card({ className: "p-4" })), { classes: false })).toEqual([]);
  });

  it("checks DataTable columns, formatters and select options as the contract says", () => {
    expect(
      warnings(
        doc({
          component: "Stack",
          children: [
            {
              component: "DataTable",
              props: {
                rows: [],
                rowKey: 5,
                columns: [
                  { id: "a", priority: 9, width: "url(x)", filter: { type: "custom" } },
                  { id: "a", format: { style: "currency", currency: "EURO" }, wrap: true },
                  { header: "No id" },
                ],
              },
            },
            { component: "StatCard", props: { label: "x", value: "1", formatDelta: "precent" } },
            { component: "Select", props: { options: [{ value: "a" }] } },
          ],
        }),
      ),
    ).toEqual([
      ["invalid-prop-value", "/root/children/0/props/rowKey", undefined],
      ["invalid-prop-value", "/root/children/0/props/columns/0/priority", undefined],
      ["invalid-prop-value", "/root/children/0/props/columns/0/width", undefined],
      ["invalid-prop-value", "/root/children/0/props/columns/0/filter/type", undefined],
      ["unknown-prop", "/root/children/0/props/columns/1/wrap", undefined],
      ["invalid-prop-value", "/root/children/0/props/columns/1/id", undefined],
      ["unusable-value", "/root/children/0/props/columns/1/format/currency", undefined],
      ["invalid-prop-value", "/root/children/0/props/columns/2", undefined],
      ["invalid-prop-value", "/root/children/1/props/formatDelta", '"percent"'],
      ["invalid-prop-value", "/root/children/2/props/options/0", undefined],
    ]);
  });

  it("walks every place a node can appear: children, $each and $cond branches, $node at any depth, templates with their names", () => {
    const bad = (where: string) => ({ component: "Bogus", props: { note: where } });
    const value = doc(
      {
        component: "Stack",
        children: [
          { $each: "data.rows", as: "item", node: { component: "Stack", children: [bad("each"), { $ref: "item.name" }, { $ref: "itemIndex" }] } },
          { $cond: "data.rows", then: bad("then"), else: bad("else") },
          { component: "Card", props: { extra: { list: [{ $node: bad("deep") }] } } },
          {
            component: "DataTable",
            props: {
              rows: { $ref: "data.rows" },
              columns: [{ id: "name", header: { $node: { $ref: "row.name" } }, cell: { $node: { component: "Stack", children: [bad("cell"), { $ref: "value" }, { $ref: "row.id" }] } } }],
              rowActions: { $node: { $ref: "rowIndex" } },
              renderDetail: { $node: bad("detail") },
              bulkActions: { $node: { $ref: "selectedKeys.length" } },
            },
          },
        ],
      },
      { data: { rows: { type: "static", value: [] } } },
    );
    expect(warnings(value)).toEqual([
      ["unknown-component", "/root/children/0/node/children/0/component", undefined],
      ["unknown-component", "/root/children/1/then/component", undefined],
      ["unknown-component", "/root/children/1/else/component", undefined],
      ["unknown-prop", "/root/children/2/props/extra", undefined],
      ["unknown-component", "/root/children/2/props/extra/list/0/$node/component", undefined],
      ["unknown-component", "/root/children/3/props/renderDetail/$node/component", undefined],
      ["unknown-component", "/root/children/3/props/columns/0/cell/$node/children/0/component", undefined],
      // A column header is no template: `row` is not in scope there.
      ["undeclared-name", "/root/children/3/props/columns/0/header/$node/$ref", undefined],
    ]);
  });

  it("checks references against what the document declares and what is in scope", () => {
    const value = doc(
      {
        component: "Stack",
        children: [
          { $ref: "data.servics" },
          { $ref: "status.services" },
          { $ref: "state.tabb" },
          { $ref: "state.written" },
          { $ref: "forms.contact.values.emial" },
          { $ref: "forms.contact.submiting" },
          { $ref: "forms.other.dirty" },
          { $ref: "event.value" },
          { $ref: "row.id" },
          { $cond: { not: { ref: "state.tab", eq: { $ref: "state.nope" } } }, then: "x" },
          {
            component: "Button",
            props: {
              onClick: [
                { action: "setState", payload: { path: "state.written", value: { $ref: "event.value" } } },
                { action: "submitForm", payload: { form: "contct" } },
                { action: "openDialog", payload: { dialogId: "edit" } },
                { action: "closeDialog", payload: { dialogId: "nope" } },
              ],
            },
            children: ["Go"],
          },
          { component: "Dialog", props: { dialogId: "edit" } },
        ],
      },
      {
        state: { tab: "a" },
        data: { services: { type: "api", endpoint: "/s", query: { region: { $ref: "state.tab" }, other: { $ref: "data.services" } } } },
        forms: { contact: { fields: { email: {} } } },
      },
    );
    expect(warnings(value)).toEqual([
      ["undeclared-name", "/data/services/query/other/$ref", undefined],
      ["undeclared-name", "/root/children/0/$ref", '"data.services"'],
      ["undeclared-name", "/root/children/2/$ref", '"state.tab"'],
      ["undeclared-name", "/root/children/4/$ref", '"forms.contact.values.email"'],
      ["undeclared-name", "/root/children/5/$ref", '"forms.contact.submitting"'],
      ["undeclared-name", "/root/children/6/$ref", undefined],
      ["undeclared-name", "/root/children/7/$ref", undefined],
      ["undeclared-name", "/root/children/8/$ref", undefined],
      ["undeclared-name", "/root/children/9/$cond/not/eq/$ref", undefined],
      ["undeclared-name", "/root/children/10/props/onClick/1/payload/form", '"contact"'],
      ["undeclared-name", "/root/children/10/props/onClick/3/payload/dialogId", undefined],
    ]);
  });

  it("binds Fields to the enclosing form and flags controls that would detach", () => {
    const value = doc(
      {
        component: "Stack",
        children: [
          {
            component: "Form",
            props: { form: "contact" },
            children: [
              { component: "Field", props: { name: "email" }, children: [{ component: "Input", props: { type: "email", value: "x" } }] },
              { component: "Field", props: { name: "emial" }, children: [{ component: "Input" }] },
              { component: "Field", children: [{ component: "Input", props: { value: "unbound is fine" } }] },
              { component: "Form", props: { form: "contact" } },
              { component: "ErrorSummary" },
            ],
          },
          { component: "Form", props: { form: "nope" } },
          { component: "ErrorSummary" },
          { component: "Wizard", props: { form: "contact" }, children: [{ component: "Wizard.Step", props: { label: "One", fields: ["email", "phone"] } }] },
        ],
      },
      { forms: { contact: { fields: { email: {} } } } },
    );
    expect(warnings(value)).toEqual([
      ["controlled-in-field", "/root/children/0/children/0/children/0/props/value", undefined],
      ["undeclared-name", "/root/children/0/children/1/props/name", '"email"'],
      ["misplaced-part", "/root/children/0/children/3/component", undefined],
      ["undeclared-name", "/root/children/1/props/form", undefined],
      ["misplaced-part", "/root/children/2/component", undefined],
      ["undeclared-name", "/root/children/3/children/0/props/fields/1", undefined],
    ]);
  });

  it("checks form field rules and initial values against the field's type", () => {
    const value = doc("x", {
      forms: {
        f: {
          fields: {
            n: { type: "number", initialValue: "5", rules: { minLength: 1, min: "1" } },
            d: { type: "date", initialValue: "2026-02-30", rules: { max: "soon" } },
            t: { rules: { pattern: "([a-z" } },
            b: { type: "boolean", initialValue: { $ref: "state.nope" } },
          },
        },
      },
    });
    expect(warnings(value)).toEqual([
      ["unusable-value", "/forms/f/fields/n/rules/minLength", undefined],
      ["unusable-value", "/forms/f/fields/n/rules/min", undefined],
      ["unusable-value", "/forms/f/fields/n/initialValue", undefined],
      ["unusable-value", "/forms/f/fields/d/rules/max", undefined],
      ["unusable-value", "/forms/f/fields/d/initialValue", undefined],
      ["unusable-value", "/forms/f/fields/t/rules/pattern", undefined],
      ["undeclared-name", "/forms/f/fields/b/initialValue/$ref", undefined],
    ]);
  });

  it("warns on keys out of streaming order, the depth cap, long handler lists and deep onSuccess chains", () => {
    let chain: unknown = { action: "showToast", payload: { title: "done" } };
    for (let i = 0; i <= LIMITS.actionDepth; i += 1) chain = { action: "apiCall", payload: { endpoint: "/x", onSuccess: chain } };
    const many = Array.from({ length: LIMITS.actionsPerHandler + 1 }, () => ({ action: "showToast", payload: { title: "x" } }));
    const value = {
      root: { children: ["x"], component: "Card", props: {} },
      version: 2,
      title: "t",
      forms: { f: { fields: {}, onSubmit: chain } },
    };
    const found = warnings({ ...value, root: { ...value.root, props: { onClick: many } } });
    expect(found).toEqual([
      ["key-order", "", undefined],
      ["limit-exceeded", `/forms/f/onSubmit${"/payload/onSuccess".repeat(LIMITS.actionDepth)}/payload/onSuccess`, undefined],
      ["key-order", "/root", undefined],
      ["limit-exceeded", "/root/props/onClick", undefined],
    ]);
  });

  it("refuses sensitive components unless the host allows them", () => {
    const value = doc({ component: "Stack", children: [{ component: "PasswordInput" }, { component: "OTPInput" }] });
    expect(warnings(value).map(([code, path]) => [code, path])).toEqual([
      ["sensitive-component", "/root/children/0/component"],
      ["sensitive-component", "/root/children/1/component"],
    ]);
    expect(warnings(value, { allowSensitive: ["OTPInput"] }).map(([, path]) => path)).toEqual(["/root/children/0/component"]);
    expect(warnings(value, { allowSensitive: true })).toEqual([]);
  });
});
