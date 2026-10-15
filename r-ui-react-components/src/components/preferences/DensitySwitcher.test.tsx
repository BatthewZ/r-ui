import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { PREFERENCES_STORAGE_KEY } from "../../util/preferences";
import { DensitySwitcher } from "./DensitySwitcher";
import { InputSwitcher } from "./InputSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";

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
    render(<DensitySwitcher variant="select" labels={{ density: "Dichte", densities: { compact: "Kompakt" } }} />);
    const select = screen.getByRole("combobox", { name: "Dichte" });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Comfortable", "Kompakt"]);
    await user.selectOptions(select, "compact");
    expect(html.getAttribute("data-density")).toBe("compact");
  });
});

describe("switchers pass ref, id, ARIA and data attributes to their control", () => {
  it.each(["segmented", "select"] as const)("%s", (variant) => {
    const ref = createRef<HTMLElement>();
    render(
      <>
        <label htmlFor="density-control">Page density</label>
        <DensitySwitcher
          variant={variant}
          ref={ref}
          id="density-control"
          aria-describedby="density-help"
          data-testid="density"
        />
        <p id="density-help">Compact fits more rows.</p>
      </>,
    );
    const control = screen.getByTestId("density");
    expect(control).toBe(ref.current);
    expect(control).toHaveAttribute("id", "density-control");
    expect(control).toHaveAccessibleDescription("Compact fits more rows.");
    expect(control.getAttribute("role") ?? control.tagName.toLowerCase()).toBe(variant === "select" ? "select" : "radiogroup");
  });

  it("a caller's aria-label names this instance over the default word", () => {
    render(<ThemeSwitcher themes={["light", "aurora"]} aria-label="Header theme" data-testid="t" />);
    expect(screen.getByRole("radiogroup", { name: "Header theme" })).toBe(screen.getByTestId("t"));
  });

  it("InputSwitcher passes them on too", () => {
    const ref = createRef<HTMLElement>();
    render(<InputSwitcher ref={ref} id="input-control" data-testid="input" />);
    expect(screen.getByTestId("input")).toBe(ref.current);
    expect(ref.current).toHaveAttribute("id", "input-control");
  });
});
