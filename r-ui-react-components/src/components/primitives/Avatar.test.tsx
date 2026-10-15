import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("shows the image, named by `name`, as one img", () => {
    const { container } = render(<Avatar src="https://example.com/a.png" name="Ada Lovelace" />);
    const avatar = screen.getByRole("img", { name: "Ada Lovelace" });
    expect(avatar).toHaveClass("size-control");
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("falls back to initials (first and last word) when there is no src", () => {
    render(<Avatar name="grace brewster murray hopper" />);
    expect(screen.getByRole("img", { name: "grace brewster murray hopper" })).toHaveTextContent(/^GH$/);
  });

  it("falls back to initials when the image fails, and retries a new src", () => {
    const { container, rerender } = render(<Avatar src="https://example.com/broken.png" name="Ada Lovelace" />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "Ada Lovelace" })).toHaveTextContent("AL");

    rerender(<Avatar src="https://example.com/ok.png" name="Ada Lovelace" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://example.com/ok.png");
  });

  it("refuses a scriptable src and shows initials instead", () => {
    const { container } = render(<Avatar src="javascript:alert(1)" name="Mallory" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "Mallory" })).toHaveTextContent("M");
  });

  it("uses one initial at icon size, and whole characters for astral names", () => {
    render(
      <>
        <Avatar size="icon" name="Ada Lovelace" data-testid="small" />
        <Avatar name="𝔄da 𝔅yron" data-testid="astral" />
      </>,
    );
    expect(screen.getByTestId("small")).toHaveTextContent(/^A$/);
    expect(screen.getByTestId("small")).toHaveClass("size-icon");
    expect(screen.getByTestId("astral")).toHaveTextContent(/^𝔄𝔅$/u);
  });

  it("alt overrides the name; alt='' or no name makes it decorative", () => {
    const { rerender, container } = render(<Avatar name="Ada Lovelace" alt="Your profile" />);
    expect(screen.getByRole("img", { name: "Your profile" })).toBeInTheDocument();
    rerender(<Avatar name="Ada Lovelace" alt="" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    rerender(<Avatar />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});
