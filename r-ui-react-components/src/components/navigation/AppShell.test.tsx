import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentPropsWithRef, createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./AppShell";

/** A stand-in for a router's Link: takes `to`, renders an anchor. */
function RouterLink({ to, ...props }: { to: string } & Omit<ComponentPropsWithRef<"a">, "href">) {
  return <a href={`/app${to}`} data-router-link="" {...props} />;
}

function Shell(props: Partial<Parameters<typeof AppShell>[0]> & { withBottomNav?: boolean; mainAs?: "main" | "div" }) {
  const { withBottomNav = true, mainAs, ...rest } = props;
  return (
    <AppShell {...rest}>
      <AppShell.Sidebar>
        <AppShell.Brand href="/" mark="K">
          Kestrel
        </AppShell.Brand>
        <AppShell.SidebarSection title="Monitor">
          <AppShell.NavItem href="/overview" icon={<svg aria-hidden />} current>
            Overview
          </AppShell.NavItem>
          <AppShell.NavItem href="/incidents" icon={<svg aria-hidden />} badge="4">
            Incidents
          </AppShell.NavItem>
          <AppShell.NavItem as={RouterLink} to="/deploys" icon={<svg aria-hidden />}>
            Deploys
          </AppShell.NavItem>
        </AppShell.SidebarSection>
        <AppShell.SidebarSection position="end">
          <AppShell.NavItem href="/settings">Settings</AppShell.NavItem>
        </AppShell.SidebarSection>
        <AppShell.SidebarToggle />
      </AppShell.Sidebar>
      <AppShell.Header>
        <h1>Overview</h1>
      </AppShell.Header>
      <AppShell.Main as={mainAs} data-testid="shell-main">
        <button type="button">First action</button>
      </AppShell.Main>
      {withBottomNav && (
        <AppShell.BottomNav label="Primary (phone)">
          <AppShell.NavItem href="/overview" current>
            Overview
          </AppShell.NavItem>
          <AppShell.NavItem href="/incidents">Incidents</AppShell.NavItem>
        </AppShell.BottomNav>
      )}
    </AppShell>
  );
}

