import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMountProbe, queryDiagnostics, renderThrowing, stubDialog } from "../test-utils";
import { defaultContracts, extendContracts } from "./contracts";
import { defaultRegistry, extendRegistry } from "./registry/registry";
import type { Issue, ValidationResult, ViewSpec } from "./spec/types";
import { createViewSpecParser } from "./stream/parser";
import type { StreamSnapshot } from "./stream/snapshot";
import { ViewRenderer } from "./ViewRenderer";

const view = (root: ViewSpec["root"], extra: Partial<ViewSpec> = {}): ViewSpec => ({ version: 2, title: "Test", ...extra, root });

describe("density", () => {
  it("writes the document's density on the view root, and the host's wins over it", () => {
    const spec = view("x", { density: "compact" });
    const { container, rerender } = render(<ViewRenderer spec={spec} />);
    expect(container.firstElementChild).toHaveAttribute("data-density", "compact");
    rerender(<ViewRenderer spec={spec} density="comfortable" />);
    expect(container.firstElementChild).toHaveAttribute("data-density", "comfortable");
  });
});

describe("two views on one page", () => {
  it("share no DOM id, even where the document writes one, and each label names its own control", async () => {
    const spec = view(
      {
        component: "Form",
        props: { form: "contact" },
        children: [
          {
            component: "Field",
            props: { name: "email" },
            children: [
              { component: "Field.Label", children: ["Email"] },
              { component: "Input", props: { type: "email", id: "email" } },
              { component: "Field.Description", children: ["We reply within a day."] },
            ],
          },
        ],
      },
      { forms: { contact: { fields: { email: { rules: { required: true } } } } } },
    );
    render(
      <>
        <ViewRenderer spec={spec} />
        <ViewRenderer spec={spec} />
      </>,
    );
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    expect(ids.length).toBeGreaterThanOrEqual(4);
    expect(new Set(ids).size).toBe(ids.length);
    const inputs = screen.getAllByRole("textbox", { name: "Email" });
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).not.toBe(inputs[1]);
    expect(inputs.map((input) => input.getAttribute("aria-describedby"))).not.toContain(null);
    // The issue log fills after the render that reported (the channel delivers on a microtask).
    await act(async () => {});
    expect(queryDiagnostics().map(({ code, path }) => [code, path])).toEqual([
      ["forbidden-prop", "/root/children/0/children/1/props/id"],
      ["forbidden-prop", "/root/children/0/children/1/props/id"],
    ]);
  });
});

describe("issues", () => {
  it("shows every issue in the DOM exactly once, in place or in the hidden issue log, and passes each to onIssue", async () => {
    const seen: string[] = [];
    render(
      <ViewRenderer
        spec={view({ component: "Stack", props: { style: { color: "red" } }, children: [{ component: "Nope" }] })}
        onIssue={(issue) => seen.push(`${issue.code} ${issue.path}`)}
      />,
    );
    await act(async () => {});
    expect(queryDiagnostics().map(({ code, path }) => `${code} ${path}`)).toEqual([
      "unknown-component /root/children/0/component",
      "forbidden-prop /root/props/style",
    ]);
    expect(document.querySelector(".r-renderer-issue-log")?.textContent).not.toContain("Nope");
    expect(seen.sort()).toEqual(["forbidden-prop /root/props/style", "unknown-component /root/children/0/component"]);
  });
});

describe("host options", () => {
  it("feeds Markdown the policy's image prefixes; none by default", () => {
    const spec = view({ component: "Markdown", children: ["![Plan](/assets/plan.png)"] });
    const { container, rerender } = render(<ViewRenderer spec={spec} />);
    expect(container.querySelector("img")).toBeNull();
    rerender(<ViewRenderer spec={spec} policy={{ markdownImages: ["/assets/"] }} />);
    expect(container.querySelector("img")).toHaveAttribute("src", "/assets/plan.png");
  });

  it("hides diagnostics on request, keeping every one in the DOM for findDiagnostics", async () => {
    const spec = view({ component: "Stack", children: [{ component: "Nope" }] });
    const { container } = render(<ViewRenderer spec={spec} diagnostics="hidden" />);
    await act(async () => {});
    expect(container.firstElementChild).toHaveAttribute("data-diagnostics", "hidden");
    expect(queryDiagnostics().map(({ code }) => code)).toEqual(["unknown-component"]);
  });

  it("shows diagnostics by default", () => {
    const { container } = render(<ViewRenderer spec={view("x")} />);
    expect(container.firstElementChild).not.toHaveAttribute("data-diagnostics");
  });
});

