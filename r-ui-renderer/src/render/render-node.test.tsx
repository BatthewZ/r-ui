import { screen } from "@testing-library/react";
import { createElement, type ReactNode, useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { extendContracts, defaultContracts } from "../contracts";
import { extendRegistry, defaultRegistry } from "../registry/registry";
import { PENDING } from "../stream/pending";
import { createMountProbe, queryDiagnostics, stubDialog } from "../../test-utils";
import { renderTree, streamTree } from "./harness.test.helpers";

function withProbe() {
  const probe = createMountProbe();
  return { probe, registry: extendRegistry(defaultRegistry, { Probe: probe.Probe }) };
}

describe("text, $ref and $format nodes", () => {
  it("renders text, a $ref's text or number, and nothing for null, false or missing", () => {
    const view = renderTree(
      {
        component: "Stack",
        children: [
          "Hello ",
          { $ref: "data.user.name" },
          " ",
          { $ref: "data.user.visits" },
          { $ref: "data.user.none" },
          { $ref: "data.user.off" },
          { $ref: "data.nothing.here" },
        ],
      },
      { data: { user: { name: "Ada", visits: 12, none: null, off: false } } },
    );
    expect(view.container.textContent).toBe("Hello Ada 12");
    expect(view.reported).toEqual([]);
  });

  it("reports an object under a $ref as not-renderable, at the node's path, and renders nothing", () => {
    const view = renderTree({ component: "Stack", children: ["a", { $ref: "data.user" }] }, { data: { user: { name: "Ada" } } });
    expect(view.container.textContent).toBe("a");
    expect(view.issuesOf("not-renderable")).toEqual([["/root/children/1", false]]);
  });

  it("formats a $format node in the host's locale", () => {
    const view = renderTree(
      { $format: { value: { $ref: "data.cost" }, style: "currency", currency: "EUR" } },
      { data: { cost: 1234.5 }, env: { locale: "de-DE" } },
    );
    expect(view.container.textContent).toBe("1.234,50\u00a0€");
  });

  it("never reaches a prototype through a $ref", () => {
    const view = renderTree(
      { component: "Stack", children: [{ $ref: "data.list.constructor.name" }, { $ref: "data.user.__proto__" }] },
      { data: { list: [], user: { name: "Ada" } } },
    );
    expect(view.container.textContent).toBe("");
    expect(view.reported).toEqual([]);
  });
});

describe("$each", () => {
  const rows = [
    { id: "a", name: "Alpha" },
    { id: "b", name: "Beta" },
    { id: "c", name: "Gamma" },
  ];

  it("renders the node once per element as siblings, with the alias and its index in scope", () => {
    const view = renderTree(
      {
        component: "Stack",
        props: { as: "ul" },
        children: [
          {
            $each: "data.rows",
            as: "row",
            key: "id",
            node: { component: "Text", props: { as: "span" }, children: [{ $ref: "rowIndex" }, ":", { $ref: "row.name" }] },
          },
        ],
      },
      { data: { rows } },
    );
    const list = view.container.querySelector("ul");
    expect([...(list?.children ?? [])].map((child) => child.textContent)).toEqual(["0:Alpha", "1:Beta", "2:Gamma"]);
  });

  it("keys elements by `key`, so reordering keeps each one mounted", () => {
    const { probe, registry } = withProbe();
    const node = {
      $each: "data.rows",
      as: "row",
      key: "id",
      node: { component: "Probe", props: { probeId: { $ref: "row.id" } }, children: [{ $ref: "row.name" }] },
    };
    const contracts = extendContracts(defaultContracts, { Probe: {} });
    const view = renderTree({ component: "Stack", children: [node] }, { data: { rows }, registry, contracts });
    view.update({ component: "Stack", children: [node] }, { data: { rows: [rows[2], rows[0], rows[1]] } });
    expect(view.container.textContent).toBe("GammaAlphaBeta");
    for (const id of ["a", "b", "c"]) expect(probe.counts(id)).toMatchObject({ mounts: 1, unmounts: 0 });
  });

  it("falls back to positions on a repeated key (1 and \"1\" are one key) and reports duplicate-key at the key's path", () => {
    const view = renderTree(
      { component: "Stack", children: [{ $each: "data.rows", as: "row", key: "id", node: { $ref: "row.name" } }] },
      { data: { rows: [{ id: 1, name: "x" }, { id: "1", name: "y" }] } },
    );
    expect(view.container.textContent).toBe("xy");
    expect(view.issuesOf("duplicate-key")).toEqual([["/root/children/0/key", false]]);
  });

  it("renders nothing for a missing source and reports a non-array one", () => {
    const view = renderTree(
      {
        component: "Stack",
        children: [
          { $each: "data.missing", as: "row", node: "x" },
          { $each: "data.text", as: "row", node: "y" },
        ],
      },
      { data: { text: "abc" } },
    );
    expect(view.container.textContent).toBe("");
    expect(view.issuesOf("not-renderable")).toEqual([["/root/children/1", false]]);
  });

  it("refuses an alias that is a scope root", () => {
    renderTree({ $each: "data.rows", as: "data", node: "x" }, { data: { rows: [1] } });
    expect(queryDiagnostics()).toEqual([
      { code: "invalid-name", path: "/root/as", severity: "error", text: "`as` is a name that is not a scope root." },
    ]);
  });
});

describe("$cond", () => {
  const cases: [unknown, boolean][] = [
    ["data.list", false],
    ["data.object", true],
    ["data.zero", false],
    [{ not: "data.zero" }, true],
    [{ ref: "data.tab", eq: "billing" }, true],
    [{ ref: "data.tab", ne: "billing" }, false],
    [{ ref: "data.count", gt: 3 }, true],
    [{ ref: "data.count", lt: { $ref: "data.limit" } }, true],
    [{ ref: "data.day", gt: "2026-01-31" }, true],
    [{ ref: "data.count", gt: "3" }, false],
    [{ ref: "data.tab", in: ["usage", "billing"] }, true],
    [{ ref: "data.pair", eq: [1, { a: 2 }] }, true],
  ];

  it.each(cases)("%j holds: %s", (condition, holds) => {
    const view = renderTree(
      { $cond: condition, then: "then", else: "else" },
      { data: { list: [], object: {}, zero: 0, tab: "billing", count: 5, limit: 10, day: "2026-02-01", pair: [1, { a: 2 }] } },
    );
    expect(view.container.textContent).toBe(holds ? "then" : "else");
  });

  it("renders nothing for a false condition with no else", () => {
    const view = renderTree({ $cond: "data.no", then: "then" });
    expect(view.container.textContent).toBe("");
  });
});

describe("$node in props", () => {
  it("renders a node where a component takes one, at any depth", () => {
    renderTree({
      component: "Card",
      children: [
        {
          component: "Alert",
          props: { title: { $node: { component: "Text", props: { as: "strong" }, children: ["Heads up"] } } },
          children: ["Body"],
        },
      ],
    });
    expect(screen.getByText("Heads up").tagName).toBe("STRONG");
  });
});

describe("unknown, excluded and malformed nodes", () => {
  it("renders a diagnostic in place for each, at the path that names the problem", () => {
    const view = renderTree({
      component: "Stack",
      children: [{ component: "Nope" }, { component: "AppShell" }, { component: "Card", $ref: "data.x" }, 42],
    });
    expect(queryDiagnostics().map(({ code, path }) => [code, path])).toEqual([
      ["unknown-component", "/root/children/0/component"],
      ["not-addressable", "/root/children/1/component"],
      ["invalid-node", "/root/children/2"],
      ["invalid-node", "/root/children/3"],
    ]);
    expect(view.reported.every((entry) => entry.inPlace)).toBe(true);
  });

  it("caps nesting at 50 levels with a limit-exceeded diagnostic", () => {
    let node: unknown = "deep";
    for (let level = 0; level < 60; level += 1) node = { component: "Stack", children: [node] };
    renderTree(node);
    const found = queryDiagnostics();
    expect(found).toHaveLength(1);
    expect(found[0]?.code).toBe("limit-exceeded");
    expect(found[0]?.path?.split("/children/").length).toBe(52);
  });

  it("inside table structure, reports to the issue log instead of rendering an element", () => {
    const view = renderTree({
      component: "Table",
      props: { "aria-label": "t" },
      children: [{ component: "Table.Body", children: [{ component: "Nope" }] }],
    });
    expect(queryDiagnostics()).toEqual([]);
    expect(view.issuesOf("unknown-component")).toEqual([["/root/children/0/children/0/component", false]]);
  });

  it("does the same inside a list a layout component renders (`as: ul`)", () => {
    const view = renderTree({ component: "Stack", props: { as: "ul" }, children: [{ component: "Nope" }] });
    expect(view.container.querySelector("ul")?.children).toHaveLength(0);
    expect(view.issuesOf("unknown-component")).toEqual([["/root/children/0/component", false]]);
  });
});

describe("per-node error boundaries", () => {
  function Fragile(props: { value?: unknown; children?: ReactNode }): ReactNode {
    if (typeof props.value !== "string") throw new Error(`bad value: ${String(props.value)}`);
    return createElement("span", { "data-testid": "fragile" }, props.value);
  }
  const registry = extendRegistry(defaultRegistry, { Fragile });
  const contracts = extendContracts(defaultContracts, { Fragile: {} });
  const doc = {
    component: "Stack",
    children: [{ component: "Fragile", props: { value: { $ref: "data.value" } } }, "sibling"],
  };

  it("contains a throw to its node, and recovers when the bad value is fixed (it never remembers)", () => {
    const view = renderTree(doc, { data: { value: 7 }, registry, contracts, throws: true });
    expect(queryDiagnostics().map(({ code, path, text }) => [code, path, text])).toEqual([
      ["render-error", "/root/children/0", "bad value: 7"],
    ]);
    expect(screen.getByText("sibling")).toBeInTheDocument();
    expect(view.issuesOf("render-error")).toEqual([["/root/children/0", true]]);
    view.update(doc, { data: { value: "fixed" } });
    expect(queryDiagnostics()).toEqual([]);
    expect(screen.getByTestId("fragile")).toHaveTextContent("fixed");
  });
});

describe("streaming", () => {
  it("renders PENDING as nothing, or as a Skeleton placeholder when the view opts in", () => {
    const doc = { component: "Stack", children: ["ready", PENDING] };
    const quiet = renderTree(doc, { streaming: { complete: false, pending: new Set(["/root", "/root/children/1"]) } });
    expect(quiet.container.querySelector(".r-renderer-pending")).toBeNull();
    quiet.unmount();
    const shown = renderTree(doc, {
      streaming: { complete: false, pending: new Set(["/root", "/root/children/1"]), fallback: "skeleton" },
    });
    expect(shown.container.querySelectorAll(".r-renderer-pending")).toHaveLength(1);
    expect(shown.container.textContent).toBe("ready");
  });

  it("returns the same element for an unchanged node object, so a closed subtree does not re-render", () => {
    const { probe, registry } = withProbe();
    const contracts = extendContracts(defaultContracts, { Probe: {} });
    const closed = { component: "Probe", props: { probeId: "closed" }, children: ["done"] };
    const view = renderTree({ component: "Stack", children: [closed, "par"] }, { registry, contracts });
    view.update({ component: "Stack", children: [closed, "partial text"] });
    expect(view.container.textContent).toBe("donepartial text");
    expect(probe.counts("closed")).toEqual({ mounts: 1, unmounts: 0, renders: 1 });
  });

  it("keeps a coercion's leading elements in one slot, so the document's children never shift", () => {
    const { probe, registry } = withProbe();
    function Opts(props: { children?: ReactNode }): ReactNode {
      return createElement("div", null, props.children);
    }
    const contracts = extendContracts(defaultContracts, { Opts: { coercions: { options: { kind: "options" } } }, Probe: {} });
    const doc = {
      component: "Opts",
      props: { options: { $ref: "data.choices" } },
      children: [{ component: "Probe", props: { probeId: "child" } }],
    };
    const view = renderTree(doc, { registry: extendRegistry(registry, { Opts }), contracts });
    view.update(doc, { data: { choices: [{ value: "a", label: "A" }] } });
    expect(view.container.querySelectorAll("option")).toHaveLength(1);
    expect(probe.counts("child")).toMatchObject({ mounts: 1, unmounts: 0 });
  });

  it("keeps a closed node inside an $each item from re-rendering while its item's node still grows", () => {
    const { probe, registry } = withProbe();
    const contracts = extendContracts(defaultContracts, { Probe: {} });
    const closed = { component: "Probe", props: { probeId: { $ref: "row.id" } } };
    const doc = (tail: string) => ({
      component: "Stack",
      children: [{ $each: "data.rows", as: "row", node: { component: "Stack", children: [closed, tail] } }],
    });
    const view = renderTree(doc("par"), { data: { rows: [{ id: "a" }, { id: "b" }] }, registry, contracts });
    view.update(doc("partial"));
    expect(view.container.textContent).toBe("partialpartial");
    for (const id of ["a", "b"]) expect(probe.counts(id)).toEqual({ mounts: 1, unmounts: 0, renders: 1 });
  });

  it("re-renders a memoised node when what it reads changes", () => {
    const node = { component: "Stack", children: [{ $ref: "data.n" }] };
    const view = renderTree(node, { data: { n: 1 } });
    view.update(node, { data: { n: 2 } });
    expect(view.container.textContent).toBe("2");
  });
});

describe("keys out of the streaming order", () => {
  let dialog: ReturnType<typeof stubDialog>;
  beforeEach(() => {
    dialog = stubDialog();
  });
  afterEach(() => {
    dialog.restore();
  });

  /** Keeps the `label` it mounted with, as a component reading a prop once would. */
  function stickyParts() {
    const mounts: (string | undefined)[] = [];
    function Sticky(props: { label?: string; children?: ReactNode }): ReactNode {
      const [first] = useState(props.label);
      useEffect(() => {
        mounts.push(first);
      }, [first]);
      return createElement("div", { "data-sticky": first ?? "none" }, props.children);
    }
    return {
      mounts,
      registry: extendRegistry(defaultRegistry, { Sticky }),
      contracts: extendContracts(defaultContracts, { Sticky: {} }),
    };
  }

  it("remounts a node once when its props arrive after its children, ending as the whole document renders", () => {
    const root = { component: "Sticky", children: ["body"], props: { label: "final" } };
    const streamed = stickyParts();
    const view = streamTree(JSON.stringify({ version: 2, root }), streamed);
    expect(streamed.mounts).toEqual([undefined, "final"]);
    const html = view.container.innerHTML;
    view.unmount();
    const whole = renderTree(root, stickyParts());
    expect(whole.container.innerHTML).toBe(html);
    expect(html).toContain('data-sticky="final"');
  });

  it("never remounts a node written without props", () => {
    const streamed = stickyParts();
    streamTree(JSON.stringify({ version: 2, root: { component: "Sticky", children: ["body"] } }), streamed);
    expect(streamed.mounts).toEqual([undefined]);
  });

  it("opens a Dialog whose defaultOpen arrives after its children", () => {
    const root = {
      component: "Dialog",
      children: [{ component: "Dialog.Content", children: [{ component: "Dialog.Title", children: ["Hi"] }] }],
      props: { defaultOpen: true },
    };
    const view = streamTree(JSON.stringify({ version: 2, root }));
    expect(view.container.querySelectorAll("dialog[open]")).toHaveLength(1);
  });

  it("keys $each items by a `key` written after `node` once it arrives: one remount, then as whole", () => {
    const { probe, registry } = withProbe();
    const contracts = extendContracts(defaultContracts, { Probe: {} });
    const data = { rows: [{ id: "a" }, { id: "b" }] };
    const root = {
      component: "Stack",
      children: [{ $each: "data.rows", as: "row", node: { component: "Probe", props: { probeId: { $ref: "row.id" } }, children: [{ $ref: "row.id" }] }, key: "id" }],
    };
    const view = streamTree(JSON.stringify({ version: 2, root }), { data, registry, contracts });
    for (const id of ["a", "b"]) expect(probe.counts(id)).toMatchObject({ mounts: 2, unmounts: 1 });
    const html = view.container.innerHTML;
    view.unmount();
    expect(renderTree(root, { data, registry, contracts }).container.innerHTML).toBe(html);
  });
});
