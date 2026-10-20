import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMountProbe, queryDiagnostics } from "../test-utils";
import { defaultContracts, extendContracts } from "./contracts";
import { defaultRegistry, extendRegistry } from "./registry/registry";
import type { ViewSpec } from "./spec/types";
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
  it("feeds Markdown the host's image allowlist; none by default", () => {
    const spec = view({ component: "Markdown", children: ["![Plan](/assets/plan.png)"] });
    const { container, rerender } = render(<ViewRenderer spec={spec} />);
    expect(container.querySelector("img")).toBeNull();
    rerender(<ViewRenderer spec={spec} markdownImageAllowlist={["/assets/"]} />);
    expect(container.querySelector("img")).toHaveAttribute("src", "/assets/plan.png");
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

  it("shows a Skeleton for a node still arriving when the view opts in", () => {
    frames();
    const cut = full.indexOf('"component"') + 4;
    const { container } = render(<ViewRenderer text={full.slice(0, cut)} streamingFallback="skeleton" />);
    expect(container.querySelectorAll(".r-renderer-pending")).toHaveLength(1);
  });

  it("never re-renders a closed node while later siblings stream in", () => {
    const frame = frames();
    const probe = createMountProbe();
    const registry = extendRegistry(defaultRegistry, { Probe: probe.Probe });
    const contracts = extendContracts(defaultContracts, { Probe: {} });
    const text = JSON.stringify(
      view({ component: "Stack", children: [{ component: "Probe", props: { probeId: "first" }, children: ["one"] }, "and more text"] }),
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
