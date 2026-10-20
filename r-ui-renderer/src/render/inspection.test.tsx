/**
 * The four ways a library parent reads its children, each through the
 * renderer: nothing may sit between the parent and the elements it reads.
 */

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { queryDiagnostics } from "../../test-utils";
import { renderTree } from "./harness.test.helpers";

describe("identity: Card.Header picks Card.Actions out by type", () => {
  it("places Card.Actions on the end, outside the text column, also from a $cond", () => {
    const view = renderTree(
      {
        component: "Card",
        children: [
          {
            component: "Card.Header",
            children: [
              { component: "Card.Title", children: ["Usage"] },
              {
                $cond: "data.editable",
                then: { component: "Card.Actions", children: [{ component: "Button", children: ["Edit"] }] },
              },
            ],
          },
        ],
      },
      { data: { editable: true } },
    );
    const title = screen.getByText("Usage");
    const textColumn = title.parentElement;
    const header = textColumn?.parentElement;
    const edit = screen.getByRole("button", { name: "Edit" });
    expect(textColumn?.contains(edit)).toBe(false);
    expect(edit.parentElement?.parentElement).toBe(header);
    expect(view.reported).toEqual([]);
  });
});

describe("props: Stepper reads each Stepper.Step's props", () => {
  it("shows the current step's label in its compact summary", () => {
    renderTree({
      component: "Stepper",
      props: { current: 1, orientation: "horizontal" },
      children: [
        {
          $each: "data.steps",
          as: "step",
          node: { component: "Stepper.Step", props: { label: { $ref: "step.label" } } },
        },
      ],
    }, { data: { steps: [{ label: "Details" }, { label: "Review" }, { label: "Pay" }] } });
    const compact = document.querySelector("[data-compact]");
    expect(compact).not.toBeNull();
    expect(compact?.textContent).toContain("Review");
  });
});

describe("clone: Tooltip wires its one child by cloning it", () => {
  it("points the Button at the tooltip with aria-describedby", () => {
    renderTree({
      component: "Tooltip",
      props: { content: "Restarts every instance", defaultOpen: true },
      children: [{ component: "Button", children: ["Restart"] }],
    });
    const tooltip = screen.getByRole("tooltip", { hidden: true });
    expect(tooltip.id).not.toBe("");
    expect(screen.getByRole("button", { name: "Restart" })).toHaveAttribute("aria-describedby", tooltip.id);
  });
});

describe("count: HowItWorks numbers its steps by position", () => {
  it("numbers steps that a $each produced 1, 2, 3", () => {
    renderTree(
      {
        component: "HowItWorks",
        props: { label: "Getting started" },
        children: [
          { component: "HowItWorks.Step", props: { title: "Sign up" } },
          { $each: "data.steps", as: "step", node: { component: "HowItWorks.Step", props: { title: { $ref: "step" } } } },
        ],
      },
      { data: { steps: ["Connect", "Ship"] } },
    );
    const list = screen.getByRole("list", { name: "Getting started" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(list).toHaveAttribute("data-steps", "3");
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringMatching(/^1.*Sign up/),
      expect.stringMatching(/^2.*Connect/),
      expect.stringMatching(/^3.*Ship/),
    ]);
    expect(queryDiagnostics()).toEqual([]);
  });
});
