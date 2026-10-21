// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { defaultContracts, extendContracts, LIBRARY_COMPONENTS, NOT_ADDRESSABLE } from "../contracts";
import { isDocumentProp } from "../spec/contract-facts";
import type { ComponentContracts } from "../spec/types";
import { validateViewSpec } from "../spec/validate";
import { CLASS_VOCABULARY, ICON_NAMES } from "../spec/vocabulary";
import { CATEGORY_TITLES } from "./categories";
import { renderReferenceRegions, renderViewSpecReference, scopeContracts } from "./index";
import { emptyRegions, fillRegions, regionNames } from "./regions";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SHIPPED = readFileSync(join(PKG, "VIEWSPEC.md"), "utf8");
const MARKERS = ["classes", "issue-codes", "components", "not-addressable", "icons"];

function region(doc: string, name: string): string {
  const match = new RegExp(`<!-- GENERATED:${name} -->\\n([\\s\\S]*?)\\n<!-- /GENERATED:${name} -->`).exec(doc);
  if (!match) throw new Error(`no ${name} region`);
  return match[1] as string;
}

const rowFor = (name: string) => `| \`${name}\` |`;

describe("renderViewSpecReference", () => {
  it("unscoped, is the shipped VIEWSPEC.md byte for byte, every region written by its renderer", () => {
    const doc = renderViewSpecReference();
    expect(doc).toBe(SHIPPED);
    expect(regionNames(doc)).toEqual(MARKERS);
    const regions = renderReferenceRegions(defaultContracts);
    const expected = {
      classes: regions.classes,
      "issue-codes": regions.issueCodes,
      components: `${regions.components}\n\n${regions.slots}`,
      "not-addressable": regions.notAddressable,
      icons: regions.icons,
    };
    for (const name of MARKERS) {
      expect(region(doc, name).length, name).toBeGreaterThan(200);
      expect(region(doc, name), name).toBe(expected[name as keyof typeof expected]);
    }
  });

  it("scoped, changes every region a scope or a host list reaches and keeps the other two whole", () => {
    const unscoped = renderViewSpecReference();
    const scoped = renderViewSpecReference({ include: ["Tabs.Panel", "Badge"], icons: ["check", "x"], classes: ["p-r1", "gap-r2"] });
    for (const name of ["components", "icons", "classes"]) expect(region(scoped, name), name).not.toBe(region(unscoped, name));
    // Absent from the format, not from this scope: the warning stays where a narrow scope needs it most.
    for (const name of ["issue-codes", "not-addressable"]) expect(region(scoped, name), name).toBe(region(unscoped, name));
    expect(region(scoped, "icons")).toBe("`check` `x`");
    expect(region(scoped, "classes")).toBe("- `gap-r2` `p-r1`");
    expect(emptyRegions(scoped)).toBe(emptyRegions(unscoped));
  });

  it("a part brings its root and every sibling; a root brings its parts; nothing else rides along", () => {
    const components = region(renderViewSpecReference({ include: ["Tabs.Panel"] }), "components");
    for (const name of ["Tabs", "Tabs.List", "Tabs.Panel", "Tabs.Tab"]) expect(components).toContain(rowFor(name));
    expect(components).toContain("| `Tabs` | `.List` `.Panel` `.Tab` |");
    const rows = new Set([...components.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]));
    expect([...rows].sort()).toEqual(["Tabs", "Tabs.List", "Tabs.Panel", "Tabs.Tab"]);
    const host: ComponentContracts = extendContracts(defaultContracts, {
      Gauge: { category: "gadgets" },
      "Gauge.Needle": { category: "gadgets" },
      GaugeGroup: { category: "gadgets" },
    });
    expect(Object.keys(scopeContracts(host, ["Gauge"]))).toEqual(["Gauge", "Gauge.Needle"]);
    expect(Object.keys(scopeContracts(host, ["Gauge.Needle"]))).toEqual(["Gauge", "Gauge.Needle"]);
  });

  it("refuses a name no contract holds, with the validator's suggestion or the exclusion's reason", () => {
    expect(() => renderViewSpecReference({ include: ["Crad"] })).toThrow('"Crad" (did you mean "Card"?)');
    expect(() => renderViewSpecReference({ include: ["AppShell"] })).toThrow(`not addressable: ${NOT_ADDRESSABLE.AppShell?.why}`);
    expect(() => renderViewSpecReference({ include: ["Badge", "Qzxv"] })).toThrow('components no contract holds: "Qzxv"');
    expect(() => renderViewSpecReference({ include: [] })).toThrow("is empty");
  });

  it("names the components the examples author that a scope drops, and nothing when unscoped", () => {
    const components = region(renderViewSpecReference({ include: ["Badge"] }), "components");
    expect(components).toMatch(/^\*\*This reference is scoped\.\*\* Its worked examples also author `Card`, `Form`, `Field`, `Field.Label`, `Input`, `Field.Error`, `FormActions`, `FormActions.Submit`, which are not documented here: they still render/);
    expect(components).not.toMatch(/also author[^\n]*`Badge`/);
    expect(region(SHIPPED, "components")).not.toContain("This reference is scoped");
  });

  it("an emptied table says so instead of showing a bare header", () => {
    expect(defaultContracts.Kbd?.slots).toBeUndefined();
    const components = region(renderViewSpecReference({ include: ["Kbd"] }), "components");
    expect(components).toContain("_No component in this reference takes `classNames`._");
    expect(components).not.toContain("| Component | Keys |");
    const empty = renderViewSpecReference({ include: ["Kbd"], icons: [], classes: [] });
    expect(region(empty, "icons")).toMatch(/^_This icon set is empty/);
    expect(region(empty, "classes")).toMatch(/^_The class vocabulary is empty/);
  });

  it("writes no direction into generated sentences: they cannot see where they land", () => {
    const sentences = [
      region(renderViewSpecReference({ include: ["Kbd"] }), "components").split("\n")[0],
      region(renderViewSpecReference({ include: ["Kbd"] }), "components").split("\n").at(-1),
      region(renderViewSpecReference({ include: ["Kbd"], icons: [] }), "icons"),
      region(renderViewSpecReference({ include: ["Kbd"], classes: [] }), "classes"),
    ];
    expect(sentences[0]).toContain("This reference is scoped");
    for (const sentence of sentences) expect(sentence).not.toMatch(/\b(above|below|following|preceding|earlier|later)\b/i);
  });
});

