import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import NavigationMenuSection from "../sections/marketing/NavigationMenu";
import SiteHeaderSection from "../sections/marketing/SiteHeader";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the SiteHeader and NavigationMenu demos", () => {
  it("render without a React warning", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <>
        <SiteHeaderSection />
        <NavigationMenuSection />
      </>
    );
    expect(error).not.toHaveBeenCalled();
  });

  it("hold the frames the browser checks select, each with its own navigation", () => {
    render(
      <>
        <SiteHeaderSection />
        <NavigationMenuSection />
      </>
    );
    for (const id of ["sh-saas", "sh-docs", "sh-hero", "sh-narrow", "sh-rtl", "sh-compact", "nm-basic", "nm-compact", "nm-long", "nm-rtl"]) {
      expect(within(screen.getByTestId(id)).getAllByRole("navigation")).toHaveLength(1);
    }
    expect(within(screen.getByTestId("sh-empty")).queryByRole("navigation")).toBeNull();
    expect(within(screen.getByTestId("sh-hero")).getByRole("banner", { hidden: true })).toHaveAttribute("data-variant", "transparent");
  });

  it("the docs and narrow demos mark their current pages through the router", () => {
    render(<SiteHeaderSection />);
    expect(within(screen.getByTestId("sh-docs")).getByRole("link", { name: "API reference" })).toHaveAttribute("aria-current", "page");
    expect(within(screen.getByTestId("sh-narrow")).getByRole("button", { name: "Product" })).toHaveAttribute("data-current");
  });
});
