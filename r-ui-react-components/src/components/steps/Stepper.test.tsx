import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Stepper, type StepperProps } from "./Stepper";

function Flow(props: Partial<StepperProps>) {
  return (
    <Stepper current={2} {...props}>
      <Stepper.Step label="Team" description="Name and plan" />
      <Stepper.Step label="Integrations" optional status="skipped" />
      <Stepper.Step label="Members" />
      <Stepper.Step label="Billing" status="error" />
      <Stepper.Step label="Review" />
    </Stepper>
  );
}

const items = () => within(screen.getByRole("list", { hidden: true })).getAllByRole("listitem");

describe("Stepper", () => {
  it("is an ordered list named Progress with exactly the current step marked aria-current", () => {
    render(<Flow />);
    const list = screen.getByRole("list", { name: "Progress" });
    expect(list.tagName).toBe("OL");
    expect(screen.queryByRole("navigation")).toBeNull();
    const steps = items();
    expect(steps).toHaveLength(5);
    expect(steps.map((li) => li.getAttribute("aria-current"))).toEqual([null, null, "step", null, null]);
    expect(steps.map((li) => li.dataset.position)).toEqual(["complete", "complete", "current", "upcoming", "upcoming"]);
  });

  it("says every state in words and marks it with a shape, not colour alone", () => {
    render(<Flow />);
    const [team, integrations, members, billing, review] = items() as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    expect(team).toHaveTextContent("Team, Completed");
    expect(integrations).toHaveTextContent("Skipped · Optional");
    expect(billing).toHaveTextContent("Needs attention");
    expect(review).toHaveTextContent("Review, Not started");
    // The current step is said by aria-current, not a second word.
    expect(members).not.toHaveTextContent("Current step");
    const ring = (li: HTMLElement) => li.querySelector(".r-steps-marker")?.getAttribute("data-ring");
    expect([team, integrations, members, billing, review].map(ring)).toEqual([
      "single",
      "dashed",
      "double",
      "double",
      "single",
    ]);
    // Glyphs: a check, a dash, a number, a cross, a number.
    expect(team.querySelector(".r-steps-marker svg")).not.toBeNull();
    expect(members.querySelector(".r-steps-marker")).toHaveTextContent("3");
    expect(review.querySelector(".r-steps-marker")).toHaveTextContent("5");
    expect(billing.querySelector(".r-steps-marker svg")).not.toBeNull();
  });

  it("has no buttons without onStepSelect", () => {
    render(<Flow />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("with onStepSelect, is a nav whose steps before the current one are buttons", async () => {
    const user = userEvent.setup();
    const onStepSelect = vi.fn();
    render(<Flow onStepSelect={onStepSelect} label="Invite progress" />);
    const nav = screen.getByRole("navigation", { name: "Invite progress" });
    const buttons = within(nav).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      expect.stringContaining("Team"),
      expect.stringContaining("Integrations"),
    ]);
    expect(within(nav).getByRole("button", { name: "Team, Completed" })).toHaveAccessibleDescription("Name and plan");
    expect(within(nav).getByRole("button", { name: "Integrations Skipped · Optional" })).toBeInTheDocument();
    await user.click(buttons[1] as HTMLElement);
    expect(onStepSelect).toHaveBeenCalledTimes(1);
    expect(onStepSelect).toHaveBeenCalledWith(1);
    await user.keyboard("{Shift>}{Tab}{/Shift}{Enter}");
    expect(onStepSelect).toHaveBeenCalledTimes(2);
    expect(onStepSelect).toHaveBeenLastCalledWith(0);
  });

  it("lets a step opt in or out of being selectable, and renders a link with href", () => {
    render(
      <Stepper current={1} onStepSelect={() => {}}>
        <Stepper.Step label="Locked" selectable={false} />
        <Stepper.Step label="Here" />
        <Stepper.Step label="Peek" selectable href="#/peek" />
      </Stepper>,
    );
    expect(screen.queryByRole("button", { name: /Locked/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Peek, Not started" })).toHaveAttribute("href", "#/peek");
  });

  it("falls back to a button when safeUrl refuses the href, not an <a> with no href", async () => {
    const onStepSelect = vi.fn();
    render(
      <Stepper current={1} onStepSelect={onStepSelect}>
        <Stepper.Step label="Done" href="javascript:alert(1)" />
        <Stepper.Step label="Here" />
      </Stepper>,
    );
    expect(screen.queryByRole("link")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Done, Completed" }));
    expect(onStepSelect).toHaveBeenCalledTimes(1);
    expect(onStepSelect).toHaveBeenCalledWith(0);
  });

  it("carries a compact 'Step n of m · name' form for a narrow container, horizontal only", () => {
    const { container, rerender } = render(<Flow />);
    const compact = container.querySelector("[data-compact]");
    expect(compact).toHaveTextContent("Step 3 of 5 · : Members");
    // Hidden until its container query (five steps: below 48rem) shows it, and the list hides then.
    expect(compact).toHaveClass("hidden", "@max-3xl:grid");
    expect(container.querySelector(".r-steps-list")).toHaveClass("@max-3xl:hidden");
    rerender(<Flow current={3} />);
    expect(container.querySelector("[data-compact]")).toHaveTextContent(
      "Step 4 of 5 · : Billing · , Needs attention",
    );
    rerender(<Flow orientation="vertical" />);
    expect(container.querySelector("[data-compact]")).toBeNull();
    expect(container.querySelector(".r-steps-list")).not.toHaveClass("@max-3xl:hidden");
  });

  it("translates its words through labels, its default name included", () => {
    render(
      <Stepper
        current={1}
        labels={{ progress: "Fortschritt", complete: "Erledigt", position: (n, total) => `Schritt ${n} von ${total}` }}
      >
        <Stepper.Step label="Team" />
        <Stepper.Step label="Mitglieder" />
      </Stepper>,
    );
    expect(screen.getByRole("list", { name: "Fortschritt" })).toBeInTheDocument();
    expect(items()[0]).toHaveTextContent("Team, Erledigt");
    expect(document.querySelector("[data-compact]")).toHaveTextContent("Schritt 2 von 2");
  });

  it("counts steps inside fragments and skips text and holes among them", () => {
    const later = false;
    render(
      <Stepper current={2}>
        <>
          <Stepper.Step label="Team" />
          <Stepper.Step label="Members" />
        </>
        {"\n"}
        {later && <Stepper.Step label="Never" />}
        <>
          <Stepper.Step label="Billing" />
        </>
      </Stepper>,
    );
    const steps = items();
    expect(steps.map((li) => li.querySelector("[id$=label]")?.textContent?.split(",")[0])).toEqual(["Team", "Members", "Billing"]);
    expect(steps.map((li) => li.getAttribute("aria-current"))).toEqual([null, null, "step"]);
    expect(document.querySelector("[data-compact]")).toHaveTextContent("Step 3 of 3");
  });
});