describe("AppShell", () => {
  it("renders the landmarks: primary nav, banner, main and the bottom nav", () => {
    render(<Shell />);
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary (phone)" })).toBeInTheDocument();
    expect(screen.getByRole("banner")).toHaveTextContent("Overview");
    expect(screen.getByRole("main")).toContainElement(screen.getByRole("button", { name: "First action" }));
  });

  it("marks the current item with aria-current=page and no other", () => {
    render(<Shell withBottomNav={false} />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Incidents 4" })).not.toHaveAttribute("aria-current");
  });

  it("names a link by its label (and badge), never by its decorative icon", () => {
    render(<Shell withBottomNav={false} />);
    // The badge is read as part of the name, separated by a space.
    expect(screen.getByRole("link", { name: "Incidents 4" })).toHaveAttribute("href", "/incidents");
  });

  it("renders a router link through `as`, passing its own props", () => {
    render(<Shell withBottomNav={false} />);
    const link = screen.getByRole("link", { name: "Deploys" });
    expect(link).toHaveAttribute("href", "/app/deploys");
    expect(link).toHaveAttribute("data-router-link");
    expect(link).toHaveClass("r-navigation-link");
  });

  it("drops an href safeUrl refuses and still renders the item, as no link", () => {
    render(
      <AppShell>
        <AppShell.Sidebar>
          <AppShell.SidebarSection title="Monitor">
            <AppShell.NavItem href="/overview">Overview</AppShell.NavItem>
            <AppShell.NavItem href="javascript:alert(1)">Hostile</AppShell.NavItem>
          </AppShell.SidebarSection>
        </AppShell.Sidebar>
        <AppShell.Main>Body</AppShell.Main>
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/overview");
    expect(screen.queryByRole("link", { name: "Hostile" })).toBeNull();
    const hostile = screen.getByText("Hostile").closest(".r-navigation-link");
    expect(hostile).not.toBeNull();
    expect(hostile).not.toHaveAttribute("href");
  });

  it("groups items under a titled section", () => {
    render(<Shell withBottomNav={false} />);
    const group = screen.getByRole("group", { name: "Monitor" });
    expect(within(group).getAllByRole("link")).toHaveLength(3);
  });

  it("names the brand link by its product name, not its mark", () => {
    render(<Shell withBottomNav={false} />);
    expect(screen.getByRole("link", { name: "Kestrel" })).toHaveAttribute("href", "/");
  });

  describe("skip link", () => {
    it("is the first focusable element and moves focus to main", async () => {
      const user = userEvent.setup();
      render(<Shell />);
      await user.tab();
      const skip = screen.getByRole("link", { name: "Skip to content" });
      expect(skip).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(screen.getByRole("main")).toHaveFocus();
      // The next Tab continues from main, i.e. into the content.
      await user.tab();
      expect(screen.getByRole("button", { name: "First action" })).toHaveFocus();
    });

    it("embedded in a page that owns <main>: `as=\"div\"` adds no second main landmark and still takes the skip", async () => {
      const user = userEvent.setup();
      render(
        <main>
          <Shell mainAs="div" />
        </main>,
      );
      expect(screen.getAllByRole("main")).toHaveLength(1);
      const region = screen.getByTestId("shell-main");
      expect(region.tagName).toBe("DIV");
      expect(region).toHaveClass("r-navigation-shell-main");
      await user.tab();
      await user.keyboard("{Enter}");
      expect(region).toHaveFocus();
      expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe(`#${region.id}`);
    });

    it("points its href at main, for when script is unavailable", () => {
      render(<Shell labels={{ skipLink: "Zum Inhalt" }} />);
      const skip = screen.getByRole("link", { name: "Zum Inhalt" });
      expect(skip.getAttribute("href")).toBe(`#${screen.getByRole("main").id}`);
    });
  });

  describe("collapse", () => {
    it("uncontrolled: the toggle flips the state and its name", async () => {
      const user = userEvent.setup();
      const onCollapsedChange = vi.fn();
      const { container } = render(<Shell onCollapsedChange={onCollapsedChange} />);
      const root = container.querySelector(".r-navigation-shell");
      expect(root).not.toHaveAttribute("data-collapsed");

      await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
      expect(root).toHaveAttribute("data-collapsed", "true");
      expect(onCollapsedChange).toHaveBeenCalledTimes(1);
      expect(onCollapsedChange).toHaveBeenLastCalledWith(true);

      await user.click(screen.getByRole("button", { name: "Expand sidebar" }));
      expect(root).not.toHaveAttribute("data-collapsed");
      expect(onCollapsedChange).toHaveBeenCalledTimes(2);
      expect(onCollapsedChange).toHaveBeenLastCalledWith(false);
    });

    it("controlled: the toggle asks, the owner decides", async () => {
      const user = userEvent.setup();
      const onCollapsedChange = vi.fn();
      const { container } = render(<Shell collapsed onCollapsedChange={onCollapsedChange} />);
      const root = container.querySelector(".r-navigation-shell");
      expect(root).toHaveAttribute("data-collapsed", "true");

      await user.click(screen.getByRole("button", { name: "Expand sidebar" }));
      expect(onCollapsedChange).toHaveBeenCalledTimes(1);
      expect(onCollapsedChange).toHaveBeenCalledWith(false);
      // The owner did not apply it, so it is still collapsed.
      expect(root).toHaveAttribute("data-collapsed", "true");
    });

    it("controlled by state: applying the change expands it", async () => {
      const user = userEvent.setup();
      function Owner() {
        const [collapsed, setCollapsed] = useState(true);
        return <Shell collapsed={collapsed} onCollapsedChange={setCollapsed} />;
      }
      const { container } = render(<Owner />);
      await user.click(screen.getByRole("button", { name: "Expand sidebar" }));
      expect(container.querySelector(".r-navigation-shell")).not.toHaveAttribute("data-collapsed");
      expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
    });

    it("the toggle controls the sidebar by id", () => {
      const { container } = render(<Shell />);
      const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
      const sidebar = container.querySelector(".r-navigation-shell-sidebar");
      expect(sidebar?.id).toBeTruthy();
      expect(toggle).toHaveAttribute("aria-controls", sidebar?.id);
    });
  });

  it("caller className merges onto the root, and caller props reach it", () => {
    const { container } = render(<Shell className="min-h-0" data-testid="shell" />);
    const root = container.querySelector(".r-navigation-shell");
    expect(root).toHaveClass("min-h-0");
    expect(root).toHaveAttribute("data-testid", "shell");
  });

  it("a caller's aria-current wins over `current`", () => {
    render(
      <AppShell>
        <AppShell.Sidebar>
          <AppShell.SidebarSection>
            <AppShell.NavItem href="/a" current aria-current="location">
              A
            </AppShell.NavItem>
          </AppShell.SidebarSection>
        </AppShell.Sidebar>
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: "A" })).toHaveAttribute("aria-current", "location");
  });

  describe("bottom inset", () => {
    const INSET = "--r-navigation-shell-bottom-inset";
    const inset = () => document.documentElement.style.getPropertyValue(INSET);
    /** jsdom has no layout and no ResizeObserver: each bottom nav is as tall as `heights` says, re-read when `resize()` runs the observers. */
    function stubLayout(heights: Map<string, number>) {
      const observers = new Set<() => void>();
      vi.stubGlobal(
        "ResizeObserver",
        class {
          constructor(private readonly callback: () => void) {}
          observe() {
            observers.add(this.callback);
          }
          disconnect() {
            observers.delete(this.callback);
          }
        },
      );
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
        const height = heights.get(this.getAttribute("aria-label") ?? "") ?? 0;
        return { left: 0, right: 0, width: 0, top: 0, bottom: height, height, x: 0, y: 0, toJSON: () => ({}) };
      });
      return { resize: () => act(() => observers.forEach((run) => run())) };
    }
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it("publishes the shown nav's block size on <html>, follows its resizes, and removes it on unmount", () => {
      const heights = new Map([["Primary (phone)", 56]]);
      const { resize } = stubLayout(heights);
      const { unmount } = render(<Shell />);
      expect(inset()).toBe("56px");
      heights.set("Primary (phone)", 64.5);
      resize();
      expect(inset()).toBe("64.5px");
      unmount();
      expect(inset()).toBe("");
    });

    it("publishes nothing while the nav is not shown (a wider layout measures 0)", () => {
      const heights = new Map([["Primary (phone)", 56]]);
      const { resize } = stubLayout(heights);
      render(<Shell />);
      expect(inset()).toBe("56px");
      heights.set("Primary (phone)", 0);
      resize();
      expect(inset()).toBe("");
    });

    it("stacks the navs of a shell nested above another's: the sizes add up, and each leaves with its own", () => {
      const heights = new Map([
        ["Outer", 56],
        ["Inner", 48],
      ]);
      stubLayout(heights);
      function Nested({ inner }: { inner: boolean }) {
        return (
          <AppShell>
            <AppShell.Main>
              {inner && (
                <AppShell>
                  <AppShell.Main as="div" />
                  <AppShell.BottomNav label="Inner" />
                </AppShell>
              )}
            </AppShell.Main>
            <AppShell.BottomNav label="Outer" />
          </AppShell>
        );
      }
      const { rerender } = render(<Nested inner />);
      expect(inset()).toBe("104px");
      rerender(<Nested inner={false} />);
      expect(inset()).toBe("56px");
    });

    it("a shell with no bottom nav publishes nothing", () => {
      stubLayout(new Map([["Primary (phone)", 56]]));
      render(<Shell withBottomNav={false} />);
      expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
      expect(inset()).toBe("");
    });

    it("a caller's ref still reaches the nav", () => {
      stubLayout(new Map([["Phone", 56]]));
      const ref = createRef<HTMLElement>();
      render(
        <AppShell>
          <AppShell.BottomNav ref={ref} label="Phone" />
        </AppShell>,
      );
      expect(ref.current).toBe(screen.getByRole("navigation", { name: "Phone" }));
      expect(inset()).toBe("56px");
    });
  });

  it("throws a named error when a part is used outside AppShell", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<AppShell.Main />)).toThrow("<AppShell.Main> must be used inside <AppShell>");
    error.mockRestore();
  });
});
