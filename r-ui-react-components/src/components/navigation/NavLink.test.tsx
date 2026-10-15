import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { RouterProvider } from "../../util/router";
import { NavLink } from "./NavLink";

const inList = (ui: ReactNode) => render(<ul>{ui}</ul>);

describe("NavLink", () => {
  it("is a list item holding a link named by its label", () => {
    inList(<NavLink href="/inbox">Inbox</NavLink>);
    const link = screen.getByRole("link", { name: "Inbox" });
    expect(link).toHaveAttribute("href", "/inbox");
    expect(link.parentElement?.tagName).toBe("LI");
    expect(screen.getByRole("listitem")).toContainElement(link);
  });

  it("marks only the current item, with aria-current=page", () => {
    inList(
      <>
        <NavLink href="/a" current>
          A
        </NavLink>
        <NavLink href="/b">B</NavLink>
      </>,
    );
    expect(screen.getByRole("link", { name: "A" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "B" })).not.toHaveAttribute("aria-current");
  });

  it("keeps the icon out of the name and reads the badge as a separate word", () => {
    inList(
      <NavLink href="/incidents" icon={<svg aria-hidden data-testid="icon" />} badge="4">
        Incidents
      </NavLink>,
    );
    expect(screen.getByRole("link", { name: "Incidents 4" })).toBeInTheDocument();
    expect(screen.getByTestId("icon").parentElement).toHaveClass("r-navigation-link-icon");
  });

  it("routes slot classes to their parts and className to the link", () => {
    inList(
      <NavLink
        href="/x"
        icon={<svg aria-hidden />}
        badge="2"
        className="link-extra"
        classNames={{ item: "item-extra", icon: "icon-extra", label: "label-extra", badge: "badge-extra" }}
      >
        X
      </NavLink>,
    );
    const link = screen.getByRole("link", { name: "X 2" });
    expect(link).toHaveClass("r-navigation-link", "link-extra");
    expect(screen.getByRole("listitem")).toHaveClass("item-extra");
    expect(link.querySelector(".r-navigation-link-icon")).toHaveClass("icon-extra");
    expect(screen.getByText("X")).toHaveClass("r-navigation-link-label", "label-extra");
    expect(screen.getByText("2")).toHaveClass("r-navigation-link-badge", "badge-extra");
  });

  it("renders `as` with that component's own props", () => {
    function RouterLink({ to, ...props }: { to: string } & ComponentPropsWithRef<"a">) {
      return <a data-router="" href={to} {...props} />;
    }
    inList(
      <NavLink as={RouterLink} to="/settings" current>
        Settings
      </NavLink>,
    );
    const link = screen.getByRole("link", { name: "Settings" });
    expect(link).toHaveAttribute("data-router");
    expect(link).toHaveAttribute("href", "/settings");
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("lets a caller's aria-current beat the computed one", () => {
    inList(
      <NavLink href="/a" current aria-current="location">
        A
      </NavLink>,
    );
    expect(screen.getByRole("link", { name: "A" })).toHaveAttribute("aria-current", "location");
  });

  it("asks the router whether it is current, unless told", () => {
    inList(
      <RouterProvider isCurrent={(href) => href.startsWith("/reports")}>
        <NavLink href="/reports/q3">Q3</NavLink>
        <NavLink href="/reports/q4" current={false}>
          Q4
        </NavLink>
        <NavLink href="/home">Home</NavLink>
      </RouterProvider>,
    );
    expect(screen.getByRole("link", { name: "Q3" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Q4" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });
});
