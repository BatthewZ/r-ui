import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { RouterProvider } from "../../util/router";
import { type NavigationMenuItem, navigationMenuLinks } from "./NavigationMenu";
import { SiteHeader, type SiteHeaderProps } from "./SiteHeader";

afterEach(() => {
  vi.restoreAllMocks();
});

const ITEMS: NavigationMenuItem[] = [
  {
    id: "product",
    label: "Product",
    columns: [
      { id: "build", title: "Build", links: [{ label: "Editor", href: "/product/editor" }, { label: "Analytics", href: "/product/analytics" }] },
      { id: "ship", title: "Ship", links: [{ label: "Releases", href: "/product/releases" }] },
    ],
    featured: <a href="/changelog">What's new</a>,
  },
  { id: "resources", label: "Resources", links: [{ label: "Docs", href: "/docs" }, { label: "Blog", href: "/blog" }] },
  { id: "pricing", label: "Pricing", href: "/pricing" },
];

/** Every href the navigation offers, in order: top-level links, then each panel's links (and its featured link). */
const MODEL_HREFS = [
  ...ITEMS.flatMap((item) => (item.href !== undefined ? [item.href] : [...navigationMenuLinks(item).map((l) => l.href), ...(item.columns ? ["/changelog"] : [])])),
].sort();

function Header(props: Partial<SiteHeaderProps>) {
  return (
    <SiteHeader
      brand={<a href="/">Acme</a>}
      items={ITEMS}
      actions={<button type="button">Start free</button>}
      {...props}
    />
  );
}

/** A scroll box the header sticks in, with a scroll position the test sets. */
function scrollBox() {
  const box = screen.getByTestId("scroller");
  let top = 0;
  Object.defineProperty(box, "scrollTop", { configurable: true, get: () => top, set: (v: number) => (top = v) });
  return (to: number) => {
    top = to;
    fireEvent.scroll(box);
  };
}

const banner = () => screen.getByRole("banner");

