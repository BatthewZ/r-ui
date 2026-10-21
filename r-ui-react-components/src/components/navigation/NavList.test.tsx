import { render, screen, within } from "@testing-library/react";
import type { ComponentPropsWithRef } from "react";
import { describe, expect, it } from "vitest";

import { NavList } from "./NavList";

function RouterLink({ to, ...props }: { to: string } & Omit<ComponentPropsWithRef<"a">, "href">) {
  return <a href={`/app${to}`} {...props} />;
}

describe("NavList", () => {
  it("is a named navigation landmark of links", () => {
    render(
      <NavList label="Settings">
        <NavList.Item href="/profile" current>
          Profile
        </NavList.Item>
        <NavList.Item href="/billing">Billing</NavList.Item>
      </NavList>,
    );
    const nav = screen.getByRole("navigation", { name: "Settings" });
    expect(within(nav).getAllByRole("link")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Billing" })).not.toHaveAttribute("aria-current");
  });

  it("names each section's list by its title", () => {
    render(
      <NavList label="Settings">
        <NavList.Section title="Account">
          <NavList.Item href="/profile">Profile</NavList.Item>
          <NavList.Item href="/security" badge="2">
            Security
          </NavList.Item>
        </NavList.Section>
        <NavList.Section title="Workspace">
          <NavList.Item as={RouterLink} to="/members">
            Members
          </NavList.Item>
        </NavList.Section>
      </NavList>,
    );
    const account = screen.getByRole("list", { name: "Account" });
    expect(within(account).getAllByRole("link")).toHaveLength(2);
    expect(within(account).getByRole("link", { name: "Security 2" })).toBeInTheDocument();
    const workspace = screen.getByRole("list", { name: "Workspace" });
    expect(within(workspace).getByRole("link", { name: "Members" })).toHaveAttribute("href", "/app/members");
  });

  it("drops an href safeUrl refuses and still renders the item, as no link", () => {
    render(
      <NavList label="Settings">
        <NavList.Item href="/profile">Profile</NavList.Item>
        <NavList.Item href="javascript:alert(1)">Hostile</NavList.Item>
      </NavList>,
    );
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
    expect(screen.queryByRole("link", { name: "Hostile" })).toBeNull();
    const hostile = screen.getByText("Hostile").closest(".r-navigation-link");
    expect(hostile).not.toBeNull();
    expect(hostile).not.toHaveAttribute("href");
  });

  it("routes slot classes to their parts and className to the link", () => {
    render(
      <NavList label="Settings">
        <NavList.Item href="/x" className="mt-r2" classNames={{ item: "ms-r3", label: "truncate" }}>
          X
        </NavList.Item>
      </NavList>,
    );
    const link = screen.getByRole("link", { name: "X" });
    expect(link).toHaveClass("r-navigation-link", "mt-r2");
    expect(link.closest("li")).toHaveClass("ms-r3");
    expect(screen.getByText("X")).toHaveClass("r-navigation-link-label", "truncate");
  });
});