describe("onValidation", () => {
  const iconWarnings = (onValidation: ReturnType<typeof vi.fn>) =>
    (onValidation.mock.calls[0]?.[0] as ValidationResult).issues.filter((issue) => issue.code === "unknown-icon").map((issue) => issue.path);

  it("checks icon names against the icon set the view draws from, not the shipped one", async () => {
    const Sparkle = () => <svg data-testid="sparkle" />;
    const spec = view({ component: "Stack", children: [{ component: "Icon", props: { name: "sparkle" } }, { component: "Icon", props: { name: "activity" } }] });

    const withSet = vi.fn();
    const { unmount } = render(<ViewRenderer spec={spec} icons={{ sparkle: Sparkle }} onValidation={withSet} />);
    expect(screen.getByTestId("sparkle")).toBeInTheDocument();
    await waitFor(() => expect(withSet).toHaveBeenCalledTimes(1));
    expect(iconWarnings(withSet)).toEqual(["/root/children/1/props/name"]);
    unmount();

    const withoutSet = vi.fn();
    render(<ViewRenderer spec={spec} onValidation={withoutSet} />);
    await waitFor(() => expect(withoutSet).toHaveBeenCalledTimes(1));
    expect(iconWarnings(withoutSet)).toEqual(["/root/children/0/props/name", "/root/children/1/props/name"]);
  });

  it("validates once the document is complete, once, whatever callback the host passes later", async () => {
    const full = JSON.stringify(view({ component: "Text", children: ["Done"] }));
    const first = vi.fn();
    const { rerender } = render(<ViewRenderer text={full.slice(0, -4)} onValidation={first} />);
    await act(async () => {});
    expect(first).not.toHaveBeenCalled();
    rerender(<ViewRenderer text={full} complete onValidation={first} />);
    await waitFor(() => expect(first).toHaveBeenCalledTimes(1));
    expect(first.mock.calls[0]?.[0]).toMatchObject({ ok: true, issues: [] });

    const second = vi.fn();
    rerender(<ViewRenderer text={full} complete onValidation={second} />);
    await act(async () => {});
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it("validates with the view's policy: what the host allows raises no warning", async () => {
    const spec = view({ component: "PasswordInput", props: { "aria-label": "Password" } });
    const strict = vi.fn();
    const { unmount } = render(<ViewRenderer spec={spec} onValidation={strict} />);
    await waitFor(() => expect(strict).toHaveBeenCalledTimes(1));
    expect((strict.mock.calls[0]?.[0] as ValidationResult).issues.map((issue) => issue.code)).toContain("sensitive-component");
    unmount();

    const allowing = vi.fn();
    render(<ViewRenderer spec={spec} policy={{ allowSensitive: ["PasswordInput"] }} onValidation={allowing} />);
    await waitFor(() => expect(allowing).toHaveBeenCalledTimes(1));
    expect((allowing.mock.calls[0]?.[0] as ValidationResult).issues.map((issue) => issue.code)).not.toContain("sensitive-component");
  });

  it("loads the validator only when asked: the package root never imports it statically", () => {
    const source = (file: string) => readFileSync(file, "utf8");
    const statics = /^(?:import|export)\s+(?!type\b)[^'"]*?from\s+["'](\.[^"']+)["']/gm;
    const reached = new Set<string>();
    const queue = [join(import.meta.dirname, "index.ts")];
    for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
      if (reached.has(file)) continue;
      reached.add(file);
      for (const match of source(file).matchAll(statics)) {
        const target = join(dirname(file), match[1] ?? "");
        const resolved = [".ts", ".tsx", "/index.ts"].map((ending) => target + ending).find((candidate) => {
          try {
            return source(candidate) !== "";
          } catch {
            return false;
          }
        });
        if (resolved !== undefined) queue.push(resolved);
      }
    }
    expect(reached.size).toBeGreaterThan(20);
    expect(reached.has(join(import.meta.dirname, "spec", "validate.ts"))).toBe(false);
  });
});

describe("streaming text", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function frames() {
    const queue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => queue.push(callback));
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
      queue[handle - 1] = () => {};
    });
    return {
      flush() {
        act(() => {
          for (const callback of queue.splice(0)) callback(0);
        });
      },
    };
  }

  const full = JSON.stringify(view({ component: "Stack", children: ["Hello there"] }));

  it("renders at most once per animation frame while text grows, and at once when complete", () => {
    const frame = frames();
    const cut = full.indexOf("Hello") + 2;
    const { container, rerender } = render(<ViewRenderer text={full.slice(0, cut)} />);
    expect(container.textContent).toBe("He");
    rerender(<ViewRenderer text={full.slice(0, cut + 3)} />);
    rerender(<ViewRenderer text={full.slice(0, cut + 6)} />);
    expect(container.textContent).toBe("He");
    frame.flush();
    expect(container.textContent).toBe("Hello th");
    rerender(<ViewRenderer text={full} complete />);
    expect(container.textContent).toBe("Hello there");
  });

  it("shows a Skeleton for a node still arriving when the view opts in, and nothing by default", () => {
    frames();
    const cut = full.indexOf('"component"') + 4;
    const { container, rerender } = render(<ViewRenderer text={full.slice(0, cut)} />);
    expect(container.querySelectorAll(".r-renderer-pending")).toHaveLength(0);
    rerender(<ViewRenderer text={full.slice(0, cut)} streamingFallback="skeleton" />);
    expect(container.querySelectorAll(".r-renderer-pending")).toHaveLength(1);
  });

  it("never shows a frame of the previous document once the text starts over", () => {
    frames();
    const alpha = JSON.stringify(view({ component: "Text", children: ["Alpha document"] }));
    const beta = JSON.stringify(view({ component: "Text", children: ["Beta document"] }));
    const { container, rerender } = render(<ViewRenderer text={alpha} complete />);
    expect(container.textContent).toBe("Alpha document");
    rerender(<ViewRenderer text={beta.slice(0, beta.indexOf("Beta") + 3)} />);
    expect(container.textContent).toBe("Bet");
  });

  it("never re-renders a closed node while later siblings stream in", () => {
    const frame = frames();
    const probe = createMountProbe();
    const registry = extendRegistry(defaultRegistry, { Probe: probe.Probe });
    const contracts = extendContracts(defaultContracts, { Probe: {} });
    // The binding makes the runtime re-plan on every chunk: its `data`/`status` must keep their identity.
    const text = JSON.stringify(
      view(
        { component: "Stack", children: [{ component: "Probe", props: { probeId: "first" }, children: [{ $ref: "data.labels.first" }] }, "and more text"] },
        { data: { labels: { type: "static", value: { first: "one" } } } },
      ),
    );
    const at = (end: number) => <ViewRenderer text={text.slice(0, end)} registry={registry} contracts={contracts} />;
    const start = text.indexOf("and more") + 3;
    const { rerender, container } = render(at(start));
    for (let end = start + 1; end <= text.indexOf(" text") + 5; end += 1) {
      rerender(at(end));
      frame.flush();
    }
    expect(container.textContent).toContain("oneand more text");
    expect(probe.counts("first")).toEqual({ mounts: 1, unmounts: 0, renders: 1 });
  });
});

