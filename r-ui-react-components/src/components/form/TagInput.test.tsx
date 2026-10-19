import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Field } from "./Field";
import { TagInput } from "./TagInput";

function Labels(props: Partial<React.ComponentProps<typeof TagInput>>) {
  return (
    <Field>
      <Field.Label>Labels</Field.Label>
      <TagInput {...props} />
      <Field.Description>Comma or Enter adds a label.</Field.Description>
    </Field>
  );
}

const input = () => screen.getByRole("textbox", { name: "Labels" });
const tags = () => {
  const list = screen.queryByRole("list", { name: "Tags" });
  return list ? within(list).getAllByRole("listitem").map((li) => li.textContent) : [];
};
const spoken = () => screen.getByRole("status").textContent?.trim();

describe("TagInput", () => {
  it("adds a trimmed tag on Enter and on a typed comma, and announces it", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Labels onValueChange={onValueChange} />);
    await user.type(input(), "  p1 {Enter}");
    await user.type(input(), "checkout,");
    expect(onValueChange.mock.calls).toEqual([[["p1"]], [["p1", "checkout"]]]);
    expect(tags()).toEqual(["p1", "checkout"]);
    expect(input()).toHaveValue("");
    expect(spoken()).toBe("Added checkout. 2 tags.");
  });

  it("splits a paste into tags and keeps an unterminated tail as the draft", () => {
    const onValueChange = vi.fn();
    render(<Labels onValueChange={onValueChange} />);
    fireEvent.paste(input(), { clipboardData: { getData: () => "alpha, beta;gamma\ndelta" } });
    expect(onValueChange.mock.calls).toEqual([[["alpha", "beta", "gamma"]]]);
    expect(input()).toHaveValue("delta");
    expect(spoken()).toBe("Added alpha, beta, gamma. 3 tags.");
  });

  it("refuses a duplicate (ignoring case), keeps the text, and shows and announces why", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(<Labels defaultValue={["Checkout"]} onValueChange={onValueChange} />);
    const fieldRoot = container.firstElementChild!;
    expect(fieldRoot).not.toHaveAttribute("data-invalid");
    await user.type(input(), "checkout{Enter}");
    expect(onValueChange).not.toHaveBeenCalled();
    // The refusal is the Field's error too, as a date field's "not a date" is.
    expect(fieldRoot).toHaveAttribute("data-invalid", "");
    expect(input()).toHaveValue("checkout");
    expect(input()).toHaveAttribute("aria-invalid", "true");
    expect(input()).toHaveAccessibleDescription("“checkout” is already added. Comma or Enter adds a label.");
    expect(spoken()).toBe("“checkout” is already added.");
    // Editing the draft clears the refusal.
    await user.type(input(), "s");
    expect(input()).not.toHaveAttribute("aria-invalid");
    expect(fieldRoot).not.toHaveAttribute("data-invalid");
    expect(input()).toHaveAccessibleDescription("Comma or Enter adds a label.");
  });

  it("validates each tag; a paste stops at the first refusal and keeps it and the rest", () => {
    const onValueChange = vi.fn();
    render(
      <Labels
        onValueChange={onValueChange}
        validate={(tag) => (/^[a-z0-9-]+$/.test(tag) ? null : `“${tag}” may use a–z, 0–9 and dashes.`)}
      />,
    );
    fireEvent.paste(input(), { clipboardData: { getData: () => "ok-1, Not OK, ok-2," } });
    expect(onValueChange.mock.calls).toEqual([[["ok-1"]]]);
    expect(input()).toHaveValue("Not OK, ok-2");
    expect(screen.getByText("“Not OK” may use a–z, 0–9 and dashes.")).toBeInTheDocument();
    expect(spoken()).toBe("Added ok-1. 1 tag. “Not OK” may use a–z, 0–9 and dashes.");
  });

  it("refuses a typed tag its validate rejects: kept as the draft, invalid, described by why", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Labels onValueChange={onValueChange} validate={(tag) => (/^[a-z0-9-]+$/.test(tag) ? null : `“${tag}” may use only a–z, 0–9 and dashes.`)} />);
    await user.type(input(), "sev2,Not Valid{Enter}");
    expect(onValueChange.mock.calls).toEqual([[["sev2"]]]);
    expect(tags()).toEqual(["sev2"]);
    expect(input()).toHaveValue("Not Valid");
    expect(input()).toHaveAttribute("aria-invalid", "true");
    expect(input()).toHaveAccessibleDescription("“Not Valid” may use only a–z, 0–9 and dashes. Comma or Enter adds a label.");
  });

  it("stops at max", async () => {
    const user = userEvent.setup();
    render(<Labels max={1} defaultValue={["a"]} />);
    await user.type(input(), "b{Enter}");
    expect(tags()).toEqual(["a"]);
    expect(input()).toHaveAccessibleDescription("Up to 1 tag. Comma or Enter adds a label.");
    expect(input()).toHaveValue("b");
  });

  it("Backspace in an empty field removes the last tag; remove buttons are in the tab order", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Labels defaultValue={["a", "b", "c"]} onValueChange={onValueChange} />);
    await user.click(input());
    await user.keyboard("{Backspace}");
    expect(onValueChange.mock.calls).toEqual([[["a", "b"]]]);
    expect(spoken()).toBe("Removed c. 2 tags.");
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Remove b" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(tags()).toEqual(["a"]);
    expect(screen.getByRole("button", { name: "Remove a" })).toHaveFocus();
  });

  it("commits the draft on blur, and submits only committed tags", async () => {
    const user = userEvent.setup();
    let submitted: FormData | null = null;
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted = new FormData(event.currentTarget);
        }}
      >
        <Labels name="labels" defaultValue={["p1"]} />
        <button type="submit">Save</button>
      </form>,
    );
    await user.type(input(), "sev2");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(submitted!.getAll("labels")).toEqual(["p1", "sev2"]);
    expect(input()).not.toHaveAttribute("name");
  });

  it("Enter with a draft never submits the form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.SubmitEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Labels />
        <button type="submit">Save</button>
      </form>,
    );
    await user.type(input(), "x{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("with suggestions it is a combobox: arrows pick a suggestion, Enter adds it, added ones are not offered", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Labels suggestions={["payments", "paging", "platform"]} defaultValue={["platform"]} onValueChange={onValueChange} />);
    const box = screen.getByRole("combobox", { name: "Labels" });
    await user.type(box, "pa");
    const listbox = screen.getByRole("listbox", { name: "Labels" });
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual(["payments", "paging"]);
    // Nothing is highlighted until the arrows move, so Enter would add the draft.
    expect(box).not.toHaveAttribute("aria-activedescendant");
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onValueChange.mock.calls).toEqual([[["platform", "paging"]]]);
    // The draft was the search for it, so it goes too.
    expect(box).toHaveValue("");
    await user.clear(box);
    await user.type(box, "zz");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(box).toHaveAttribute("aria-expanded", "false");
  });

  it("a caller's sticky or global delimiter still splits anywhere, on every commit", async () => {
    const user = userEvent.setup();
    render(<Labels delimiter={/\|/gy} />);
    await user.type(input(), "a|b|c|");
    expect(tags()).toEqual(["a", "b", "c"]);
  });
});
