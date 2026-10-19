import { act, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Solo } from "./Solo";

afterEach(() => {
  delete document.documentElement.dataset.showcaseSolo;
});

// The page suspends on its sections' chunks; an awaited act lets React retry once they arrive.
const renderSolo = async (anchor: string) => {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <Suspense fallback={<p>Loading…</p>}>
        <Solo anchor={anchor} />
      </Suspense>,
    );
  });
  return view;
};

// The sections load as the app loads them, by dynamic import, which a cold transform makes slow.
describe("the solo route", { timeout: 30_000 }, () => {
  it("renders only the sections it names, in that order, in the Overview's frame, and publishes the list", async () => {
    const { container } = await renderSolo("primitives-kbd,primitives-badge?runway");
    expect(await screen.findByRole("heading", { level: 3, name: "Kbd & Divider" })).toBeInTheDocument();
    const sections = [...container.querySelectorAll("section.sc-section")];
    expect(sections.map((s) => s.id)).toEqual(["primitives-kbd", "primitives-badge"]);
    expect(sections[0]!.querySelector(":scope > .sc-demo")).not.toBeNull();
    expect(container.querySelectorAll(".sc-solo-runway")).toHaveLength(2);
    expect(document.documentElement.dataset.showcaseSolo).toBe("primitives-kbd,primitives-badge");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("names an id no section answers instead of rendering nothing", async () => {
    const { container } = await renderSolo("primitives-kbd,primitives-nothing");
    expect(await screen.findByRole("alert")).toHaveTextContent("primitives-nothing: no such section");
    expect([...container.querySelectorAll("section.sc-section")].map((s) => s.id)).toEqual(["primitives-kbd"]);
    expect(container.querySelector(".sc-solo-runway")).toBeNull();
  });
});
