import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Field } from "./Field";
import { SearchInput } from "./SearchInput";

describe("SearchInput", () => {
  it("is a searchbox named 'Search' by default, and stands aside for a Field label", () => {
    render(
      <>
        <SearchInput />
        <Field>
          <Field.Label>Find incidents</Field.Label>
          <SearchInput />
        </Field>
      </>,
    );
    expect(screen.getByRole("searchbox", { name: "Search" })).toBeInTheDocument();
    const labelled = screen.getByRole("searchbox", { name: "Find incidents" });
    expect(labelled).not.toHaveAttribute("aria-label");
  });

  it("shows a clear button only while there is text; clearing empties, refocuses and reports once", async () => {
    const onValueChange = vi.fn();
    const onClear = vi.fn();
    render(<SearchInput onValueChange={onValueChange} onClear={onClear} />);
    const input = screen.getByRole("searchbox");
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();

    await userEvent.type(input, "db");
    expect(onValueChange).toHaveBeenLastCalledWith("db");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledTimes(3);
    expect(onValueChange).toHaveBeenLastCalledWith("");
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("Escape clears and is consumed; on an empty field it reaches the ancestor", async () => {
    const outer = vi.fn();
    render(
      <div onKeyDown={(e) => e.key === "Escape" && outer()}>
        <SearchInput defaultValue="abc" />
      </div>,
    );
    const input = screen.getByRole("searchbox");
    input.focus();
    await userEvent.keyboard("{Escape}");
    expect(input).toHaveValue("");
    expect(outer).toHaveBeenCalledTimes(0);

    await userEvent.keyboard("{Escape}");
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it("is controlled with value + onValueChange", async () => {
    function Harness() {
      const [q, setQ] = useState("seed");
      return (
        <>
          <SearchInput value={q} onValueChange={setQ} />
          <output>{q}</output>
        </>
      );
    }
    render(<Harness />);
    await userEvent.type(screen.getByRole("searchbox"), "s");
    expect(screen.getByRole("status")).toHaveTextContent("seeds");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("never clears a read-only or disabled field", async () => {
    render(
      <>
        <SearchInput aria-label="RO" readOnly defaultValue="keep" />
        <SearchInput aria-label="Off" disabled defaultValue="keep" />
      </>,
    );
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    const ro = screen.getByRole("searchbox", { name: "RO" });
    ro.focus();
    await userEvent.keyboard("{Escape}");
    expect(ro).toHaveValue("keep");
  });

  it("marks itself busy while loading", () => {
    const { rerender } = render(<SearchInput loading />);
    expect(screen.getByRole("searchbox")).toHaveAttribute("aria-busy", "true");
    rerender(<SearchInput />);
    expect(screen.getByRole("searchbox")).not.toHaveAttribute("aria-busy");
  });

  it("takes a custom clear label", async () => {
    render(<SearchInput defaultValue="x" clearLabel="Effacer" />);
    expect(screen.getByRole("button", { name: "Effacer" })).toBeInTheDocument();
  });
});
