import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithRef } from "react";
import { describe, expect, it } from "vitest";

import { RouterProvider } from "../../util/router";
import { Link } from "./Link";

describe("Link", () => {
  it("is an accent link that follows the theme's decoration lever and underlines on hover", () => {
    render(<Link href="/docs">Docs</Link>);
    const link = screen.getByRole("link", { name: "Docs" });
    expect(link).toHaveAttribute("href", "/docs");
    expect(link).toHaveClass("r-primitives-link", "text-fg-accent", "hover:underline");
    expect(link.querySelector("svg")).toBeNull();
  });

  it("inherit variant takes the surrounding ink", () => {
    render(
      <Link href="/terms" variant="inherit">
        Terms
      </Link>,
    );
    const link = screen.getByRole("link", { name: "Terms" });
    expect(link).toHaveClass("text-inherit");
    expect(link).not.toHaveClass("text-fg-accent");
  });

  it("a new-tab link gets the external glyph, a spoken hint and a safe rel that keeps the caller's", () => {
    render(
      <Link href="https://example.com" target="_blank" rel="author">
        Example
      </Link>,
    );
    const link = screen.getByRole("link", { name: "Example" });
    expect(link).toHaveAccessibleDescription("(opens in a new tab)");
    expect(link.getAttribute("rel")?.split(" ").sort()).toEqual(["author", "noopener", "noreferrer"]);
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("external without a new tab shows the glyph but no new-tab hint", () => {
    render(
      <Link href="https://example.com" external>
        Example
      </Link>,
    );
    const link = screen.getByRole("link", { name: "Example" });
    expect(link.querySelector("svg")).not.toBeNull();
    expect(link).not.toHaveAttribute("rel");
    expect(link).not.toHaveAttribute("aria-describedby");
  });

  it("external={false} suppresses the glyph on a new-tab link; newTabLabel is translatable", () => {
    render(
      <Link href="https://example.com" target="_blank" external={false} newTabLabel="(nouvel onglet)">
        Exemple
      </Link>,
    );
    const link = screen.getByRole("link", { name: "Exemple" });
    expect(link).toHaveAccessibleDescription("(nouvel onglet)");
    expect(link.querySelector("svg")).toBeNull();
  });

  it("keeps the caller's own description alongside the new-tab hint", () => {
    render(
      <>
        <span id="extra">PDF, 2 MB</span>
        <Link href="/report.pdf" target="_blank" aria-describedby="extra">
          Report
        </Link>
      </>,
    );
    expect(screen.getByRole("link", { name: "Report" })).toHaveAccessibleDescription("PDF, 2 MB (opens in a new tab)");
  });

  it("refuses a scriptable href and renders plain text", () => {
    render(<Link href="javascript:alert(1)">Click</Link>);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Click").tagName).toBe("SPAN");
  });

  it("renders `as` with the link's own styling and passes the component's props through", () => {
    function RouterLink({ to, ...props }: { to: string } & ComponentPropsWithRef<"a">) {
      return <a data-router="" href={to} {...props} />;
    }
    render(
      <Link as={RouterLink} to="/settings" variant="inherit">
        Settings
      </Link>,
    );
    const link = screen.getByRole("link", { name: "Settings" });
    expect(link).toHaveAttribute("data-router");
    expect(link).toHaveAttribute("href", "/settings");
    expect(link).toHaveClass("r-primitives-link", "text-inherit");
  });

  it("a new-tab or external link stays a plain <a> under a router", () => {
    function RouterLink(props: ComponentPropsWithRef<"a">) {
      return <a data-router="" {...props} />;
    }
    render(
      <RouterProvider link={RouterLink}>
        <Link href="/report.pdf" target="_blank">
          Report
        </Link>
        <Link href="/status" external>
          Status
        </Link>
        <Link href="/docs">Docs</Link>
      </RouterProvider>,
    );
    expect(screen.getByRole("link", { name: "Report" })).not.toHaveAttribute("data-router");
    expect(screen.getByRole("link", { name: "Status" })).not.toHaveAttribute("data-router");
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("data-router");
  });
});
