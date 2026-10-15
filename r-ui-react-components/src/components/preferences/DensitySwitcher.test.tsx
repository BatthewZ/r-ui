import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { PREFERENCES_STORAGE_KEY } from "../../util/preferences";
import { DensitySwitcher } from "./DensitySwitcher";

const html = document.documentElement;

beforeEach(() => {
  html.removeAttribute("data-density");
  localStorage.clear();
});

describe("DensitySwitcher", () => {
  it("sets and clears data-density on <html> and saves the choice", async () => {
    const user = userEvent.setup();
    render(<DensitySwitcher />);
    expect(screen.getByRole("radiogroup", { name: "Density" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Comfortable" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Compact" }));
    expect(html.getAttribute("data-density")).toBe("compact");
    expect(JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY)!)).toEqual({ density: "compact" });

    await user.click(screen.getByRole("radio", { name: "Comfortable" }));
    expect(html.hasAttribute("data-density")).toBe(false);
  });

  it("takes translated words and a select form", async () => {
    const user = userEvent.setup();
    render(<DensitySwitcher variant="select" label="Dichte" labels={{ compact: "Kompakt" }} />);
    const select = screen.getByRole("combobox", { name: "Dichte" });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Comfortable", "Kompakt"]);
    await user.selectOptions(select, "compact");
    expect(html.getAttribute("data-density")).toBe("compact");
  });
});
