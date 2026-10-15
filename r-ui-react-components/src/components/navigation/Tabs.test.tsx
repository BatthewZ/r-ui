import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Tabs, type TabsActivation } from "./Tabs";

function Example({
  activation,
  onValueChange,
  dir,
}: {
  activation?: TabsActivation;
  onValueChange?: (v: string) => void;
  dir?: "rtl";
}) {
  return (
    <div dir={dir}>
      <button type="button">Before</button>
      <Tabs defaultValue="overview" activation={activation} onValueChange={onValueChange}>
        <Tabs.List aria-label="Service">
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="logs">Logs</Tabs.Tab>
          <Tabs.Tab value="traces" disabled>
            Traces
          </Tabs.Tab>
          <Tabs.Tab value="error budget">Error budget</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="overview">Overview panel</Tabs.Panel>
        <Tabs.Panel value="logs">Logs panel</Tabs.Panel>
        <Tabs.Panel value="traces">Traces panel</Tabs.Panel>
        <Tabs.Panel value="error budget">Budget panel</Tabs.Panel>
      </Tabs>
    </div>
  );
}

const tab = (name: string) => screen.getByRole("tab", { name });

describe("Tabs", () => {
  it("wires tablist, tabs and panels together by role and id", () => {
    render(<Example />);
    expect(screen.getByRole("tablist", { name: "Service" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    const panel = screen.getByRole("tabpanel", { name: "Overview" });
    expect(panel).toHaveTextContent("Overview panel");
    expect(tab("Overview")).toHaveAttribute("aria-controls", panel.id);
    // A value with a space still yields a single IDREF.
    expect(tab("Error budget").getAttribute("aria-controls")).not.toContain(" ");
  });

  it("shows only the selected panel", () => {
    render(<Example />);
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(screen.getByText("Logs panel")).not.toBeVisible();
  });

  it("is one tab stop: Tab enters on the selected tab and leaves to the panel", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole("button", { name: "Before" }));
    await user.tab();
    expect(tab("Overview")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("tabpanel")).toHaveFocus();
  });

  it("clicking a tab selects it", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Example onValueChange={onValueChange} />);
    await user.click(tab("Logs"));
    expect(tab("Logs")).toHaveAttribute("aria-selected", "true");
    expect(tab("Overview")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel", { name: "Logs" })).toHaveTextContent("Logs panel");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("logs");
  });

  describe("automatic activation", () => {
    it("arrows move focus and selection, skipping disabled tabs and wrapping", async () => {
      const user = userEvent.setup();
      render(<Example />);
      await user.click(tab("Overview"));
      await user.keyboard("{ArrowRight}");
      expect(tab("Logs")).toHaveFocus();
      expect(tab("Logs")).toHaveAttribute("aria-selected", "true");
      await user.keyboard("{ArrowRight}");
      expect(tab("Error budget")).toHaveFocus();
      expect(tab("Traces")).toHaveAttribute("aria-selected", "false");
      await user.keyboard("{ArrowRight}");
      expect(tab("Overview")).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      expect(tab("Error budget")).toHaveFocus();
      expect(tab("Error budget")).toHaveAttribute("aria-selected", "true");
    });

    it("Home and End jump to the ends", async () => {
      const user = userEvent.setup();
      render(<Example />);
      await user.click(tab("Logs"));
      await user.keyboard("{End}");
      expect(tab("Error budget")).toHaveFocus();
      await user.keyboard("{Home}");
      expect(tab("Overview")).toHaveFocus();
      expect(tab("Overview")).toHaveAttribute("aria-selected", "true");
    });

    it("mirrors the arrows in a right-to-left context", async () => {
      const user = userEvent.setup();
      render(<Example dir="rtl" />);
      await user.click(tab("Overview"));
      await user.keyboard("{ArrowLeft}");
      expect(tab("Logs")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      expect(tab("Overview")).toHaveFocus();
    });
  });

  describe("manual activation", () => {
    it("arrows move focus only; Enter and Space select", async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<Example activation="manual" onValueChange={onValueChange} />);
      await user.click(tab("Overview"));
      onValueChange.mockClear();

      await user.keyboard("{ArrowRight}");
      expect(tab("Logs")).toHaveFocus();
      expect(tab("Logs")).toHaveAttribute("aria-selected", "false");
      expect(tab("Overview")).toHaveAttribute("aria-selected", "true");
      expect(onValueChange).not.toHaveBeenCalled();

      await user.keyboard("{Enter}");
      expect(tab("Logs")).toHaveAttribute("aria-selected", "true");
      expect(onValueChange).toHaveBeenCalledTimes(1);

      await user.keyboard("{ArrowRight}{ }");
      expect(tab("Error budget")).toHaveAttribute("aria-selected", "true");
      expect(onValueChange).toHaveBeenCalledTimes(2);
    });
  });

  it("controlled: selection follows the owner's state", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [value, setValue] = useState("b");
      return (
        <>
          <Tabs value={value} onValueChange={setValue}>
            <Tabs.List aria-label="Pick">
              <Tabs.Tab value="a">A</Tabs.Tab>
              <Tabs.Tab value="b">B</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="a">Panel A</Tabs.Panel>
            <Tabs.Panel value="b">Panel B</Tabs.Panel>
          </Tabs>
          <button type="button" onClick={() => setValue("a")}>
            External
          </button>
        </>
      );
    }
    render(<Owner />);
    expect(tab("B")).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("button", { name: "External" }));
    expect(tab("A")).toHaveAttribute("aria-selected", "true");
    expect(tab("A")).toHaveAttribute("tabindex", "0");
    expect(tab("B")).toHaveAttribute("tabindex", "-1");
  });

  it("a caller's onClick runs, and preventDefault keeps the selection", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <Tabs defaultValue="a">
        <Tabs.List aria-label="Pick">
          <Tabs.Tab value="a">A</Tabs.Tab>
          <Tabs.Tab value="b" onClick={onClick}>
            B
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>,
    );
    await user.click(tab("B"));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(tab("A")).toHaveAttribute("aria-selected", "true");
  });

  it("styles each variant differently", () => {
    const { rerender } = render(
      <Tabs defaultValue="a">
        <Tabs.List aria-label="Pick">
          <Tabs.Tab value="a">A</Tabs.Tab>
        </Tabs.List>
      </Tabs>,
    );
    expect(screen.getByRole("tablist")).toHaveClass("r-navigation-tabs-underline");
    expect(tab("A")).toHaveClass("r-navigation-tab-underline");
    rerender(
      <Tabs defaultValue="a" variant="enclosed">
        <Tabs.List aria-label="Pick">
          <Tabs.Tab value="a">A</Tabs.Tab>
        </Tabs.List>
      </Tabs>,
    );
    expect(screen.getByRole("tablist")).toHaveClass("r-navigation-tabs-enclosed");
    expect(tab("A")).not.toHaveClass("r-navigation-tab-underline");
  });
});