describe("inputs", () => {
  const doc = view({ component: "Text", children: ["Streamed whole"] });
  const text = JSON.stringify(doc);

  it("renders snapshots a host reads itself", () => {
    const parser = createViewSpecParser();
    const { container, rerender } = render(<ViewRenderer snapshot={parser.push(text.slice(0, text.indexOf("whole")))} />);
    expect(container.textContent).toBe("Streamed ");
    rerender(<ViewRenderer snapshot={parser.push(text.slice(text.indexOf("whole")))} />);
    expect(container.textContent).toBe("Streamed whole");
  });

  it.each([
    ["a Response", () => new Response(text)],
    ["a ReadableStream", () => new ReadableStream<string>({ start: (controller) => (controller.enqueue(text), controller.close()) })],
    ["an async iterable", () => (async function* () {
      yield text.slice(0, 20);
      yield text.slice(20);
    })()],
  ])("reads %s as its source", async (_, source) => {
    const { container } = render(<ViewRenderer source={source()} />);
    await waitFor(() => expect(container.textContent).toBe("Streamed whole"));
  });
});

/** A document whose state, dialog, form and issues show: everything one document owns. */
function owned(title = "Owned"): ViewSpec {
  return view(
    {
      component: "Stack",
      children: [
        { component: "Button", props: { onClick: { action: "setState", payload: { path: "state.count", value: 1 } } }, children: ["Bump"] },
        { component: "Button", props: { onClick: { action: "openDialog", payload: { dialogId: "details" } } }, children: ["Open"] },
        { component: "Text", children: ["Count ", { $ref: "state.count" }] },
        { component: "Dialog", props: { dialogId: "details" }, children: [{ component: "Dialog.Content", children: [{ component: "Dialog.Title", children: ["Details"] }] }] },
        {
          component: "Form",
          props: { form: "note" },
          children: [{ component: "Field", props: { name: "text" }, children: [{ component: "Field.Label", children: ["Note"] }, { component: "Input" }] }],
        },
        { component: "Nope" },
      ],
    },
    { title, state: { count: 0 }, forms: { note: { fields: { text: {} } } } },
  );
}

