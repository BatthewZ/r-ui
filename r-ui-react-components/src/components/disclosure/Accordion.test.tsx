import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Accordion, type AccordionProps } from "./Accordion";

function Faq(props: Partial<AccordionProps>) {
  return (
    <Accordion {...(props as AccordionProps)}>
      <Accordion.Item value="billing">
        <Accordion.Trigger>Billing</Accordion.Trigger>
        <Accordion.Content>
          Invoices monthly. <a href="#terms">Terms</a>
        </Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="data">
        <Accordion.Trigger>Your data</Accordion.Trigger>
        <Accordion.Content>Exportable at any time.</Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="legacy" disabled>
        <Accordion.Trigger>Legacy plans</Accordion.Trigger>
        <Accordion.Content>Retired.</Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="support">
        <Accordion.Trigger>Support</Accordion.Trigger>
        <Accordion.Content>Weekdays.</Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}

const trigger = (name: string) => screen.getByRole("button", { name });

describe("Accordion", () => {
  it("wires each trigger to its region and puts it in a heading of the chosen level", () => {
    render(<Faq headingLevel={4} defaultValue="billing" />);
    const billing = trigger("Billing");
    expect(billing.parentElement?.tagName).toBe("H4");
    expect(screen.getByRole("heading", { level: 4, name: "Billing" })).toContainElement(billing);
    expect(billing).toHaveAttribute("aria-expanded", "true");
    const region = screen.getByRole("region", { name: "Billing" });
    expect(billing).toHaveAttribute("aria-controls", region.id);
    expect(region).toHaveAttribute("data-state", "open");
    expect(region).not.toHaveAttribute("inert");
  });

  // `inert` is what removes them; jsdom models neither it nor `visibility`, so
  // the attribute is the claim here and the browser check covers the effect.
  it("marks closed panels inert", () => {
    render(<Faq />);
    const closed = document.getElementById(trigger("Billing").getAttribute("aria-controls") ?? "");
    expect(closed).toHaveAttribute("inert");
    expect(closed).toHaveAttribute("data-state", "closed");
    expect(trigger("Billing")).toHaveAttribute("aria-expanded", "false");
  });

  it("single: opening one closes the other, and the open one closes again", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Faq onValueChange={onValueChange} />);
    await user.click(trigger("Billing"));
    await user.click(trigger("Your data"));
    expect(trigger("Billing")).toHaveAttribute("aria-expanded", "false");
    expect(trigger("Your data")).toHaveAttribute("aria-expanded", "true");
    await user.click(trigger("Your data"));
    expect(trigger("Your data")).toHaveAttribute("aria-expanded", "false");
    expect(onValueChange.mock.calls).toEqual([["billing"], ["data"], [null]]);
  });

  it("single with collapsible={false}: the open trigger is aria-disabled and stays open", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Faq collapsible={false} defaultValue="billing" onValueChange={onValueChange} />);
    expect(trigger("Billing")).toHaveAttribute("aria-disabled", "true");
    expect(trigger("Your data")).not.toHaveAttribute("aria-disabled");
    await user.click(trigger("Billing"));
    expect(trigger("Billing")).toHaveAttribute("aria-expanded", "true");
    expect(onValueChange).toHaveBeenCalledTimes(0);
    await user.click(trigger("Your data"));
    expect(trigger("Billing")).not.toHaveAttribute("aria-disabled");
    expect(trigger("Your data")).toHaveAttribute("aria-disabled", "true");
  });

  it("multiple: items open independently and report the whole set", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Faq multiple defaultValue={["support"]} onValueChange={onValueChange} />);
    await user.click(trigger("Billing"));
    expect(trigger("Support")).toHaveAttribute("aria-expanded", "true");
    expect(trigger("Billing")).toHaveAttribute("aria-expanded", "true");
    await user.click(trigger("Support"));
    expect(onValueChange.mock.calls).toEqual([[["support", "billing"]], [["billing"]]]);
  });

  it("controlled: the value decides, and the change is only proposed", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(<Faq value="data" onValueChange={onValueChange} />);
    await user.click(trigger("Billing"));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("billing");
    expect(trigger("Billing")).toHaveAttribute("aria-expanded", "false");
    expect(trigger("Your data")).toHaveAttribute("aria-expanded", "true");
    rerender(<Faq value={null} onValueChange={onValueChange} />);
    expect(trigger("Your data")).toHaveAttribute("aria-expanded", "false");
  });

  it("works as a controlled component in a real parent", async () => {
    function Parent() {
      const [open, setOpen] = useState<string | null>(null);
      return (
        <>
          <output>{open ?? "none"}</output>
          <Accordion value={open} onValueChange={setOpen}>
            <Accordion.Item value="a">
              <Accordion.Trigger>A</Accordion.Trigger>
              <Accordion.Content>Alpha</Accordion.Content>
            </Accordion.Item>
          </Accordion>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Parent />);
    await user.click(trigger("A"));
    expect(screen.getByRole("status")).toHaveTextContent("a");
    expect(trigger("A")).toHaveAttribute("aria-expanded", "true");
  });

  it("a disabled item cannot be toggled", async () => {
    const user = userEvent.setup();
    render(<Faq />);
    expect(trigger("Legacy plans")).toBeDisabled();
    await user.click(trigger("Legacy plans"));
    expect(trigger("Legacy plans")).toHaveAttribute("aria-expanded", "false");
  });

  it("keyboard: Enter and Space toggle; arrows wrap, Home/End jump, disabled items are skipped", async () => {
    const user = userEvent.setup();
    render(<Faq />);
    trigger("Billing").focus();
    await user.keyboard("{Enter}");
    expect(trigger("Billing")).toHaveAttribute("aria-expanded", "true");
    await user.keyboard(" ");
    expect(trigger("Billing")).toHaveAttribute("aria-expanded", "false");

    await user.keyboard("{ArrowDown}");
    expect(trigger("Your data")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(trigger("Support")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(trigger("Billing")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(trigger("Support")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(trigger("Billing")).toHaveFocus();
    await user.keyboard("{End}");
    expect(trigger("Support")).toHaveFocus();
  });

  it("Tab moves into an open panel's content and past closed ones", async () => {
    const user = userEvent.setup();
    render(<Faq defaultValue="billing" />);
    trigger("Billing").focus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Terms" })).toHaveFocus();
    await user.tab();
    expect(trigger("Your data")).toHaveFocus();
  });

  it("arrow keys stay inside their own accordion when one is nested in another", async () => {
    const user = userEvent.setup();
    render(
      <Accordion defaultValue="outer-a">
        <Accordion.Item value="outer-a">
          <Accordion.Trigger>Outer A</Accordion.Trigger>
          <Accordion.Content>
            <Accordion>
              <Accordion.Item value="inner-a">
                <Accordion.Trigger>Inner A</Accordion.Trigger>
                <Accordion.Content>Deep</Accordion.Content>
              </Accordion.Item>
              <Accordion.Item value="inner-b">
                <Accordion.Trigger>Inner B</Accordion.Trigger>
                <Accordion.Content>Deeper</Accordion.Content>
              </Accordion.Item>
            </Accordion>
          </Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="outer-b">
          <Accordion.Trigger>Outer B</Accordion.Trigger>
          <Accordion.Content>Other</Accordion.Content>
        </Accordion.Item>
      </Accordion>
    );
    trigger("Outer A").focus();
    await user.keyboard("{ArrowDown}");
    expect(trigger("Outer B")).toHaveFocus();
    trigger("Inner B").focus();
    await user.keyboard("{ArrowDown}");
    expect(trigger("Inner A")).toHaveFocus();
  });

  it("a caller's handlers run and can opt out of the toggle", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(
      <Accordion>
        <Accordion.Item value="a">
          <Accordion.Trigger onClick={onClick}>A</Accordion.Trigger>
          <Accordion.Content>Alpha</Accordion.Content>
        </Accordion.Item>
      </Accordion>
    );
    await user.click(trigger("A"));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(trigger("A")).toHaveAttribute("aria-expanded", "false");
  });

  it("a caller's id on the content cannot break the trigger's IDREF", () => {
    render(
      <Accordion defaultValue="a">
        <Accordion.Item value="a">
          <Accordion.Trigger>A</Accordion.Trigger>
          <Accordion.Content id="mine">Alpha</Accordion.Content>
        </Accordion.Item>
      </Accordion>
    );
    const region = screen.getByRole("region", { name: "A" });
    expect(trigger("A")).toHaveAttribute("aria-controls", region.id);
  });
});
