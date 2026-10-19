import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentPropsWithRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { RouterProvider } from "../../util/router";
import { stubPopover } from "../overlays/overlay-stubs.test.helpers";
import { NavigationMenu, type NavigationMenuItem, type NavigationMenuProps, navigationMenuLinks } from "./NavigationMenu";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const ITEMS: NavigationMenuItem[] = [
  {
    id: "product",
    label: "Product",
    columns: [
      {
        id: "build",
        title: "Build",
        links: [
          { label: "Editor", href: "/product/editor", description: "Write together in real time." },
          { label: "Analytics", href: "/product/analytics" },
        ],
      },
      { id: "ship", title: "Ship", links: [{ label: "Releases", href: "/product/releases" }] },
    ],
    featured: <a href="/changelog">What's new in 4.2</a>,
  },
  {
    id: "resources",
    label: "Resources",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "Blog", href: "/blog" },
      { label: "Status", href: "https://status.example.com" },
    ],
  },
  { id: "pricing", label: "Pricing", href: "/pricing" },
];

function Menu(props: Partial<NavigationMenuProps>) {
  return (
    <>
      <button type="button">Before</button>
      <NavigationMenu items={ITEMS} {...props} />
      <button type="button">After</button>
    </>
  );
}

const button = (name: string) => screen.getByRole("button", { name });
const panelOf = (trigger: HTMLElement) => {
  const id = trigger.getAttribute("aria-controls");
  return id ? document.getElementById(id) : null;
};
const hover = (el: Element) => fireEvent.pointerEnter(el, { pointerType: "mouse" });
const unhover = (el: Element) => fireEvent.pointerLeave(el, { pointerType: "mouse" });

describe("NavigationMenu: disclosure navigation semantics", () => {
  it("is a named navigation of links and disclosure buttons, never a menu", () => {
    render(<Menu />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).queryAllByRole("menu")).toHaveLength(0);
    expect(within(nav).queryAllByRole("menuitem")).toHaveLength(0);
    expect(within(nav).queryAllByRole("menubar")).toHaveLength(0);
    // Two disclosure buttons (closed, controlling nothing yet) and one plain link.
    expect(within(nav).getAllByRole("button").map((b) => b.textContent)).toEqual(["Product", "Resources"]);
    for (const b of within(nav).getAllByRole("button")) {
      expect(b).toHaveAttribute("aria-expanded", "false");
      expect(b).not.toHaveAttribute("aria-haspopup");
      expect(b).not.toHaveAttribute("aria-controls");
    }
    expect(within(nav).getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
  });

  it("names the landmark from its labels, the provider's below the instance's", () => {
    const { unmount } = render(
      <LocaleProvider labels={{ NavigationMenu: { navigation: "Haupt" } }}>
        <NavigationMenu items={ITEMS} />
      </LocaleProvider>
    );
    expect(screen.getByRole("navigation", { name: "Haupt" })).toBeInTheDocument();
    unmount();
    render(
      <LocaleProvider labels={{ NavigationMenu: { navigation: "Haupt" } }}>
        <NavigationMenu items={ITEMS} labels={{ navigation: "Produkt" }} />
      </LocaleProvider>
    );
    expect(screen.getByRole("navigation", { name: "Produkt" })).toBeInTheDocument();
  });

  it("a press opens the panel right after its button, aria-controls names it, and a second press closes it", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    const resources = button("Resources");
    await user.click(resources);
    expect(resources).toHaveAttribute("aria-expanded", "true");
    const panel = panelOf(resources);
    expect(panel).not.toBeNull();
    expect(resources.nextElementSibling).toBe(panel);
    expect(within(panel!).getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual([
      "/docs",
      "/blog",
      "https://status.example.com",
    ]);
    await user.click(resources);
    expect(resources).toHaveAttribute("aria-expanded", "false");
    expect(resources).not.toHaveAttribute("aria-controls");
    expect(screen.queryByRole("link", { name: "Docs" })).toBeNull();
  });

  it("keeps one panel open at a time", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    await user.click(button("Product"));
    await user.click(button("Resources"));
    expect(button("Product")).toHaveAttribute("aria-expanded", "false");
    expect(button("Resources")).toHaveAttribute("aria-expanded", "true");
    expect(document.querySelectorAll("[data-nav-panel]")).toHaveLength(1);
  });

  it("a mega panel holds titled lists and the featured slot after them; descriptions describe, labels name", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    await user.click(button("Product"));
    const panel = panelOf(button("Product"))!;
    const build = within(panel).getByRole("list", { name: "Build" });
    expect(within(build).getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/product/editor", "/product/analytics"]);
    const editor = within(panel).getByRole("link", { name: "Editor" });
    expect(editor).toHaveAccessibleDescription("Write together in real time.");
    expect(within(panel).getByRole("list", { name: "Ship" })).toBeInTheDocument();
    const links = within(panel).getAllByRole("link");
    expect(links.at(-1)).toHaveTextContent("What's new in 4.2");
  });

  it("renders the panel in place and promotes it to the top layer", async () => {
    const popover = stubPopover();
    try {
      const user = userEvent.setup();
      render(<Menu />);
      await user.click(button("Resources"));
      const panel = panelOf(button("Resources"))!;
      expect(screen.getByRole("navigation").contains(panel)).toBe(true);
      expect(popover.show).toHaveBeenCalledTimes(1);
      expect(popover.show.mock.contexts[0]).toBe(panel);
    } finally {
      popover.restore();
    }
  });
});