describe("a new document never inherits the old one's runtime", () => {
  async function play(): Promise<void> {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Bump" }));
      fireEvent.click(screen.getByRole("button", { name: "Open" }));
      fireEvent.change(screen.getByRole("textbox", { name: "Note" }), { target: { value: "kept?" } });
    });
    expect(screen.getByText("Count 1")).toBeInTheDocument();
    expect(document.querySelectorAll("dialog[open]")).toHaveLength(1);
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveValue("kept?");
  }

  function expectFresh(issues: Issue[]): void {
    expect(screen.getByText("Count 0")).toBeInTheDocument();
    expect(document.querySelectorAll("dialog[open]")).toHaveLength(0);
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveValue("");
    // The new document's issues are its own: reported again, shown once.
    expect(issues.filter((issue) => issue.code === "unknown-component")).toHaveLength(2);
    expect(queryDiagnostics().filter(({ code }) => code === "unknown-component")).toHaveLength(1);
  }

  it("a new spec object, even with the same contents, starts afresh; the same object keeps its runtime", async () => {
    const dialog = stubDialog();
    const issues: Issue[] = [];
    const onIssue = (issue: Issue) => void issues.push(issue);
    const first = owned();
    const { rerender } = render(<ViewRenderer spec={first} onIssue={onIssue} />);
    await play();
    rerender(<ViewRenderer spec={first} onIssue={onIssue} className="again" />);
    expect(screen.getByText("Count 1")).toBeInTheDocument();
    rerender(<ViewRenderer spec={owned()} onIssue={onIssue} />);
    await act(async () => {});
    expectFresh(issues);
    dialog.restore();
  });

  it("text that starts over rather than grows starts afresh", async () => {
    const dialog = stubDialog();
    const issues: Issue[] = [];
    const onIssue = (issue: Issue) => void issues.push(issue);
    const { rerender } = render(<ViewRenderer text={JSON.stringify(owned("A"))} complete onIssue={onIssue} />);
    await play();
    rerender(<ViewRenderer text={JSON.stringify(owned("B"))} complete onIssue={onIssue} />);
    await act(async () => {});
    expectFresh(issues);
    dialog.restore();
  });

  it("a new source starts afresh", async () => {
    const dialog = stubDialog();
    const issues: Issue[] = [];
    const onIssue = (issue: Issue) => void issues.push(issue);
    const text = JSON.stringify(owned());
    const { rerender } = render(<ViewRenderer source={new Response(text)} onIssue={onIssue} />);
    await screen.findByText("Count 0");
    await play();
    rerender(<ViewRenderer source={new Response(text)} onIssue={onIssue} />);
    await waitFor(() => expect(screen.getByText("Count 0")).toBeInTheDocument());
    await act(async () => {});
    expectFresh(issues);
    dialog.restore();
  });

  it("snapshots from a reset or new parser start afresh", async () => {
    const dialog = stubDialog();
    const issues: Issue[] = [];
    const onIssue = (issue: Issue) => void issues.push(issue);
    const text = JSON.stringify(owned());
    const parser = createViewSpecParser();
    const { rerender } = render(<ViewRenderer snapshot={parser.push(text)} onIssue={onIssue} />);
    await play();
    parser.reset();
    rerender(<ViewRenderer snapshot={parser.push(text)} onIssue={onIssue} />);
    await act(async () => {});
    expectFresh(issues);
    dialog.restore();
  });
});

