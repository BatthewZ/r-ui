/**
 * Values a document writes as JSON that components take in another shape,
 * driven by the contracts. A capture component (with its own contract) shows
 * exactly what a component receives; library components show the result.
 */

import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { defaultContracts, extendContracts } from "../contracts";
import { defaultRegistry, extendRegistry } from "../registry/registry";
import type { ComponentContract } from "../spec/types";
import { queryDiagnostics, stubDialog } from "../../test-utils";
import { renderTree } from "./harness.test.helpers";

function capture(contract: Partial<ComponentContract>) {
  const received: Record<string, unknown>[] = [];
  function Capture(props: Record<string, unknown>) {
    received.push(props);
    return null;
  }
  return {
    received,
    last: () => received.at(-1) ?? {},
    registry: extendRegistry(defaultRegistry, { Capture }),
    contracts: extendContracts(defaultContracts, { Capture: contract }),
  };
}

describe("ISO dates", () => {
  it("coerces date props through $ref, refuses an impossible one, and converts nested and ranged paths", () => {
    const probe = capture({ dateProps: { when: "date", span: "dateRange", "x[]": "datetime", "rules.*": "dateRange" } });
    const view = renderTree(
      {
        component: "Stack",
        children: [
          {
            component: "Capture",
            props: {
              when: { $ref: "data.day" },
              span: { start: "2026-01-01", end: "2026-01-31", preset: "custom" },
              x: ["2026-03-01", "Mon", 5],
              rules: { a: { start: "2026-01-01", end: "2026-01-02" }, b: "text" },
            },
          },
          { component: "Capture", props: { when: "2026-02-30" } },
        ],
      },
      { data: { day: "2026-11-02" }, registry: probe.registry, contracts: probe.contracts },
    );
    const [first, second] = probe.received;
    expect(first?.when).toEqual(new Date(2026, 10, 2));
    expect(first?.span).toEqual({ start: new Date(2026, 0, 1), end: new Date(2026, 0, 31), preset: "custom" });
    expect(first?.x).toEqual([new Date(2026, 2, 1), "Mon", 5]);
    expect(first?.rules).toEqual({ a: { start: new Date(2026, 0, 1), end: new Date(2026, 0, 2) }, b: "text" });
    expect(second).not.toHaveProperty("when");
    expect(view.issuesOf("invalid-prop-value")).toEqual([["/root/children/1/props/when", false]]);
  });
});

describe("Sets", () => {
  it("turns an array into the Set the component takes", () => {
    const probe = capture({ setProps: ["keys", "groups[].keys"] });
    renderTree(
      { component: "Capture", props: { keys: { $ref: "data.keys" }, groups: [{ keys: ["x"] }] } },
      { data: { keys: ["a", "b"] }, registry: probe.registry, contracts: probe.contracts },
    );
    expect(probe.last().keys).toEqual(new Set(["a", "b"]));
    expect(probe.last().groups).toEqual([{ keys: new Set(["x"]) }]);
  });

  it("selects DataTable rows from an array of keys", () => {
    renderTree({
      component: "DataTable",
      props: {
        "aria-label": "Services",
        rows: [{ id: "a" }, { id: "b" }],
        rowKey: "id",
        selectable: true,
        defaultSelectedKeys: ["b"],
        columns: [{ id: "id", header: "Id" }],
      },
    });
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.map((box) => box.checked)).toEqual([false, false, true]);
  });
});

describe("icon names", () => {
  it("renders an icon prop's name as the icon, and a missing name as a diagnostic at its path", () => {
    const view = renderTree({
      component: "Stack",
      children: [
        { component: "Button", props: { iconStart: { $ref: "data.icon" } }, children: ["Save"] },
        { component: "Button", props: { iconStart: "no-such-icon" }, children: ["Load"] },
        { component: "Icon", props: { name: "also-missing" } },
      ],
    }, { data: { icon: "check" } });
    expect(screen.getByRole("button", { name: "Save" }).querySelector("svg")).not.toBeNull();
    expect(queryDiagnostics().map(({ code, path }) => [code, path])).toEqual([
      ["unknown-icon", "/root/children/1/props/iconStart"],
      ["unknown-icon", "/root/children/2/props/name"],
    ]);
    expect(document.querySelectorAll(".r-renderer-missing-icon")).toHaveLength(2);
    expect(view.issuesOf("unknown-icon")).toEqual([
      ["/root/children/1/props/iconStart", true],
      ["/root/children/2/props/name", true],
    ]);
  });
});