describe("NavigationMenu: keyboard", () => {
  it("Tab walks from a button into its open panel and on; focus leaving the item closes it", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    await user.click(button("Resources"));
    expect(button("Resources")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Docs" })).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("link", { name: "Status" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveFocus();
    expect(button("Resources")).toHaveAttribute("aria-expanded", "false");
  });

  it("Shift+Tab from the first link back to its button keeps the panel open", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    await user.click(button("Resources"));
    await user.tab();
    await user.tab({ shift: true });
    expect(button("Resources")).toHaveFocus();
    expect(button("Resources")).toHaveAttribute("aria-expanded", "true");
  });

  it("Enter and Space toggle a panel", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    button("Product").focus();
    await user.keyboard("{Enter}");
    expect(button("Product")).toHaveAttribute("aria-expanded", "true");
    await user.keyboard(" ");
    expect(button("Product")).toHaveAttribute("aria-expanded", "false");
  });

  it("Escape from a link closes the panel and returns focus to its button; on the button it keeps focus there", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Menu onOpenChange={onOpenChange} />);
    await user.click(button("Resources"));
    await user.tab();
    await user.keyboard("{Escape}");
    expect(button("Resources")).toHaveFocus();
    expect(button("Resources")).toHaveAttribute("aria-expanded", "false");
    expect(onOpenChange.mock.calls).toEqual([["resources"], [null]]);
    await user.keyboard("{Enter}");
    await user.keyboard("{Escape}");
    expect(button("Resources")).toHaveFocus();
    expect(button("Resources")).toHaveAttribute("aria-expanded", "false");
  });

  it("an Escape with no panel open is left to whatever encloses the menu", async () => {
    const user = userEvent.setup();
    const outer = vi.fn((event: KeyboardEvent) => event.defaultPrevented);
    document.addEventListener("keydown", outer);
    try {
      render(<Menu />);
      button("Product").focus();
      await user.keyboard("{Escape}");
      expect(outer).toHaveBeenCalledTimes(1);
      expect(outer.mock.results[0]?.value).toBe(false);
    } finally {
      document.removeEventListener("keydown", outer);
    }
  });

  it("Left/Right, Home and End move between top-level items without wrapping", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    button("Product").focus();
    await user.keyboard("{ArrowRight}");
    expect(button("Resources")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(button("Product")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(button("Product")).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(button("Resources")).toHaveFocus();
  });

  it("mirrors Left and Right in a right-to-left menu", async () => {
    const user = userEvent.setup();
    render(<Menu style={{ direction: "rtl" }} />);
    button("Product").focus();
    await user.keyboard("{ArrowLeft}");
    expect(button("Resources")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(button("Product")).toHaveFocus();
  });

  it("Down opens a closed panel on its first link, Up on its last; Down/Up walk the links and Up from the first returns to the button", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    button("Resources").focus();
    await user.keyboard("{ArrowDown}");
    expect(button("Resources")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Docs" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("link", { name: "Blog" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("link", { name: "Status" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("link", { name: "Status" })).toHaveFocus();
    await user.keyboard("{Home}");
    await user.keyboard("{ArrowUp}");
    expect(button("Resources")).toHaveFocus();
    expect(button("Resources")).toHaveAttribute("aria-expanded", "true");
    // Open already: Down goes straight in.
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("link", { name: "Docs" })).toHaveFocus();
    await user.keyboard("{Escape}");
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("link", { name: "Status" })).toHaveFocus();
  });

  it("the arrows in a mega panel walk its links in column order, the featured slot left to Tab", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    button("Product").focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("link", { name: "Releases" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("link", { name: "Releases" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "What's new in 4.2" })).toHaveFocus();
    expect(button("Product")).toHaveAttribute("aria-expanded", "true");
  });
});

