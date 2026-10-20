import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

describe("Button", () => {
  it("is a type=button named by its label, so it never submits a form by accident", async () => {
    const onSubmit = vi.fn((e: Event) => e.preventDefault());
    render(
      <form onSubmit={(e) => onSubmit(e.nativeEvent)}>
        <Button>Cancel</Button>
      </form>,
    );
    const button = screen.getByRole("button", { name: "Cancel" });
    expect(button).toHaveAttribute("type", "button");
    await userEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(0);
  });

  it("still submits when the caller asks for type=submit", async () => {
    const onSubmit = vi.fn((e: Event) => e.preventDefault());
    render(
      <form onSubmit={(e) => onSubmit(e.nativeEvent)}>
        <Button type="submit">Save</Button>
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("activates once per click, Enter and Space", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    const button = screen.getByRole("button", { name: "Go" });
    await userEvent.click(button);
    button.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("paints the variant's classes and lets the caller's className win a conflict", () => {
    render(
      <>
        <Button>Primary</Button>
        <Button variant="danger">Delete</Button>
        <Button className="px-r1">Wide</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Primary" })).toHaveClass("bg-primary", "text-fg-on-primary", "h-control");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("bg-status-error", "text-fg-on-error");
    const wide = screen.getByRole("button", { name: "Wide" });
    expect(wide).toHaveClass("px-r1");
    expect(wide).not.toHaveClass("px-control-pad");
  });

  it("works as a toggle through aria-pressed, painted like a pressed IconButton", () => {
    render(
      <>
        <Button variant="secondary" aria-pressed>
          Wrap
        </Button>
        <Button variant="secondary" aria-pressed={false}>
          Pin
        </Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Wrap", pressed: true })).toHaveClass("aria-pressed:bg-selection", "aria-pressed:text-fg-on-selection");
    expect(screen.getByRole("button", { name: "Pin", pressed: false })).toBeInTheDocument();
  });

  it("renders icons as decoration that does not change the accessible name", () => {
    render(
      <Button iconStart={<svg data-testid="start" />} iconEnd={<svg data-testid="end" />}>
        Export
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByTestId("start").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("end").parentElement).toHaveAttribute("aria-hidden", "true");
  });

  describe("loading", () => {
    it("is busy, keeps its name and focus, shows a spinner, and ignores activation", async () => {
      const onClick = vi.fn();
      render(
        <Button loading onClick={onClick}>
          Saving
        </Button>,
      );
      const button = screen.getByRole("button", { name: "Saving" });
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).not.toBeDisabled();
      // The label is hidden by opacity (still measured: width does not jump) and a spinner overlays it.
      expect(screen.getByText("Saving").parentElement).toHaveClass("opacity-0");
      expect(button.querySelector("svg.animate-spin")).not.toBeNull();

      button.focus();
      await userEvent.keyboard("{Enter}");
      await userEvent.click(button, { pointerEventsCheck: 0 });
      expect(onClick).toHaveBeenCalledTimes(0);
      expect(button).toHaveFocus();
    });

    it("does not submit its form again while busy", async () => {
      const onSubmit = vi.fn((e: Event) => e.preventDefault());
      render(
        <form onSubmit={(e) => onSubmit(e.nativeEvent)}>
          <Button type="submit" loading>
            Save
          </Button>
        </form>,
      );
      const button = screen.getByRole("button", { name: "Save" });
      button.focus();
      await userEvent.keyboard("{Enter}");
      await userEvent.click(button, { pointerEventsCheck: 0 });
      expect(onSubmit).toHaveBeenCalledTimes(0);
    });

    it("resumes activation when loading ends", async () => {
      const onClick = vi.fn();
      const { rerender } = render(
        <Button loading onClick={onClick}>
          Save
        </Button>,
      );
      rerender(<Button onClick={onClick}>Save</Button>);
      const button = screen.getByRole("button", { name: "Save" });
      expect(button).not.toHaveAttribute("aria-busy");
      await userEvent.click(button);
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  it("disabled: native disabled blocks clicks; aria-disabled stays focusable and blocks activation", async () => {
    const onClick = vi.fn();
    render(
      <>
        <Button disabled onClick={onClick}>
          Native
        </Button>
        <Button aria-disabled onClick={onClick}>
          Aria
        </Button>
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Native" }), { pointerEventsCheck: 0 });
    const aria = screen.getByRole("button", { name: "Aria" });
    aria.focus();
    expect(aria).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(0);
  });

  it("forwards ref and arbitrary props to the <button>", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button ref={ref} data-testid="b" aria-describedby="hint">
        Ok
      </Button>,
    );
    expect(ref.current).toBe(screen.getByTestId("b"));
    expect(ref.current).toHaveAttribute("aria-describedby", "hint");
  });
});
