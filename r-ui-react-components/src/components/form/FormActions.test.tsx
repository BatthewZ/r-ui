import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../primitives";
import { FormActions } from "./FormActions";

describe("FormActions", () => {
  it("is a submit/cancel row: Submit is the form's submit button, Cancel stays a plain button", async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    render(
      <form onSubmit={(e) => onSubmit(e.nativeEvent as SubmitEvent)}>
        <FormActions>
          <Button variant="secondary">Cancel</Button>
          <FormActions.Submit>Save</FormActions.Submit>
        </FormActions>
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("a press on an action leaves focus in the field, so a blur-time error cannot move the row under the pointer", async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    const onMouseDown = vi.fn();
    render(
      <form onSubmit={(e) => onSubmit(e.nativeEvent as SubmitEvent)}>
        <input aria-label="Name" />
        <FormActions onMouseDown={onMouseDown}>
          <Button variant="secondary">Cancel</Button>
          <FormActions.Submit>Save</FormActions.Submit>
        </FormActions>
      </form>,
    );
    const field = screen.getByRole("textbox", { name: "Name" });
    await userEvent.click(field);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(field).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(field).toHaveFocus();
    // The caller's handler still runs; a press on the row's own padding is left alone.
    expect(onMouseDown).toHaveBeenCalledTimes(2);
  });

  it("is hidden in print", () => {
    const { container } = render(<FormActions />);
    expect(container.firstElementChild).toHaveAttribute("data-print", "hide");
  });

  it("outside a Form, Submit's busy state is the caller's", () => {
    const { rerender } = render(<FormActions.Submit>Save</FormActions.Submit>);
    expect(screen.getByRole("button", { name: "Save" })).not.toHaveAttribute("aria-busy");
    rerender(<FormActions.Submit loading>Save</FormActions.Submit>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-busy", "true");
  });

  it("marks a sticky row, which carries the sticky layer", () => {
    const { container, rerender } = render(<FormActions />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).not.toHaveAttribute("data-sticky");
    expect(root).not.toHaveClass("sticky");
    rerender(<FormActions sticky />);
    expect(root).toHaveAttribute("data-sticky", "");
    expect(root).toHaveClass("sticky", "z-sticky");
  });
});
