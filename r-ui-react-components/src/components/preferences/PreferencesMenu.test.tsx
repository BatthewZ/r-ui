import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PreferencesMenu } from "./PreferencesMenu";

const THEMES = [
  { value: "default", label: "Light" },
  { value: "midnight", label: "Midnight" },
];
const html = document.documentElement;

beforeEach(() => {
  for (const a of ["data-theme", "data-density", "data-input"]) html.removeAttribute(a);
  localStorage.clear();
});

describe("PreferencesMenu", () => {
  it("is a View menu with one labelled radio group per axis", async () => {
    const user = userEvent.setup();
    render(<PreferencesMenu themes={THEMES} />);
    await user.click(screen.getByRole("button", { name: "View" }));
    const menu = screen.getByRole("menu");
    const groups = within(menu).getAllByRole("group");
    expect(groups.map((g) => g.getAttribute("aria-labelledby") && document.getElementById(g.getAttribute("aria-labelledby")!)?.textContent)).toEqual([
      "Theme",
      "Density",
      "Input",
    ]);
    expect(within(groups[0]!).getByRole("menuitemradio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
    expect(within(groups[1]!).getByRole("menuitemradio", { name: "Comfortable" })).toHaveAttribute("aria-checked", "true");
    expect(within(groups[2]!).getByRole("menuitemradio", { name: "Auto" })).toHaveAttribute("aria-checked", "true");
  });

  it("applies each choice at once, saves it, and stays open to compare", async () => {
    const user = userEvent.setup();
    render(<PreferencesMenu themes={THEMES} storageKey="app:view" />);
    await user.click(screen.getByRole("button", { name: "View" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Midnight" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Compact" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Touch" }));
    expect(html.dataset).toMatchObject({ theme: "midnight", density: "compact", input: "coarse" });
    expect(JSON.parse(localStorage.getItem("app:view")!)).toEqual({ theme: "midnight", density: "compact", input: "coarse" });
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(screen.getByRole("menuitemradio", { name: "Midnight" })).toHaveAttribute("aria-checked", "true"),
    );
  });

  it("drops the theme group without themes, a hidden axis, and takes translated words", async () => {
    const user = userEvent.setup();
    render(
      <PreferencesMenu
        hide={["input"]}
        labels={{ trigger: "Ansicht", density: "Dichte", densities: { compact: "Kompakt" } }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ansicht" }));
    const groups = within(screen.getByRole("menu")).getAllByRole("group");
    expect(groups).toHaveLength(1);
    expect(within(groups[0]!).getAllByRole("menuitemradio").map((i) => i.textContent)).toEqual(["Comfortable", "Kompakt"]);
    expect(screen.getByText("Dichte")).toBeInTheDocument();
  });
});