describe("never throws out of render", () => {
  function nested(levels: number): unknown {
    let value: unknown = 1;
    for (let level = 0; level < levels; level += 1) value = { a: value };
    return value;
  }

  /** 5000 levels deep in a data binding's query and a form's initial value. */
  const deep = view(
    { component: "Text", children: ["shown"] },
    {
      data: { d: { type: "api", endpoint: "/x", query: { q: nested(5000) } } } as ViewSpec["data"],
      forms: { f: { fields: { a: { initialValue: nested(5000) } } } } as unknown as ViewSpec["forms"],
    },
  );
  const deepText = `{"version":2,"title":"Test","data":{"d":{"type":"api","endpoint":"/x","query":{"q":${'{"a":'.repeat(5000)}1${"}".repeat(5000)}}}},"root":{"component":"Text","children":["shown"]}}`;
  const adapters = { fetch: () => Promise.resolve(new Response("{}")) };

  it.each([
    ["spec", () => <ViewRenderer spec={deep} adapters={adapters} onIssue={(issue) => void seen.push(issue)} />],
    ["text", () => <ViewRenderer text={deepText} complete adapters={adapters} onIssue={(issue) => void seen.push(issue)} />],
  ])("refuses a document 5000 levels deep given as %s, saying so", async (_, ui) => {
    seen.length = 0;
    expect(() => render(ui())).not.toThrow();
    await act(async () => {});
    expect(seen.map(({ code }) => code)).toEqual(["too-deep"]);
    expect(queryDiagnostics().map(({ code }) => code)).toEqual(["too-deep"]);
  });

  it("renders a hand-built snapshot 5000 levels deep without throwing", async () => {
    const snapshot: StreamSnapshot = { spec: deep as unknown as StreamSnapshot["spec"], complete: true, pending: new Set() };
    const { container } = render(<ViewRenderer snapshot={snapshot} adapters={adapters} />);
    await act(async () => {});
    expect(container.textContent).toContain("shown");
  });

  it("contains a host callback that throws while the view renders, as a render-error", async () => {
    const issues: Issue[] = [];
    const spec = view({ component: "Text", children: ["never"] }, { data: { d: { type: "api", endpoint: "/x" } } });
    const policy = {
      allowUrl: () => {
        throw new Error("The host's policy broke.");
      },
    };
    const { container } = renderThrowing(<ViewRenderer spec={spec} adapters={adapters} policy={policy} onIssue={(issue) => void issues.push(issue)} />);
    await act(async () => {});
    expect(container.textContent).toBe("The host's policy broke.");
    expect(issues.map(({ code, path }) => [code, path])).toContainEqual(["render-error", ""]);
  });
});

const seen: Issue[] = [];
