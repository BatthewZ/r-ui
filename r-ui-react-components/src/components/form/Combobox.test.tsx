import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { stubPopover } from "../overlays/overlay-stubs.test.helpers";
import { Combobox } from "./Combobox";
import { Field } from "./Field";
import type { ComboboxOption } from "./selection-popup";

const SERVICES: ComboboxOption[] = [
  { value: "api", label: "Payments API", description: "eu-west-1" },
  { value: "zurich", label: "Zürich edge" },
  { value: "search", label: "Search", disabled: true },
  { value: "web", label: "Web frontend" },
];

function Labelled(props: Partial<React.ComponentProps<typeof Combobox>> & { error?: string }) {
  const { error, ...rest } = props;
  return (
    <Field required>
      <Field.Label>Service</Field.Label>
      <Combobox options={SERVICES} {...rest} />
      <Field.Description>Where the alert fired.</Field.Description>
      <Field.Error>{error}</Field.Error>
    </Field>
  );
}

const input = () => screen.getByRole("combobox", { name: "Service" });
const active = () => {
  const id = input().getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
};

describe("Combobox", () => {
  it("is a Field control: named by the label, described, required, invalid from Field.Error", () => {
    render(<Labelled error="Pick a service." />);
    const box = input();
    expect(box).toBeRequired();
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription("Where the alert fired. Pick a service.");
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(box).not.toHaveAttribute("aria-controls");
  });

  it("filters ignoring case and diacritics, highlights the first match and the matched text", async () => {
    const user = userEvent.setup();
    render(<Labelled />);
    await user.type(input(), "zur");
    const listbox = screen.getByRole("listbox", { name: "Service" });
    expect(input()).toHaveAttribute("aria-controls", listbox.id);
    const options = within(listbox).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Zürich edge"]);
    expect(active()).toBe(options[0]);
    expect(options[0]!.querySelector("mark")).toHaveTextContent(/^Zür$/);
    expect(screen.getByRole("status")).toHaveTextContent("1 result");
  });

  it("Enter takes the highlighted option once, puts its label in the field and closes", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Labelled onValueChange={onValueChange} />);
    await user.type(input(), "pay{Enter}");
    expect(onValueChange.mock.calls).toEqual([["api", SERVICES[0]]]);
    expect(input()).toHaveValue("Payments API");
    expect(input()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();
    // Reopened, the list shows everything again with the choice marked.
    await user.keyboard("{ArrowDown}");
    const chosen = screen.getByRole("option", { name: /Payments API/ });
    expect(screen.getAllByRole("option")).toHaveLength(4);
    expect(chosen).toHaveAttribute("aria-selected", "true");
    expect(active()).toBe(chosen);
  });

  it("arrows skip disabled options and wrap; Home and End jump; focus never leaves the input", async () => {
    const user = userEvent.setup();
    render(<Labelled />);
    await user.click(input());
    await user.keyboard("{ArrowDown}");
    expect(active()).toHaveTextContent("Payments API");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(active()).toHaveTextContent("Web frontend");
    expect(screen.getByRole("option", { name: "Search" })).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{ArrowDown}");
    expect(active()).toHaveTextContent("Payments API");
    await user.keyboard("{End}");
    expect(active()).toHaveTextContent("Web frontend");
    await user.keyboard("{Home}");
    expect(active()).toHaveTextContent("Payments API");
    expect(input()).toHaveFocus();
    expect(active()).toHaveAttribute("data-active", "keyboard");
  });

  it("Escape closes and reverts the typed text; Escape again clears the value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Labelled defaultValue="web" onValueChange={onValueChange} />);
    expect(input()).toHaveValue("Web frontend");
    await user.clear(input());
    await user.type(input(), "zz");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input()).toHaveValue("Web frontend");
    expect(onValueChange).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(input()).toHaveValue("");
    expect(onValueChange.mock.calls).toEqual([[null, null]]);
  });

  it("leaves an Escape it has no use for to the surface around it", async () => {
    const user = userEvent.setup();
    const outer = vi.fn();
    render(
      <div onKeyDown={(event) => outer(event.defaultPrevented)}>
        <Labelled />
      </div>,
    );
    await user.click(input());
    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");
    expect(outer.mock.calls).toEqual([[true], [false]]);
  });

  it("Tab takes the keyboard's highlight and moves on; a hovered option is not taken", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <>
        <Labelled onValueChange={onValueChange} />
        <button type="button">Next</button>
      </>,
    );
    await user.type(input(), "web");
    await user.tab();
    expect(onValueChange.mock.calls).toEqual([["web", SERVICES[3]]]);
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();

    await user.click(input());
    await user.hover(screen.getByRole("option", { name: /Payments API/ }));
    expect(active()).toHaveAttribute("data-active", "pointer");
    await user.tab();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(input()).toHaveValue("Web frontend");
  });

  it("on blur, text that is no option reverts and an exact label is taken", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <>
        <Labelled onValueChange={onValueChange} />
        <button type="button">Elsewhere</button>
      </>,
    );
    await user.type(input(), "nothing like it");
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(input()).toHaveValue("");
    expect(onValueChange).not.toHaveBeenCalled();
    await user.type(input(), "web FRONTEND");
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(onValueChange.mock.calls).toEqual([["web", SERVICES[3]]]);
    expect(input()).toHaveValue("Web frontend");
  });

  it("a click on an option takes it and keeps focus in the input; a disabled one is refused", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Labelled onValueChange={onValueChange} />);
    await user.click(input());
    await user.click(screen.getByRole("option", { name: "Search" }));
    expect(onValueChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("option", { name: /Zürich/ }));
    expect(onValueChange.mock.calls).toEqual([["zurich", SERVICES[1]]]);
    expect(input()).toHaveFocus();
  });

  it("offers free text first with allowCustomValue, and commits it", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Labelled allowCustomValue onValueChange={onValueChange} />);
    await user.type(input(), "pay-v2");
    const custom = screen.getAllByRole("option")[0]!;
    expect(custom).toHaveTextContent("Use “pay-v2”");
    expect(active()).toBe(custom);
    await user.keyboard("{Enter}");
    expect(onValueChange.mock.calls).toEqual([["pay-v2", null]]);
    expect(input()).toHaveValue("pay-v2");
    // An exact label is not offered as free text.
    await user.clear(input());
    await user.type(input(), "search");
    expect(screen.queryByText(/Use “/)).toBeNull();
  });

  it("groups options under headings that name each group", async () => {
    const user = userEvent.setup();
    render(
      <Combobox
        aria-label="Owner"
        options={[
          { value: "a", label: "Ada", group: "People" },
          { value: "p", label: "Payments", group: "Teams" },
          { value: "g", label: "Grace", group: "People" },
        ]}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Owner" }));
    const people = screen.getByRole("group", { name: "People" });
    expect(within(people).getAllByRole("option").map((o) => o.textContent)).toEqual(["Ada", "Grace"]);
    expect(within(screen.getByRole("group", { name: "Teams" })).getAllByRole("option")).toHaveLength(1);
    // Keyboard order is drawn order.
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(document.getElementById(screen.getByRole("combobox").getAttribute("aria-activedescendant")!)).toHaveTextContent(
      "Grace",
    );
  });

  it("async: reports typing with its reason, shows loading and errors, and does not filter", async () => {
    const user = userEvent.setup();
    const onInputChange = vi.fn();
    function Async() {
      const [state, setState] = useState<"idle" | "loading" | "error">("idle");
      return (
        <Combobox
          aria-label="Repo"
          filter={false}
          options={state === "idle" ? [{ value: "x", label: "unrelated" }] : []}
          loading={state === "loading"}
          loadError={state === "error" ? "Could not load repositories." : undefined}
          onInputChange={(text, reason) => {
            onInputChange(text, reason);
            setState(text === "err" ? "error" : text.length === 1 ? "loading" : "idle");
          }}
        />
      );
    }
    render(<Async />);
    const box = screen.getByRole("combobox", { name: "Repo" });
    await user.type(box, "q");
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    await user.type(box, "q");
    // Not filtered by the component: "qq" does not match, the option still shows.
    expect(screen.getByRole("option", { name: "unrelated" })).toBeInTheDocument();
    await user.clear(box);
    await user.type(box, "err");
    expect(screen.getByRole("listbox").parentElement).toHaveTextContent("Could not load repositories.");
    expect(screen.getByRole("status")).toHaveTextContent("Could not load repositories.");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(onInputChange.mock.calls.slice(0, 2)).toEqual([
      ["q", "input"],
      ["qq", "input"],
    ]);
  });

  it("keeps an option's id while the list re-filters around it, and every id is one IDREF", async () => {
    const user = userEvent.setup();
    render(<Labelled />);
    await user.click(input());
    const before = screen.getByRole("option", { name: "Web frontend" }).id;
    await user.type(input(), "web");
    const after = screen.getByRole("option", { name: "Web frontend" });
    expect(after.id).toBe(before);
    expect(active()).toBe(after);

    const { unmount } = render(
      <Combobox
        aria-label="Odd"
        defaultOpen
        options={[
          { value: "two words", label: "Spaced" },
          { value: "two_20_words", label: "Escaped look-alike" },
        ]}
      />,
    );
    const ids = within(screen.getByRole("listbox", { name: "Odd" }))
      .getAllByRole("option")
      .map((o) => o.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(id).not.toMatch(/\s/);
    unmount();
  });

  it("a load error lists no options: the cursor points at nothing and Enter takes nothing", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Combobox
        aria-label="Repo"
        options={[{ value: "alpha", label: "Alpha" }]}
        loadError="Could not load repositories."
        onValueChange={onValueChange}
      />,
    );
    const box = screen.getByRole("combobox", { name: "Repo" });
    await user.type(box, "Al");
    expect(screen.getByRole("listbox").parentElement).toHaveTextContent("Could not load repositories.");
    expect(box).not.toHaveAttribute("aria-activedescendant");
    await user.keyboard("{ArrowDown}");
    expect(box).not.toHaveAttribute("aria-activedescendant");
    await user.keyboard("{Enter}");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("windows a long list, and the keyboard's option is always mounted", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 2000 }, (_, i) => ({ value: `v${i}`, label: `Host ${i}` }));
    render(<Combobox aria-label="Host" options={many} />);
    const box = screen.getByRole("combobox", { name: "Host" });
    await user.click(box);
    const rendered = screen.getAllByRole("option");
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(100);
    expect(rendered[0]).toHaveAttribute("aria-setsize", "2000");
    await user.keyboard("{ArrowDown}{End}");
    const last = document.getElementById(box.getAttribute("aria-activedescendant")!);
    expect(last).toHaveTextContent("Host 1999");
    expect(last).toHaveAttribute("aria-posinset", "2000");
  });

  it("submits its value through a hidden input, and nothing visible carries the name", async () => {
    const user = userEvent.setup();
    let submitted: FormData | null = null;
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted = new FormData(event.currentTarget);
        }}
      >
        <Labelled name="service" />
        <button type="submit">Save</button>
      </form>,
    );
    await user.type(input(), "zur{Enter}");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(submitted).not.toBeNull();
    expect(submitted!.getAll("service")).toEqual(["zurich"]);
    expect(input()).not.toHaveAttribute("name");
  });

  it("Enter in an open list never submits the form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.SubmitEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Labelled />
      </form>,
    );
    await user.type(input(), "pay{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("follows a controlled value", () => {
    const { rerender } = render(<Labelled value="api" />);
    expect(input()).toHaveValue("Payments API");
    rerender(<Labelled value="web" />);
    expect(input()).toHaveValue("Web frontend");
    rerender(<Labelled value={null} />);
    expect(input()).toHaveValue("");
  });

  it("disabled and read-only never open", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Combobox aria-label="Off" disabled options={SERVICES} />
        <Combobox aria-label="Fixed" readOnly defaultValue="api" options={SERVICES} />
      </>,
    );
    await user.click(screen.getByRole("combobox", { name: "Off" }));
    await user.click(screen.getByRole("combobox", { name: "Fixed" }));
    await user.keyboard("{ArrowDown}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Fixed" })).toHaveValue("Payments API");
  });

  it("renders the list in place and promotes it to the top layer", async () => {
    const popover = stubPopover();
    try {
      const user = userEvent.setup();
      render(
        <div data-testid="card">
          <Labelled />
        </div>,
      );
      await user.click(input());
      const listbox = screen.getByRole("listbox", { hidden: true });
      expect(screen.getByTestId("card")).toContainElement(listbox);
      expect(popover.show).toHaveBeenCalledTimes(1);
      expect(listbox.parentElement).toHaveAttribute("popover", "manual");
    } finally {
      popover.restore();
    }
  });
});
