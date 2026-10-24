import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { sectionIndex } from "../registry";
import { App } from "./App";
import { groupTitle } from "./sections";

afterEach(() => {
  window.location.hash = "";
});

describe("the bottom nav's Components menu", { timeout: 30_000 }, () => {
  it("lists every group's page and opens the one picked, which marks the tab current", async () => {
    window.location.hash = "#/blank";
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<App />));
    });
    // The sidebar is a "Showcase" navigation too.
    const nav = container.querySelector<HTMLElement>("nav[data-showcase-bottomnav]")!;
    expect(nav).toHaveAccessibleName("Showcase");
    const tab = within(nav).getByRole("button", { name: "Components" });
    expect(tab).not.toHaveAttribute("aria-current");

    await userEvent.click(tab);
    const items = within(screen.getByRole("menu")).getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(sectionIndex.map(({ group }) => groupTitle(group)));

    await act(async () => {
      await userEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Primitives" }));
    });
    expect(window.location.hash).toBe("#/overview/primitives");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(within(nav).getByRole("button", { name: "Components" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });
});