describe("FormatSpecs", () => {
  it("makes a formatter function from a FormatSpec, in the host's locale", () => {
    const probe = capture({ formatProps: ["format", "formatTick"] });
    renderTree(
      { component: "Capture", props: { format: { style: "percent", maximumFractionDigits: 0 }, formatTick: "compact" } },
      { registry: probe.registry, contracts: probe.contracts, env: { locale: "en-US" } },
    );
    const { format, formatTick } = probe.last() as Record<string, (value: unknown) => string>;
    expect(format?.(0.256)).toBe("26%");
    expect(format?.(null)).toBe("—");
    expect(formatTick?.(1_234_567)).toBe("1.2M");
  });

  it("formats dates, keeping a bare date on its calendar day, and $format values in props", () => {
    renderTree(
      {
        component: "Stack",
        children: [
          { $format: { value: "2026-11-02", style: "date", dateStyle: "medium" } },
          " | ",
          { $format: { value: 1536, style: "bytes" } },
          " | ",
          { $format: { value: "n/a", style: "number", missing: "none" } },
          " | ",
          { component: "StatCard", props: { label: "Cost", value: { $format: { value: 12, style: "currency", currency: "USD" } } } },
        ],
      },
      { env: { locale: "en-US" } },
    );
    expect(document.body.textContent).toContain("Nov 2, 2026 | 1.5 kB | none | ");
    expect(screen.getByText("$12.00")).toBeInTheDocument();
  });

  it("drops a formatter prop that is no FormatSpec, and reports options Intl refuses", () => {
    const probe = capture({ formatProps: ["format", "other"] });
    const view = renderTree(
      { component: "Capture", props: { format: { style: "loud" }, other: { style: "currency", currency: "nope" } } },
      { registry: probe.registry, contracts: probe.contracts, env: { locale: "en-US" } },
    );
    expect(probe.last()).not.toHaveProperty("format");
    expect((probe.last().other as (value: unknown) => string)(5)).toBe("5");
    expect(view.issuesOf("invalid-prop-value")).toEqual([
      ["/root/props/format", false],
      ["/root/props/other", false],
    ]);
  });

  it("shows the default missing text for a `missing` that is not text, leaving the node's siblings standing", () => {
    const view = renderTree({
      component: "Stack",
      children: [{ component: "Text", children: ["Before"] }, { $format: { value: null, style: "number", missing: { text: "none" } } }],
    });
    expect(view.issuesOf("render-error")).toEqual([]);
    expect(view.container.textContent).toBe("Before—");
  });
});