describe("the component tables", () => {
  const components = region(SHIPPED, "components");

  it("the shipped VIEWSPEC.md has a row for every component and part, under a titled section", () => {
    const names = Object.keys(defaultContracts);
    expect(names.length).toBeGreaterThan(150);
    for (const name of names) expect(components, name).toContain(rowFor(name));
    const unnamed = [...new Set(names.map((name) => defaultContracts[name]?.category))].filter(
      (category) => category === undefined || !Object.hasOwn(CATEGORY_TITLES, category),
    );
    expect(unnamed).toEqual([]);
  });

  it("a category no title names still renders, after the named ones", () => {
    const host = extendContracts(defaultContracts, { Gauge: { category: "gadgets", props: [{ name: "turn", type: "number", required: true }] } });
    const tables = renderReferenceRegions(host).components;
    expect(tables.indexOf("### Motion")).toBeGreaterThan(0);
    expect(tables.indexOf("### gadgets")).toBeGreaterThan(tables.indexOf("### Motion"));
    expect(tables).toContain("| `Gauge` | — | `turn`: number |  |");
  });

  it("lists props as a document writes them", () => {
    const rowOf = (name: string) => components.split("\n").find((line) => line.startsWith(rowFor(name))) ?? "";
    expect(rowOf("DataTable")).toContain("`rowActions?`: template (row, rowIndex)");
    expect(rowOf("DataTable")).toContain("`selectedKeys?`: RowKey[]");
    expect(rowOf("DataTable")).toContain("`onSortChange?`: handler");
    expect(rowOf("StatCard")).toContain("`formatDelta?`: FormatSpec");
    expect(rowOf("Button")).toContain("`iconStart?`: icon name");
    expect(rowOf("Calendar")).toContain("`value?`: ISO date ");
    expect(rowOf("RangeCalendar")).toContain("`value?`: { start, end } of ISO dates");
    expect(rowOf("Pricing")).toContain("`currency`: ISO 4217 code");
    expect(rowOf("Form")).toContain("`form`: form name");
    expect(rowOf("Field")).toContain("`name?`: field name");
    expect(rowOf("Popover.Content")).toContain("`initialFocus?`: number ");
    expect(rowOf("Heading")).toContain("`level?`: 1 \\| 2 \\| 3 \\| 4 \\| 5 \\| 6");
    expect(rowOf("Card.Title")).toContain('`as?`: "h2" \\| ');
    expect(rowOf("StatCard")).toContain("`label`: node");
    // Required first.
    expect(rowOf("Image").indexOf("`width`")).toBeLessThan(rowOf("Image").indexOf("`fit?`"));
  });

  it("omits exactly the props the validator reports as forbidden, component by component", () => {
    const listed: string[] = [];
    const omitted: string[] = [];
    const children = Object.entries(defaultContracts).map(([name, contract]) => {
      const props: Record<string, unknown> = {};
      // What the library declares too: the contracts already leave out what is always dropped.
      const declared = [...(LIBRARY_COMPONENTS[name]?.props ?? []), ...(contract.props ?? [])].map((doc) => doc.name);
      for (const prop of new Set(declared)) {
        props[prop] = /^on[A-Z]/.test(prop) ? { action: "setState", payload: { path: "state.x", value: 1 } } : "x";
        (isDocumentProp(contract, prop) ? listed : omitted).push(`${name} ${prop}`);
      }
      return { component: name, props };
    });
    const result = validateViewSpec({ version: 2, title: "Every prop", root: { component: "Stack", children } });
    const flagged = new Set(
      result.issues
        .filter((issue) => issue.code === "forbidden-prop" || /nothing a document can write/.test(issue.message))
        .map((issue) => {
          const [, index, prop] = /^\/root\/children\/(\d+)\/props\/([^/]+)$/.exec(issue.path) ?? [];
          return `${Object.keys(defaultContracts)[Number(index)]} ${prop}`;
        }),
    );
    expect(omitted).toContain("Dialog open");
    expect(listed.length).toBeGreaterThan(800);
    expect(listed.filter((entry) => flagged.has(entry))).toEqual([]);
    expect(omitted.filter((entry) => !flagged.has(entry))).toEqual([]);
  });

  it("propLimit hides the tail behind a count; describeProps adds each prop's sentence", () => {
    const limited = renderReferenceRegions(defaultContracts, { propLimit: 2 }).components;
    const row = limited.split("\n").find((line) => line.startsWith(rowFor("DataTable"))) ?? "";
    const total = (defaultContracts.DataTable?.props ?? []).filter((prop) => isDocumentProp(defaultContracts.DataTable ?? { category: "" }, prop.name)).length;
    expect(row).toContain(` · +${total - 2} more |`);
    for (const bad of [0, -1, 1.5, Number.NaN]) expect(() => renderReferenceRegions(defaultContracts, { propLimit: bad })).toThrow("propLimit");

    const described = renderReferenceRegions(scopeContracts(defaultContracts, ["Accordion", "DataTable"]), { describeProps: true }).components;
    // From the generated prop docs, and from a curated document prop.
    expect(described).toContain("`collapsible?`: boolean — Whether the open item can be closed again, leaving none open.<br>");
    expect(described).toContain("`rowKey?`: string — A field path whose value identifies a row");
    expect(region(SHIPPED, "components")).not.toContain("Whether the open item can be closed again");
  });
});

