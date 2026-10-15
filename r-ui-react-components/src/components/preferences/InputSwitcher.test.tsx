import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { PREFERENCES_STORAGE_KEY } from "../../util/preferences";
import { InputSwitcher } from "./InputSwitcher";

const html = document.documentElement;

beforeEach(() => {
  html.removeAttribute("data-input");
  localStorage.clear();
});

describe("InputSwitcher", () => {
  it("offers auto / fine / coarse in plain words, auto first and checked", () => {
    render(<InputSwitcher />);
    expect(screen.getByRole("radiogroup", { name: "Input" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual(["auto", "fine", "coarse"]);
    expect(screen.getByRole("radio", { name: "Auto" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Touch" })).toHaveAttribute("value", "coarse");
  });

  it("forces a mode on <html>, saves it, and auto removes the attribute", async () => {
    const user = userEvent.setup();
    render(<InputSwitcher storageKey="app:view" labels={{ inputs: { coarse: "Grob" } }} />);
    await user.click(screen.getByRole("radio", { name: "Grob" }));
    expect(html.getAttribute("data-input")).toBe("coarse");
    expect(JSON.parse(localStorage.getItem("app:view")!)).toEqual({ input: "coarse" });

    await user.click(screen.getByRole("radio", { name: "Auto" }));
    expect(html.hasAttribute("data-input")).toBe(false);
    expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
  });
});
