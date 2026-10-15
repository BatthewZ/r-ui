import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentPropsWithRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { AppShell, Breadcrumbs, NavList, Pagination } from "../components/navigation";
import { Link } from "../components/primitives";
import { isExternalHref, RouterProvider } from "./router";

/** A router's link: marks itself so a test can tell it from a plain `<a>`. */
function RouterLink(props: ComponentPropsWithRef<"a">) {
  return <a data-router="" {...props} />;
}
/** A second router link, for "an explicit `as` wins". */
function OtherLink(props: ComponentPropsWithRef<"a">) {
  return <a data-other="" {...props} />;
}

const isCurrent = (href: string) => href === "/billing";

function Everything() {
  return (
    <>
      <Link href="/docs">Docs</Link>
      <Link href="https://example.com">Example</Link>
      <NavList label="Settings">
        <NavList.Item href="/profile">Profile</NavList.Item>
        <NavList.Item href="/billing">Billing</NavList.Item>
      </NavList>
      <AppShell>
        <AppShell.Sidebar>
          <AppShell.Brand href="/" mark="A">
            Acme
          </AppShell.Brand>
          <AppShell.SidebarSection>
            <AppShell.NavItem href="/billing">Billing (shell)</AppShell.NavItem>
            <AppShell.NavItem href="/billing" current={false}>
              Billing (not current)
            </AppShell.NavItem>
            <AppShell.NavItem href="/profile" as={OtherLink}>
              Profile (other)
            </AppShell.NavItem>
          </AppShell.SidebarSection>
        </AppShell.Sidebar>
        <AppShell.Main>
          <Breadcrumbs>
            <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
            <Breadcrumbs.Item href="/billing">Billing crumb</Breadcrumbs.Item>
            <Breadcrumbs.Item>Plain crumb</Breadcrumbs.Item>
          </Breadcrumbs>
          <Pagination pageCount={5} page={2} getHref={(p) => `/list?page=${p}`} />
        </AppShell.Main>
      </AppShell>
    </>
  );
}

describe("RouterProvider", () => {
  it("is consumed by every internal-link part: Link, NavList.Item, AppShell.NavItem, Brand, Breadcrumbs.Item, Pagination", () => {
    render(
      <RouterProvider link={RouterLink} isCurrent={isCurrent}>
        <Everything />
      </RouterProvider>,
    );
    const routed = (name: string | RegExp) => screen.getByRole("link", { name });
    for (const name of ["Docs", "Profile", "Billing", "Billing (shell)", "Acme", "Home", "Billing crumb", "Page 3", "Next page"]) {
      expect(routed(name)).toHaveAttribute("data-router");
    }
    expect(routed("Page 3")).toHaveAttribute("href", "/list?page=3");
  });

  it("asks isCurrent for items with no explicit `current`", () => {
    render(
      <RouterProvider link={RouterLink} isCurrent={isCurrent}>
        <Everything />
      </RouterProvider>,
    );
    const nav = screen.getByRole("navigation", { name: "Settings" });
    expect(within(nav).getByRole("link", { name: "Billing" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Profile" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Billing (shell)" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Billing crumb" })).toHaveAttribute("aria-current", "page");
  });

  it("lets an explicit `as` and `current` win over the provider", () => {
    render(
      <RouterProvider link={RouterLink} isCurrent={isCurrent}>
        <Everything />
      </RouterProvider>,
    );
    const other = screen.getByRole("link", { name: "Profile (other)" });
    expect(other).toHaveAttribute("data-other");
    expect(other).not.toHaveAttribute("data-router");
    expect(screen.getByRole("link", { name: "Billing (not current)" })).not.toHaveAttribute("aria-current");
  });

  it("never hands an external URL or a crumb without href to the router", () => {
    render(
      <RouterProvider link={RouterLink} isCurrent={isCurrent}>
        <Everything />
      </RouterProvider>,
    );
    expect(screen.getByRole("link", { name: "Example" })).not.toHaveAttribute("data-router");
    const plain = screen.getByText("Plain crumb");
    expect(plain.tagName).toBe("SPAN");
    expect(plain).not.toHaveAttribute("data-router");
  });

  it("without a provider every part is a plain <a> and nothing is current", () => {
    render(<Everything />);
    for (const link of screen.getAllByRole("link")) expect(link).not.toHaveAttribute("data-router");
    const nav = screen.getByRole("navigation", { name: "Settings" });
    expect(within(nav).getByRole("link", { name: "Billing" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Docs" }).tagName).toBe("A");
  });

  it("passes the anchor's own props and handlers through to the router link", async () => {
    const onClick = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <RouterProvider link={RouterLink}>
        <NavList label="Docs">
          <NavList.Item href="/guide" onClick={onClick} title="The guide">
            Guide
          </NavList.Item>
        </NavList>
      </RouterProvider>,
    );
    const link = screen.getByRole("link", { name: "Guide" });
    expect(link).toHaveAttribute("title", "The guide");
    await userEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("isExternalHref", () => {
  it("is true for a scheme or //host, false for paths, queries and hashes", () => {
    for (const href of ["https://a.b", "mailto:x@y.z", "//cdn.example.com/x"]) expect(isExternalHref(href)).toBe(true);
    for (const href of ["/a", "a/b", "?page=2", "#top", "./x:y"]) expect(isExternalHref(href)).toBe(false);
  });

  it("resolves as a browser does: a backslash, a third slash, whitespace or a tab can still name another host", () => {
    for (const href of ["/\\evil.example", "\\\\evil.example", "\\/evil.example", "///evil.example", " //evil.example", "/\t/evil.example", "\n//evil.example"]) {
      expect(isExternalHref(href)).toBe(true);
    }
    for (const href of ["", "/a\\b", "a\\b", "/a//b", "./a?x=//b#//c"]) expect(isExternalHref(href)).toBe(false);
  });
});