describe("DataTable columns", () => {
  const rows = [
    { id: "a", name: "Alpha", billing: { monthly: 1200 }, status: "ok" },
    { id: "b", name: "Beta", billing: { monthly: 30 }, status: "degraded" },
  ];
  const table = (columns: unknown, extra: Record<string, unknown> = {}) => ({
    component: "DataTable",
    props: { "aria-label": "Services", rows: { $ref: "data.rows" }, rowKey: "id", columns, ...extra },
  });

  it("reads `field` paths, formats them, and renders `cell` templates with row, rowIndex and value", () => {
    const view = renderTree(
      table([
        { id: "name", header: "Service" },
        { id: "cost", header: "Cost", field: "billing.monthly", numeric: true, format: { style: "currency", currency: "USD" } },
        {
          id: "status",
          header: "Status",
          cell: { $node: { component: "Text", props: { as: "span" }, children: [{ $ref: "rowIndex" }, "-", { $ref: "value" }, "-", { $ref: "row.id" }] } },
        },
        { id: "extra", wrap: true },
      ]),
      { data: { rows }, env: { locale: "en-US" } },
    );
    const body = screen.getAllByRole("rowgroup")[1] as HTMLElement;
    const cells = within(body).getAllByRole("row").map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent));
    expect(cells).toEqual([
      ["Alpha", "$1,200.00", "0-ok-a", "—"],
      ["Beta", "$30.00", "1-degraded-b", "—"],
    ]);
    expect(view.issuesOf("unknown-prop")).toEqual([["/root/props/columns/3/wrap", false]]);
  });

  it("sorts by the raw value, not the formatted text", () => {
    renderTree(table([{ id: "cost", header: "Cost", field: "billing.monthly", numeric: true, sortable: true, format: "compact" }]), {
      data: { rows: [{ id: "a", billing: { monthly: 900 } }, { id: "b", billing: { monthly: 1_000_000 } }, { id: "c", billing: { monthly: 5000 } }] },
      env: { locale: "en-US" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Cost/ }));
    const body = screen.getAllByRole("rowgroup")[1] as HTMLElement;
    expect(within(body).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["1M", "5K", "900"]);
  });

  it("keys rows by `rowKey`, falling back to positions on a repeat and reporting it once", () => {
    const view = renderTree(table([{ id: "name" }]), {
      data: { rows: [{ id: "a", name: "A" }, { id: "a", name: "B" }, { name: "C" }] },
    });
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(view.issuesOf("duplicate-key")).toEqual([["/root/props/rowKey", false]]);
  });

  it("refuses a column with no id, an unsafe width and a custom filter, keeping the rest", () => {
    const view = renderTree(
      table([
        { header: "No id" },
        { id: "name", width: "url(https://evil.test/x)", minWidth: "calc(8ch + var(--R-SIZE-3) * 2)" },
        { id: "status", filter: { type: "custom", render: "x" } },
      ]),
      { data: { rows } },
    );
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["name", "status"]);
    expect(view.issuesOf("invalid-prop-value")).toEqual([
      ["/root/props/columns/0", false],
      ["/root/props/columns/1/width", false],
      ["/root/props/columns/2/filter", false],
    ]);
  });

  it("renders rowActions and bulkActions templates with the row and the selected keys as an array", () => {
    const view = renderTree(
      table([{ id: "name" }], {
        selectable: true,
        rowActions: { $node: { component: "Button", props: { "aria-label": { $ref: "row.name" } }, children: ["Open"] } },
        bulkActions: {
          $node: {
            component: "Button",
            props: { onClick: { action: "setState", payload: { path: "state.restart", value: { $ref: "selectedKeys" } } } },
            children: ["Restart ", { $ref: "selectedKeys.length" }],
          },
        },
      }),
      { data: { rows } },
    );
    expect(screen.getByRole("button", { name: "Beta" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("checkbox")[2] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Restart 1" }));
    expect(view.dispatch).toHaveBeenCalledTimes(1);
    expect(view.dispatch.mock.calls[0]?.[1].vars).toMatchObject({ selectedKeys: ["b"] });
  });
});

describe("choices and delimiters", () => {
  it("renders Select options as <option> children, before any the document wrote", () => {
    const view = renderTree({
      component: "Select",
      props: { "aria-label": "Region", options: [{ value: "eu", label: "Europe" }, "us", { value: 3 }] },
    });
    const select = screen.getByRole("combobox", { name: "Region" });
    expect([...select.querySelectorAll("option")].map((option) => [option.value, option.textContent])).toEqual([
      ["eu", "Europe"],
      ["us", "us"],
    ]);
    expect(view.issuesOf("invalid-prop-value")).toEqual([["/root/props/options", false]]);
  });

  it("turns delimiter characters into a RegExp that matches only those characters", () => {
    const probe = capture({ coercions: { delimiter: { kind: "delimiter" } } });
    renderTree({ component: "Capture", props: { delimiter: ",;]" } }, { registry: probe.registry, contracts: probe.contracts });
    const pattern = probe.last().delimiter as RegExp;
    expect(["a,b", "a;b", "a]b", "a.b", "a\\b"].map((text) => pattern.test(text))).toEqual([true, true, true, false, false]);
  });
});

describe("dialogs", () => {
  let dialog: ReturnType<typeof stubDialog>;
  beforeEach(() => {
    dialog = stubDialog();
  });
  afterEach(() => {
    dialog.restore();
  });

  it("owns open from the first render, seeded by defaultOpen and written by onOpenChange", () => {
    const view = renderTree({
      component: "Dialog",
      props: { dialogId: "details", defaultOpen: true, open: false, onOpenChange: { action: "setState", payload: { path: "state.x", value: 1 } } },
      children: [{ component: "Dialog.Content", children: [{ component: "Dialog.Title", children: ["Details"] }, { component: "Dialog.Close", children: ["Done"] }] }],
    });
    expect(view.container.querySelector("dialog")).toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "Done", hidden: true }));
    expect(view.container.querySelector("dialog[open]")).toBeNull();
    expect(view.dispatch).toHaveBeenCalledTimes(1);
    expect(view.dispatch.mock.calls[0]?.[1].args).toEqual([false]);
    expect(view.issuesOf("forbidden-prop")).toEqual([["/root/props/open", false]]);
  });
});