describe("the list regions", () => {
  it("issue codes carry severity and mark the render-only ones", () => {
    const codes = region(SHIPPED, "issue-codes");
    expect(codes).toContain("| `invalid-json` | error | The text is not JSON. |");
    expect(codes).toContain("| `data-error` | error | A data binding failed. Reported only while rendering. |");
    expect(codes).not.toMatch(/`key-order`[^\n]*rendering/);
  });

  it("not-addressable lists every exclusion with its reason; icons and classes list the shipped vocabularies", () => {
    const table = region(SHIPPED, "not-addressable");
    for (const [name, { why }] of Object.entries(NOT_ADDRESSABLE)) expect(table).toContain(`| \`${name}\` | ${why.replace(/\|/g, "\\|")} |`);
    const icons = region(SHIPPED, "icons");
    for (const name of ICON_NAMES) expect(icons).toContain(`\`${name}\``);
    const classes = region(SHIPPED, "classes");
    expect(classes.match(/`[^`]+`/g)).toHaveLength(CLASS_VOCABULARY.length);
    expect(classes).toContain("- `p-0` `p-r1` `p-r2` `p-r3` `p-r4` `p-r5` `p-r6`\n");
  });
});

describe("regions", () => {
  it("fills every region and refuses a body for a region the document lacks, or a region with no body", () => {
    const doc = "a\n<!-- GENERATED:one -->\nold\n<!-- /GENERATED:one -->\nb\n<!-- GENERATED:two -->\n<!-- /GENERATED:two -->\n";
    expect(fillRegions(doc, { one: "1 $& $1", two: "2" })).toBe(
      "a\n<!-- GENERATED:one -->\n1 $& $1\n<!-- /GENERATED:one -->\nb\n<!-- GENERATED:two -->\n2\n<!-- /GENERATED:two -->\n",
    );
    expect(() => fillRegions(doc, { one: "1" })).toThrow("nothing renders the document's GENERATED region(s): two");
    expect(() => fillRegions(doc, { one: "1", two: "2", three: "3" })).toThrow("no GENERATED region for: three");
    expect(emptyRegions(doc)).toBe("a\n<!-- GENERATED:one -->\n<!-- /GENERATED:one -->\nb\n<!-- GENERATED:two -->\n<!-- /GENERATED:two -->\n");
  });
});

describe("the shipped VIEWSPEC.md", () => {
  it("names no example theme", () => {
    // The names are read off the CSS package's examples, so none is written here.
    const themes = readdirSync(join(PKG, "node_modules", "@batthewz", "r-ui-css", "src", "examples", "themes"))
      .filter((file) => file.endsWith(".css"))
      .map((file) => file.slice(0, -4));
    expect(themes.length).toBeGreaterThan(0);
    for (const theme of themes) expect(SHIPPED.toLowerCase(), theme).not.toContain(theme.toLowerCase());
  });
});