describe("SiteHeader", () => {
  it("is a banner with the brand, the navigation, the actions and a menu button, and never prints", () => {
    render(<Header />);
    const header = banner();
    expect(header).toHaveAttribute("data-print", "hide");
    expect(within(header).getByRole("link", { name: "Acme" })).toBeInTheDocument();
    expect(within(header).getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    const menu = within(header).getByRole("button", { name: "Menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveAttribute("aria-haspopup", "dialog");
    expect(header).toHaveClass("@container");
  });

  it("chooses its form by its own width: the navigation and actions wide, the menu button narrow, at the chosen step", () => {
    const { rerender } = render(<Header />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    const menu = screen.getByRole("button", { name: "Menu" });
    expect(nav).toHaveClass("hidden", "@4xl:flex");
    expect(menu).toHaveClass("@4xl:hidden");
    expect(screen.getByRole("button", { name: "Start free" }).parentElement).toHaveClass("hidden", "@4xl:flex");
    rerender(<Header collapseBelow="lg" />);
    expect(nav).toHaveClass("@6xl:flex");
    expect(nav).not.toHaveClass("@4xl:flex");
    expect(menu).toHaveClass("@6xl:hidden");
  });

  it("the menu is a dialog holding the same links as the navigation, plus the actions", async () => {
    const user = userEvent.setup();
    render(<Header />);
    await user.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "true");
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-controls", dialog.id);
    const nav = within(dialog).getByRole("navigation", { name: "Main" });
    const hrefs = [...nav.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).sort();
    expect(hrefs).toEqual(MODEL_HREFS);
    // Panels are accordion sections; plain links are rows.
    expect(within(nav).getByRole("button", { name: "Product" })).toHaveAttribute("aria-expanded", "false");
    expect(within(nav).getByRole("link", { name: "Pricing" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Start free" })).toBeInTheDocument();
    expect(within(nav).queryAllByRole("menu")).toHaveLength(0);
  });

  it("the menu opens the section holding the current page, and following a link closes the menu", async () => {
    const user = userEvent.setup();
    const onMenuOpenChange = vi.fn();
    render(
      <RouterProvider isCurrent={(href) => href === "/docs"}>
        <Header onMenuOpenChange={onMenuOpenChange} />
      </RouterProvider>
    );
    await user.click(screen.getByRole("button", { name: "Menu" }));
    const nav = within(screen.getByRole("dialog", { name: "Menu" })).getByRole("navigation");
    expect(within(nav).getByRole("button", { name: "Resources" })).toHaveAttribute("aria-expanded", "true");
    expect(within(nav).getByRole("button", { name: "Product" })).toHaveAttribute("aria-expanded", "false");
    const docs = within(nav).getByRole("link", { name: "Docs" });
    expect(docs).toHaveAttribute("aria-current", "page");
    docs.addEventListener("click", (event) => event.preventDefault());
    await user.click(docs);
    expect(onMenuOpenChange.mock.calls).toEqual([[true], [false]]);
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("takes its words from its labels and the navigation's", async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider labels={{ SiteHeader: { menu: "Menü" }, NavigationMenu: { navigation: "Haupt" } }}>
        <Header />
      </LocaleProvider>
    );
    await user.click(screen.getByRole("button", { name: "Menü" }));
    const dialog = screen.getByRole("dialog", { name: "Menü" });
    expect(within(dialog).getByRole("navigation", { name: "Haupt" })).toBeInTheDocument();
    expect(screen.getAllByRole("navigation", { name: "Haupt" })).toHaveLength(2);
  });

  it("with no items and no actions there is no menu", () => {
    render(<SiteHeader brand={<a href="/">Acme</a>} />);
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("is sticky on the sticky layer only when asked (hideOnScroll implies it)", () => {
    const { rerender } = render(<Header />);
    expect(banner()).not.toHaveClass("sticky");
    rerender(<Header sticky />);
    expect(banner()).toHaveClass("sticky", "z-sticky");
    expect(banner()).toHaveAttribute("data-sticky");
    rerender(<Header hideOnScroll />);
    expect(banner()).toHaveClass("sticky", "z-sticky");
  });

  it("skipTo renders a skip link first that focuses its target, made focusable", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Header skipTo="#main" />
        <main id="main">Content</main>
      </>
    );
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(banner().querySelector("a, button")).toBe(skip);
    await user.tab();
    expect(skip).toHaveFocus();
    await user.keyboard("{Enter}");
    const main = screen.getByRole("main");
    expect(main).toHaveFocus();
    expect(main).toHaveAttribute("tabindex", "-1");
  });
});

describe("SiteHeader: hideOnScroll", () => {
  const renderInScroller = (props: Partial<SiteHeaderProps>) =>
    render(
      <div data-testid="scroller" style={{ overflowY: "auto" }}>
        <Header {...props} />
        <button type="button">Below</button>
      </div>
    );

  it("hides on a scroll down past it and shows on any scroll up past the slop", () => {
    renderInScroller({ hideOnScroll: true });
    const scrollTo = scrollBox();
    act(() => scrollTo(200));
    expect(banner()).toHaveAttribute("data-hidden");
    act(() => scrollTo(196));
    expect(banner()).toHaveAttribute("data-hidden");
    act(() => scrollTo(180));
    expect(banner()).not.toHaveAttribute("data-hidden");
    act(() => scrollTo(400));
    expect(banner()).toHaveAttribute("data-hidden");
    act(() => scrollTo(0));
    expect(banner()).not.toHaveAttribute("data-hidden");
  });

  it("never hides while focus is inside, and focus arriving brings it back", () => {
    renderInScroller({ hideOnScroll: true });
    const scrollTo = scrollBox();
    act(() => screen.getByRole("link", { name: "Acme" }).focus());
    act(() => scrollTo(300));
    expect(banner()).not.toHaveAttribute("data-hidden");
    act(() => screen.getByRole("button", { name: "Below" }).focus());
    act(() => scrollTo(600));
    expect(banner()).toHaveAttribute("data-hidden");
    act(() => screen.getByRole("link", { name: "Acme" }).focus());
    expect(banner()).not.toHaveAttribute("data-hidden");
  });

  it("never hides while a panel is open, focus elsewhere (opened by the pointer, or by its parent)", () => {
    vi.useFakeTimers();
    try {
      renderInScroller({ hideOnScroll: true });
      const scrollTo = scrollBox();
      act(() => screen.getByRole("button", { name: "Below" }).focus());
      fireEvent.pointerEnter(within(banner()).getByRole("button", { name: "Product" }), { pointerType: "mouse" });
      act(() => vi.advanceTimersByTime(500));
      expect(within(banner()).getByRole("button", { name: "Product" })).toHaveAttribute("aria-expanded", "true");
      act(() => scrollTo(300));
      expect(banner()).not.toHaveAttribute("data-hidden");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a panel open from the first render holds it too", () => {
    renderInScroller({ hideOnScroll: true, navigationProps: { defaultOpen: "resources" } });
    const scrollTo = scrollBox();
    act(() => scrollTo(300));
    expect(banner()).not.toHaveAttribute("data-hidden");
  });

  it("does nothing on scroll without hideOnScroll", () => {
    renderInScroller({ sticky: true });
    const scrollTo = scrollBox();
    act(() => scrollTo(500));
    expect(banner()).not.toHaveAttribute("data-hidden");
  });
});

describe("SiteHeader: transparent", () => {
  it("is transparent at the top of its scroller and solid once it moves", () => {
    render(
      <div data-testid="scroller" style={{ overflowY: "auto" }}>
        <Header variant="transparent" sticky />
      </div>
    );
    const scrollTo = scrollBox();
    expect(banner()).toHaveAttribute("data-variant", "transparent");
    expect(banner()).not.toHaveAttribute("data-scrolled");
    act(() => scrollTo(1));
    expect(banner()).toHaveAttribute("data-scrolled");
    act(() => scrollTo(0));
    expect(banner()).not.toHaveAttribute("data-scrolled");
  });

  it("follows the page when no ancestor scrolls", () => {
    render(<Header variant="transparent" sticky />);
    expect(banner()).not.toHaveAttribute("data-scrolled");
    Object.defineProperty(window, "scrollY", { configurable: true, value: 120 });
    try {
      act(() => {
        fireEvent.scroll(window);
      });
      expect(banner()).toHaveAttribute("data-scrolled");
    } finally {
      Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    }
  });

  it("is raised over the content under it even when not sticky", () => {
    render(<Header variant="transparent" />);
    expect(banner()).toHaveClass("relative", "z-sticky");
    expect(banner()).not.toHaveClass("sticky");
  });
});
