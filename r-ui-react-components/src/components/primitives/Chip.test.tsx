import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";

import { Chip } from "./Chip";

describe("Chip", () => {
  it("shows its text on one line with the whole of it in the title, and no button unless removable", () => {
    render(<Chip>Region: eu-west</Chip>);
    const text = screen.getByText("Region: eu-west");
    expect(text).toHaveAttribute("title", "Region: eu-west");
    expect(text).toHaveClass("truncate");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("removes by press, Backspace and Delete on its button, named from the text and hidden in print", async () => {
    const onRemove = vi.fn();
    render(<Chip onRemove={onRemove}>Grace Hopper</Chip>);
    const remove = screen.getByRole("button", { name: "Remove Grace Hopper" });
    expect(remove).toHaveAttribute("data-print", "hide");
    await userEvent.click(remove);
    await userEvent.keyboard("{Backspace}");
    await userEvent.keyboard("{Delete}");
    await userEvent.keyboard("a");
    expect(onRemove).toHaveBeenCalledTimes(3);
  });

  it("keeps a disabled chip's button in place and refuses it", async () => {
    const onRemove = vi.fn();
    render(<Chip onRemove={onRemove} disabled>Locked</Chip>);
    const remove = screen.getByRole("button", { name: "Remove Locked" });
    expect(remove).toBeDisabled();
    await userEvent.click(remove);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("renders as a list item inside a list, and puts className on the root and slots on the parts", () => {
    render(
      <ul aria-label="Tags">
        <Chip as="li" onRemove={() => {}} className="mine" classNames={{ label: "lab", remove: "rem" }}>
          api
        </Chip>
      </ul>,
    );
    const item = screen.getByRole("listitem");
    expect(item).toHaveClass("r-primitives-chip", "mine");
    expect(screen.getByText("api")).toHaveClass("lab");
    expect(screen.getByRole("button")).toHaveClass("r-primitives-chip-remove", "rem");
  });

  it("reads its remove name from a LocaleProvider, and an instance's labels win", () => {
    render(
      <LocaleProvider labels={{ Chip: { remove: (label) => `${label} entfernen` } }}>
        <Chip onRemove={() => {}}>api</Chip>
        <Chip onRemove={() => {}} labels={{ remove: () => "Clear the region filter" }}>
          Region
        </Chip>
      </LocaleProvider>,
    );
    expect(screen.getByRole("button", { name: "api entfernen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear the region filter" })).toBeInTheDocument();
  });
});