describe("NavigationMenu: pointer", () => {
  it("hover intent: opens only after resting openDelay on a button, closes closeDelay after leaving", () => {
    vi.useFakeTimers();
    render(<Menu openDelay={150} closeDelay={300} />);
    const product = button("Product");
    hover(product);
    act(() => vi.advanceTimersByTime(140));
    expect(product).toHaveAttribute("aria-expanded", "false");
    act(() => vi.advanceTimersByTime(20));
    expect(product).toHaveAttribute("aria-expanded", "true");
    unhover(product);
    act(() => vi.advanceTimersByTime(280));
    expect(product).toHaveAttribute("aria-expanded", "true");
    act(() => vi.advanceTimersByTime(40));
    expect(product).toHaveAttribute("aria-expanded", "false");
  });

  it("passing over a button without resting opens nothing", () => {
    vi.useFakeTimers();
    render(<Menu openDelay={150} />);
    hover(button("Product"));
    act(() => vi.advanceTimersByTime(60));
    unhover(button("Product"));
    act(() => vi.advanceTimersByTime(1000));
    expect(button("Product")).toHaveAttribute("aria-expanded", "false");
  });

  it("the pointer reaching the panel within closeDelay keeps it open; leaving the panel closes it", () => {
    vi.useFakeTimers();
    render(<Menu openDelay={150} closeDelay={300} />);
    const product = button("Product");
    hover(product);
    act(() => vi.advanceTimersByTime(150));
    unhover(product);
    act(() => vi.advanceTimersByTime(200));
    hover(panelOf(product)!);
    act(() => vi.advanceTimersByTime(1000));
    expect(product).toHaveAttribute("aria-expanded", "true");
    unhover(panelOf(product)!);
    act(() => vi.advanceTimersByTime(300));
    expect(product).toHaveAttribute("aria-expanded", "false");
  });

  it("with one panel open, another button opens at once (and so it does just after a close)", () => {
    vi.useFakeTimers();
    render(<Menu openDelay={150} closeDelay={300} />);
    hover(button("Product"));
    act(() => vi.advanceTimersByTime(150));
    unhover(button("Product"));
    hover(button("Resources"));
    expect(button("Resources")).toHaveAttribute("aria-expanded", "true");
    expect(button("Product")).toHaveAttribute("aria-expanded", "false");
    // Leave everything: it closes; back within the skip window, the next opens at once.
    unhover(button("Resources"));
    act(() => vi.advanceTimersByTime(300));
    expect(button("Resources")).toHaveAttribute("aria-expanded", "false");
    act(() => vi.advanceTimersByTime(100));
    hover(button("Product"));
    expect(button("Product")).toHaveAttribute("aria-expanded", "true");
    // Long after a close, the delay applies again.
    unhover(button("Product"));
    act(() => vi.advanceTimersByTime(300 + 1000));
    hover(button("Resources"));
    expect(button("Resources")).toHaveAttribute("aria-expanded", "false");
  });

  it("a press on a hover-opened panel pins it: the pointer leaving no longer closes it, a second press does", () => {
    vi.useFakeTimers();
    render(<Menu openDelay={150} closeDelay={300} />);
    const product = button("Product");
    hover(product);
    act(() => vi.advanceTimersByTime(150));
    fireEvent.click(product);
    expect(product).toHaveAttribute("aria-expanded", "true");
    unhover(product);
    act(() => vi.advanceTimersByTime(2000));
    expect(product).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(product);
    expect(product).toHaveAttribute("aria-expanded", "false");
  });

  it("focus moving into a hover-opened panel holds it open against the pointer leaving", () => {
    vi.useFakeTimers();
    render(<Menu openDelay={150} closeDelay={300} />);
    const resources = button("Resources");
    hover(resources);
    act(() => vi.advanceTimersByTime(150));
    act(() => screen.getByRole("link", { name: "Docs" }).focus());
    unhover(resources);
    act(() => vi.advanceTimersByTime(2000));
    expect(resources).toHaveAttribute("aria-expanded", "true");
  });

  it("touch and pen never hover-open: a touch press toggles", async () => {
    vi.useFakeTimers();
    render(<Menu openDelay={150} />);
    fireEvent.pointerEnter(button("Product"), { pointerType: "touch" });
    act(() => vi.advanceTimersByTime(1000));
    expect(button("Product")).toHaveAttribute("aria-expanded", "false");
    fireEvent.pointerEnter(button("Product"), { pointerType: "pen" });
    act(() => vi.advanceTimersByTime(1000));
    expect(button("Product")).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button("Product"));
    expect(button("Product")).toHaveAttribute("aria-expanded", "true");
    fireEvent.pointerLeave(button("Product"), { pointerType: "touch" });
    act(() => vi.advanceTimersByTime(1000));
    expect(button("Product")).toHaveAttribute("aria-expanded", "true");
  });

  it("a press outside closes it; a press inside the panel does not", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    await user.click(button("Product"));
    await user.click(within(panelOf(button("Product"))!).getByText("Build"));
    expect(button("Product")).toHaveAttribute("aria-expanded", "true");
    await user.click(button("After"));
    expect(button("Product")).toHaveAttribute("aria-expanded", "false");
  });

  it("Escape closes a hover-opened panel from anywhere without moving focus", () => {
    vi.useFakeTimers();
    render(<Menu openDelay={150} />);
    const after = button("After");
    after.focus();
    hover(button("Product"));
    act(() => vi.advanceTimersByTime(150));
    expect(button("Product")).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(after, { key: "Escape" });
    expect(button("Product")).toHaveAttribute("aria-expanded", "false");
    expect(after).toHaveFocus();
  });

  it("following a link in a panel closes it", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn((event: MouseEvent) => event.preventDefault());
    document.addEventListener("click", navigate);
    try {
      render(<Menu />);
      await user.click(button("Resources"));
      await user.click(screen.getByRole("link", { name: "Blog" }));
      expect(button("Resources")).toHaveAttribute("aria-expanded", "false");
      expect(navigate).toHaveBeenCalledTimes(2);
    } finally {
      document.removeEventListener("click", navigate);
    }
  });
});

