import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { composeEventHandlers, mergeProps } from "./merge-props";

describe("composeEventHandlers", () => {
  it("runs the caller's handler before the component's own", async () => {
    const order: string[] = [];
    const composed = composeEventHandlers(
      () => order.push("theirs"),
      () => order.push("ours"),
    );

    render(<button onClick={composed}>go</button>);
    await userEvent.click(screen.getByRole("button"));

    expect(order).toEqual(["theirs", "ours"]);
  });

  it("runs both exactly once per event", async () => {
    const theirs = vi.fn();
    const ours = vi.fn();

    render(<button onClick={composeEventHandlers(theirs, ours)}>go</button>);
    await userEvent.click(screen.getByRole("button"));

    expect(theirs).toHaveBeenCalledTimes(1);
    expect(ours).toHaveBeenCalledTimes(1);
  });

  it("lets the caller opt out of the component's behaviour with preventDefault", async () => {
    const ours = vi.fn();
    const composed = composeEventHandlers(
      (e: React.MouseEvent) => e.preventDefault(),
      ours,
    );

    render(<button onClick={composed}>go</button>);
    await userEvent.click(screen.getByRole("button"));

    expect(ours).toHaveBeenCalledTimes(0);
  });

  it("still runs the component's behaviour when the event is not cancelable", async () => {
    const ours = vi.fn();
    const composed = composeEventHandlers(
      (e: React.MouseEvent) => e.preventDefault(),
      ours,
      { checkDefaultPrevented: false },
    );

    render(<button onClick={composed}>go</button>);
    await userEvent.click(screen.getByRole("button"));

    expect(ours).toHaveBeenCalledTimes(1);
  });

  it("runs the component's behaviour when the caller supplies no handler", async () => {
    const ours = vi.fn();

    render(<button onClick={composeEventHandlers(undefined, ours)}>go</button>);
    await userEvent.click(screen.getByRole("button"));

    expect(ours).toHaveBeenCalledTimes(1);
  });
});

describe("mergeProps", () => {
  it("composes handlers present on both sides, each firing once", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const props = mergeProps({ onClick: first }, { onClick: second });

    render(<button {...props}>go</button>);
    await userEvent.click(screen.getByRole("button"));

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("keeps a handler only one side defines", async () => {
    const only = vi.fn();
    const props = mergeProps({ onClick: only }, { type: "button" as const });

    render(<button {...props}>go</button>);
    await userEvent.click(screen.getByRole("button"));

    expect(only).toHaveBeenCalledTimes(1);
  });

  it("resolves conflicting Tailwind classes rather than concatenating", () => {
    const props = mergeProps({ className: "p-2 text-red-500" }, { className: "p-4" });
    expect(props.className).toBe("text-red-500 p-4");
  });

  it("merges style objects by key", () => {
    const props = mergeProps(
      { style: { color: "red", margin: 0 } },
      { style: { color: "blue" } },
    );
    expect(props.style).toEqual({ color: "blue", margin: 0 });
  });

  it("delivers the node to both refs", () => {
    const objectRef = createRef<HTMLButtonElement>();
    const callbackNodes: (HTMLButtonElement | null)[] = [];

    function Probe() {
      const props = mergeProps(
        { ref: objectRef },
        {
          ref: (node: HTMLButtonElement | null) => {
            callbackNodes.push(node);
          },
        },
      );
      return <button {...props}>go</button>;
    }

    render(<Probe />);

    const button = screen.getByRole("button");
    expect(objectRef.current).toBe(button);
    expect(callbackNodes).toContain(button);
  });

  it("does not let an undefined value clobber a defined one", () => {
    const props = mergeProps({ id: "kept" }, { id: undefined });
    expect(props.id).toBe("kept");
  });

  it("lets the second side win for ordinary defined values", () => {
    const props = mergeProps({ id: "a" }, { id: "b" });
    expect(props.id).toBe("b");
  });

  it("honours preventDefault between the two composed handlers", async () => {
    const second = vi.fn();
    const props = mergeProps(
      { onClick: (e: React.MouseEvent) => e.preventDefault() },
      { onClick: second },
    );

    render(<button {...props}>go</button>);
    await userEvent.click(screen.getByRole("button"));

    expect(second).toHaveBeenCalledTimes(0);
  });
});
