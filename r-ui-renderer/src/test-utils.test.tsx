import { render } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { createMountProbe, queryDiagnostics, renderThrowing } from "../test-utils";
import { DIAGNOSTIC_CLASSES } from "./diagnostics";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? "caught" : this.props.children;
  }
}

function Throws(): ReactNode {
  throw new Error("expected");
}

describe("renderThrowing", () => {
  it("renders a tree whose boundary catches", () => {
    const { container } = renderThrowing(
      <Boundary>
        <Throws />
      </Boundary>,
    );
    expect(container.textContent).toBe("caught");
  });

  it("fails when nothing threw", () => {
    expect(() => renderThrowing(<p>fine</p>)).toThrow(/expected a node error boundary to catch/);
  });
});

describe("queryDiagnostics", () => {
  it("finds diagnostics anywhere in the body, hidden ones included, with code, path and severity", () => {
    render(<p>view</p>);
    const outside = document.createElement("div");
    outside.hidden = true;
    outside.innerHTML = `<span class="${DIAGNOSTIC_CLASSES.diagnostic} ${DIAGNOSTIC_CLASSES.error}" data-code="render-error" data-path="/root"> Card threw </span>`;
    document.body.append(outside);
    try {
      expect(queryDiagnostics()).toEqual([{ code: "render-error", path: "/root", severity: "error", text: "Card threw" }]);
    } finally {
      outside.remove();
    }
    expect(queryDiagnostics()).toEqual([]);
  });
});

describe("createMountProbe", () => {
  it("counts mounts, unmounts and renders per probe id", () => {
    const { Probe, counts } = createMountProbe();
    const { rerender, unmount } = render(<Probe probeId="a">one</Probe>);
    rerender(<Probe probeId="a">two</Probe>);
    expect(counts("a")).toEqual({ mounts: 1, unmounts: 0, renders: 2 });
    unmount();
    expect(counts("a")).toEqual({ mounts: 1, unmounts: 1, renders: 2 });
    expect(counts("never")).toEqual({ mounts: 0, unmounts: 0, renders: 0 });
  });
});