describe("NavigationMenu: state and routing", () => {
  it("is controllable: a press asks once and changes nothing until the parent agrees", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Menu open="resources" onOpenChange={onOpenChange} />);
    expect(button("Resources")).toHaveAttribute("aria-expanded", "true");
    await user.click(button("Product"));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith("product");
    expect(button("Resources")).toHaveAttribute("aria-expanded", "true");
    expect(button("Product")).toHaveAttribute("aria-expanded", "false");
  });

  it("opens with defaultOpen", () => {
    render(<Menu defaultOpen="product" />);
    expect(button("Product")).toHaveAttribute("aria-expanded", "true");
  });

  it("marks the current page from the router: the link, and the button whose panel holds it", async () => {
    const user = userEvent.setup();
    const isCurrent = (href: string) => href === "/product/analytics" || href === "/pricing";
    render(
      <RouterProvider isCurrent={isCurrent}>
        <Menu />
      </RouterProvider>
    );
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("aria-current", "page");
    expect(button("Product")).toHaveAttribute("data-current");
    expect(button("Product")).not.toHaveAttribute("aria-current");
    expect(button("Resources")).not.toHaveAttribute("data-current");
    await user.click(button("Product"));
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Editor" })).not.toHaveAttribute("aria-current");
  });

  it("an item's own `current` beats the router's verdict, both ways", async () => {
    const user = userEvent.setup();
    const items: NavigationMenuItem[] = [
      { id: "docs", label: "Docs", links: [{ label: "Guides", href: "/guides", current: false }, { label: "API", href: "/api", current: true }] },
      { id: "pricing", label: "Pricing", href: "/pricing", current: false },
    ];
    render(
      <RouterProvider isCurrent={(href) => href === "/guides" || href === "/pricing"}>
        <NavigationMenu items={items} />
      </RouterProvider>
    );
    expect(screen.getByRole("link", { name: "Pricing" })).not.toHaveAttribute("aria-current");
    await user.click(button("Docs"));
    expect(screen.getByRole("link", { name: "Guides" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "API" })).toHaveAttribute("aria-current", "page");
  });

  it("internal links render through the router's link; an external one is a plain anchor", async () => {
    const user = userEvent.setup();
    function RouterLink(props: ComponentPropsWithRef<"a">) {
      return <a data-router="" {...props} />;
    }
    render(
      <RouterProvider link={RouterLink}>
        <Menu />
      </RouterProvider>
    );
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("data-router");
    await user.click(button("Resources"));
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("data-router");
    expect(screen.getByRole("link", { name: "Status" })).not.toHaveAttribute("data-router");
  });

  it("a mega panel spans the anchor box it is given", async () => {
    const user = userEvent.setup();
    function WithAnchor() {
      const [bar, setBar] = useState<HTMLDivElement | null>(null);
      return (
        <div ref={setBar} data-testid="bar">
          {bar && <NavigationMenu items={ITEMS} anchorRef={{ current: bar }} />}
        </div>
      );
    }
    render(<WithAnchor />);
    vi.spyOn(screen.getByTestId("bar"), "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ width: 900, height: 64 }));
    await user.click(button("Product"));
    const panel = panelOf(button("Product"))!;
    expect(panel).toHaveAttribute("data-kind", "mega");
    expect(panel.style.getPropertyValue("--r-overlays-measure")).toBe("900px");
    await user.click(button("Resources"));
    expect(panelOf(button("Resources"))!.style.getPropertyValue("--r-overlays-measure")).toBe("");
  });

  it("navigationMenuLinks flattens a panel's links in order", () => {
    expect(navigationMenuLinks(ITEMS[0]!).map((l) => l.href)).toEqual(["/product/editor", "/product/analytics", "/product/releases"]);
    expect(navigationMenuLinks(ITEMS[2]!)).toEqual([]);
  });
});
