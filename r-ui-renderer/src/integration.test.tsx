/**
 * One realistic dashboard through every half of the package: the validator,
 * the render core, the runtime and forms, and the streaming parser. Each
 * claim is about the same document.
 */

import { DataTable, StatCard } from "@batthewz/r-ui-react-components";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMountProbe, queryDiagnostics, stubDialog } from "../test-utils";
import { icons } from "./icons";
import { defaultRegistry, extendRegistry } from "./registry/registry";
import type { RendererAdapters } from "./runtime/adapters";
import type { Issue, ViewSpec } from "./spec/types";
import { validateViewSpec } from "./spec/validate";
import { ViewRenderer } from "./ViewRenderer";

const SERVICES = [
  { id: "api", name: "Public API", billing: { monthly: 1200 }, status: "healthy" },
  { id: "jobs", name: "Batch jobs", billing: { monthly: 310.5 }, status: "degraded" },
];

const DASHBOARD: ViewSpec = {
  version: 2,
  title: "Service health",
  description: "Uptime, traffic and ownership of the platform's services.",
  density: "compact",
  state: { saved: null },
  data: {
    summary: { type: "static", value: { uptime: 0.9993, change: 0.0004, incidents: 3 } },
    traffic: {
      type: "static",
      value: { days: ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"], requests: [1200, 1350, 990, 1410] },
    },
    services: { type: "api", endpoint: "/api/services" },
  },
  forms: {
    owner: {
      fields: { team: { rules: { required: true, minLength: 2 }, message: "Name the owning team." } },
      onSubmit: {
        action: "apiCall",
        payload: {
          endpoint: "/api/owners",
          method: "POST",
          body: { $ref: "event.value" },
          into: "state.saved",
          onSuccess: { action: "closeDialog", payload: { dialogId: "editOwner" } },
        },
      },
    },
  },
  root: {
    component: "Stack",
    props: { gap: "r3" },
    children: [
      { component: "Heading", props: { level: 1 }, children: ["Service health"] },
      {
        component: "Text",
        props: { tone: "secondary" },
        children: [{ component: "Icon", props: { name: "arrow-up-right", label: "Trending up" } }, " Traffic is up this week."],
      },
      {
        component: "Grid",
        props: { gap: "r4", minColumn: "sm" },
        children: [
          {
            component: "StatCard",
            props: {
              label: "Uptime",
              value: { $format: { value: { $ref: "data.summary.uptime" }, style: "percent", maximumFractionDigits: 2 } },
              delta: { $ref: "data.summary.change" },
              formatDelta: { style: "percent", maximumFractionDigits: 2 },
              sentiment: "good",
            },
          },
          { component: "StatCard", props: { label: "Open incidents", value: { $ref: "data.summary.incidents" } } },
        ],
      },
      {
        component: "LineChart",
        props: {
          label: "Requests per day",
          x: { $ref: "data.traffic.days" },
          xType: "time",
          series: [{ name: "Requests", values: { $ref: "data.traffic.requests" } }],
          format: "compact",
        },
      },
      {
        $cond: { ref: "status.services", eq: "loading" },
        then: { component: "Skeleton" },
        else: {
          component: "DataTable",
          props: {
            caption: "Services",
            rows: { $ref: "data.services" },
            rowKey: "id",
            columns: [
              { id: "name", header: "Service" },
              { id: "cost", header: "Cost / mo", field: "billing.monthly", numeric: true, format: { style: "currency", currency: "USD" } },
              {
                id: "status",
                header: "Status",
                cell: { $node: { component: "Badge", props: { tone: "success", icon: "check" }, children: [{ $ref: "value" }] } },
              },
            ],
          },
        },
      },
      {
        component: "Inline",
        props: { gap: "r5" },
        children: [{ $each: "data.services", as: "service", key: "id", node: { component: "Badge", children: [{ $ref: "service.name" }] } }],
      },
      {
        component: "Button",
        props: { onClick: { action: "openDialog", payload: { dialogId: "editOwner" } } },
        children: ["Change owner"],
      },
      {
        component: "Dialog",
        props: { dialogId: "editOwner" },
        children: [
          {
            component: "Dialog.Content",
            children: [
              { component: "Dialog.Header", children: [{ component: "Dialog.Title", children: ["Change owner"] }] },
              {
                component: "Dialog.Body",
                children: [
                  {
                    component: "Form",
                    props: { form: "owner" },
                    children: [
                      {
                        component: "Field",
                        props: { name: "team" },
                        children: [
                          { component: "Field.Label", children: ["Team"] },
                          { component: "Input" },
                          { component: "Field.Error" },
                        ],
                      },
                      { component: "FormActions", children: [{ component: "FormActions.Submit", children: ["Save owner"] }] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

const TEXT = JSON.stringify(DASHBOARD);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch() {
  return vi.fn((url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    if (path === "/api/services" && (init?.method ?? "GET") === "GET") return Promise.resolve(json(SERVICES));
    if (path === "/api/owners" && init?.method === "POST") {
      return Promise.resolve(json({ errors: { team: "No team is called that." } }, 422));
    }
    return Promise.resolve(json({ message: "not found" }, 404));
  });
}

/** The view's markup with React's generated ids blanked: two mounts of one document differ only there. */
function markup(container: HTMLElement): string {
  return container.innerHTML.replace(/ (id|for|aria-labelledby|aria-describedby|aria-controls|aria-errormessage|name)="[^"]*"/g, ' $1=""');
}

describe("a dashboard document, end to end", () => {
  let dialogs: ReturnType<typeof stubDialog>;
  beforeEach(() => {
    dialogs = stubDialog();
  });
  afterEach(() => {
    dialogs.restore();
    vi.unstubAllGlobals();
  });

  it("validates with no issue at all", () => {
    const result = validateViewSpec(TEXT);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("renders with no diagnostic anywhere in the page, its data bound, formatted and templated", async () => {
    const issues: Issue[] = [];
    const fetch = stubFetch();
    const { container } = render(<ViewRenderer spec={DASHBOARD} adapters={{ fetch }} icons={icons} onIssue={(issue) => issues.push(issue)} />);
    await waitFor(() => expect(screen.getByRole("table", { name: "Services" })).toBeInTheDocument());

    expect(screen.getByRole("heading", { level: 1, name: "Service health" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Trending up" })).toBeInTheDocument();
    expect(screen.getByText("99.93%")).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "Requests per day" })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Services" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent))).toEqual([
      ["Public API", "$1,200.00", "healthy"],
      ["Batch jobs", "$310.50", "degraded"],
    ]);
    expect(container.querySelector("[data-density]")).toHaveAttribute("data-density", "compact");
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {});
    expect(queryDiagnostics()).toEqual([]);
    expect(issues).toEqual([]);
  });

  it("streams byte by byte to the same page, never remounting what has already arrived", async () => {
    const queue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => queue.push(callback));
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
      queue[handle - 1] = () => {};
    });
    const probe = createMountProbe();
    const registry = extendRegistry(defaultRegistry, {
      StatCard: probe.wrap(StatCard, (props: ComponentProps<typeof StatCard>) => `stat:${String(props.label)}`),
      DataTable: probe.wrap(DataTable, () => "table") as unknown as typeof DataTable,
    });
    const adapters: RendererAdapters = { fetch: stubFetch() };
    const issues: Issue[] = [];
    const view = (end: number, complete = false) => (
      <ViewRenderer text={TEXT.slice(0, end)} complete={complete} adapters={adapters} icons={icons} registry={registry} onIssue={(issue) => issues.push(issue)} />
    );

    const streamed = render(view(1));
    const seen = new Map<string, Element>();
    const remember = () => {
      for (const element of streamed.container.querySelectorAll("h1, svg, table, button")) {
        const key = `${element.tagName}:${element.textContent}`;
        if (!seen.has(key) && element.isConnected) seen.set(key, element);
      }
    };
    for (let end = 2; end <= TEXT.length; end += 1) {
      streamed.rerender(view(end, end === TEXT.length));
      act(() => {
        for (const callback of queue.splice(0)) callback(0);
      });
      remember();
    }
    await waitFor(() => expect(screen.getByRole("table", { name: "Services" })).toBeInTheDocument());
    await act(async () => {});
    remember();

    for (const id of ["stat:Uptime", "stat:Open incidents", "table"]) {
      expect(probe.counts(id), id).toMatchObject({ mounts: 1, unmounts: 0 });
    }
    // Every element seen on the way (the heading at each of its lengths, the icon, the chart, the buttons) is still the one on the page.
    expect([...seen.keys()].filter((key) => key.startsWith("H1")).length).toBeGreaterThan(10);
    expect([...seen.keys()].filter((key) => key.startsWith("BUTTON")).length).toBeGreaterThan(3);
    for (const [key, element] of seen) expect(element.isConnected, key).toBe(true);
    expect(queryDiagnostics()).toEqual([]);
    expect(issues).toEqual([]);

    const whole = render(<ViewRenderer spec={DASHBOARD} adapters={{ fetch: stubFetch() }} icons={icons} />);
    await waitFor(() => expect(within(whole.container).getByRole("table", { name: "Services" })).toBeInTheDocument());
    expect(markup(streamed.container)).toBe(markup(whole.container));
  }, 120_000);

  it("validates its form in the dialog, submits through the host's fetch and shows the server's field error", async () => {
    const fetch = stubFetch();
    render(<ViewRenderer spec={DASHBOARD} adapters={{ fetch }} icons={icons} />);
    await userEvent.click(screen.getByRole("button", { name: "Change owner" }));
    expect(dialogs.showModal).toHaveBeenCalledTimes(1);

    const save = screen.getByRole("button", { name: "Save owner", hidden: true });
    await userEvent.click(save);
    expect(await screen.findByText("Name the owning team.")).toBeInTheDocument();
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith("/api/owners"))).toHaveLength(0);

    await userEvent.type(screen.getByLabelText("Team"), "platform");
    await userEvent.click(save);
    expect(await screen.findByText("No team is called that.")).toBeInTheDocument();
    const posted = fetch.mock.calls.find(([url]) => String(url).endsWith("/api/owners"));
    expect(JSON.parse(String(posted?.[1]?.body))).toEqual({ team: "platform" });
    expect(screen.getByLabelText("Team")).toHaveAttribute("aria-invalid", "true");
    expect(dialogs.close).toHaveBeenCalledTimes(0);
  });
});
