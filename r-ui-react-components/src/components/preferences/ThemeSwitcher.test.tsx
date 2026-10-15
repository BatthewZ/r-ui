import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PREFERENCES_STORAGE_KEY } from "../../util/preferences";
import { ThemeSwitcher } from "./ThemeSwitcher";

// App-defined themes: the switcher has no list of its own.
const THEMES = [
  { value: "default", label: "Light" },
  { value: "aurora", label: "Aurora" },
  { value: "midnight", label: "Midnight" },
] as const;
const html = document.documentElement;

beforeEach(() => {
  html.removeAttribute("data-theme");
  localStorage.clear();
});

describe("ThemeSwitcher", () => {
  it("is a named radio group of exactly the consumer's themes, the current one checked", () => {
    html.setAttribute("data-theme", "aurora");
    render(<ThemeSwitcher themes={THEMES} />);
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((r) => r.closest("label")?.textContent)).toEqual(["Light", "Aurora", "Midnight"]);
    expect(screen.getByRole("radio", { name: "Aurora" })).toBeChecked();
  });

  it("choosing a theme applies it to <html> and saves it; the first entry clears the attribute", async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher themes={THEMES} storageKey="app:view" />);
    await user.click(screen.getByRole("radio", { name: "Midnight" }));
    expect(html.getAttribute("data-theme")).toBe("midnight");
    expect(JSON.parse(localStorage.getItem("app:view")!)).toEqual({ theme: "midnight" });
    await vi.waitFor(() => expect(screen.getByRole("radio", { name: "Midnight" })).toBeChecked());

    await user.click(screen.getByRole("radio", { name: "Light" }));
    expect(html.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
  });

  it("follows a theme changed elsewhere (a second switcher)", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ThemeSwitcher themes={THEMES} label="Header theme" />
        <ThemeSwitcher themes={THEMES} label="Settings theme" variant="select" />
      </>,
    );
    await user.click(screen.getByRole("radio", { name: "Aurora" }));
    await vi.waitFor(() => expect(screen.getByRole("combobox", { name: "Settings theme" })).toHaveValue("aurora"));
  });

  it("select variant: a labelled native select that sets the theme", async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher themes={["default", "aurora"]} variant="select" label="Colour theme" />);
    const select = screen.getByRole("combobox", { name: "Colour theme" });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["default", "aurora"]);
    await user.selectOptions(select, "aurora");
    expect(html.getAttribute("data-theme")).toBe("aurora");
  });

  it("restores a saved theme on mount, and ignores one the app does not list", () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ theme: "midnight" }));
    const { unmount } = render(<ThemeSwitcher themes={THEMES} />);
    expect(html.getAttribute("data-theme")).toBe("midnight");
    unmount();

    html.removeAttribute("data-theme");
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ theme: "sepia" }));
    render(<ThemeSwitcher themes={THEMES} />);
    expect(html.hasAttribute("data-theme")).toBe(false);
    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
  });
});
