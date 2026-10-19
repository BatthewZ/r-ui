import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { Footer, type FooterProps } from "./Footer";

function Site(props: Partial<FooterProps>) {
  return (
    <Footer
      brand={<p>Kiln writes your release notes.</p>}
      newsletter={<form aria-label="Newsletter" />}
      localeSwitcher={<select aria-label="Language" />}
      copyright="Kiln Labs"
      year={2026}
      legal={
        <>
          <Footer.Link href="/privacy">Privacy</Footer.Link>
          <Footer.Link href="/terms">Terms</Footer.Link>
        </>
      }
      social={
        <>
          <Footer.SocialLink href="https://github.com/kiln" label="GitHub" icon={<svg data-testid="gh" />} />
          <Footer.SocialLink href="https://example.social/@kiln" label="Mastodon" icon={<svg />} />
        </>
      }
      {...props}
    >
      <Footer.Column title="Product">
        <Footer.Link href="/features">Features</Footer.Link>
        <Footer.Link href="/pricing">Pricing</Footer.Link>
      </Footer.Column>
      <Footer.Column title="Company" defaultOpen>
        <Footer.Link href="/about">About</Footer.Link>
      </Footer.Column>
    </Footer>
  );
}

describe("Footer", () => {
  it("is the page's contentinfo, with each column a navigation landmark named by its heading", () => {
    render(<Site />);
    const footer = screen.getByRole("contentinfo");
    const product = within(footer).getByRole("navigation", { name: "Product" });
    expect(within(product).getAllByRole("listitem")).toHaveLength(2);
    expect(within(product).getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
    expect(within(footer).getByRole("navigation", { name: "Company" })).toBeInTheDocument();
    // Two columns and the legal row.
    expect(within(footer).getAllByRole("navigation")).toHaveLength(3);
  });

  it("demotes to a div where the page already has its contentinfo", () => {
    render(<Site as="div" />);
    expect(screen.queryByRole("contentinfo")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Product" })).toBeInTheDocument();
  });

  it("writes the legal row: the copyright through its label and a named Legal navigation", () => {
    render(<Site />);
    expect(screen.getByText("© 2026 Kiln Labs")).toBeInTheDocument();
    const legal = screen.getByRole("navigation", { name: "Legal" });
    expect(within(legal).getAllByRole("link").map((a) => a.textContent)).toEqual(["Privacy", "Terms"]);
  });

  it("names icon-only social links, hides their glyphs and lists them under a name", () => {
    render(<Site />);
    const list = screen.getByRole("list", { name: "Social media" });
    const github = within(list).getByRole("link", { name: "GitHub" });
    expect(github).toHaveAttribute("href", "https://github.com/kiln");
    expect(github).toHaveAttribute("title", "GitHub");
    expect(screen.getByTestId("gh").closest("[aria-hidden]")).not.toBeNull();
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders the newsletter and locale switcher slots as given", () => {
    render(<Site />);
    expect(screen.getByRole("form", { name: "Newsletter" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Language" })).toBeInTheDocument();
  });

  it("takes its words from the LocaleProvider, and an instance's labels win over it", () => {
    const { rerender } = render(
      <LocaleProvider
        labels={{
          Footer: {
            legal: "Rechtliches",
            social: "Soziale Medien",
            copyright: (holder, year) => `© ${year} ${holder}. Alle Rechte vorbehalten.`,
          },
        }}
      >
        <Site />
      </LocaleProvider>,
    );
    expect(screen.getByRole("navigation", { name: "Rechtliches" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Soziale Medien" })).toBeInTheDocument();
    expect(screen.getByText("© 2026 Kiln Labs. Alle Rechte vorbehalten.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Legal" })).toBeNull();

    rerender(
      <LocaleProvider labels={{ Footer: { legal: "Rechtliches" } }}>
        <Site labels={{ legal: "Juridique" }} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("navigation", { name: "Juridique" })).toBeInTheDocument();
    // What neither sets comes from the defaults.
    expect(screen.getByRole("list", { name: "Social media" })).toBeInTheDocument();
  });

  it("makes each heading a disclosure for its list in the narrow form, closed unless defaultOpen", async () => {
    const user = userEvent.setup();
    render(<Site />);
    const product = screen.getByRole("navigation", { name: "Product" });
    const toggle = within(product).getByRole("button", { name: "Product" });
    const list = within(product).getByRole("list");
    expect(toggle).toHaveAttribute("aria-controls", list.id);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // jsdom runs no container query: the closed list carries the narrow-only hiding class.
    expect(list.classList).toContain("@max-md:hidden");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(list.classList).not.toContain("@max-md:hidden");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(list.classList).toContain("@max-md:hidden");

    const company = screen.getByRole("navigation", { name: "Company" });
    expect(within(company).getByRole("button", { name: "Company" })).toHaveAttribute("aria-expanded", "true");
    // The button only shows in the narrow form; the plain title only in the wide one.
    expect(toggle.classList).toContain("hidden");
    expect(toggle.classList).toContain("@max-md:flex");
    expect(document.getElementById(product.getAttribute("aria-labelledby")!)!.classList).toContain("@max-md:hidden");
  });

  it("puts column headings at the given level", () => {
    render(<Site headingLevel={3} />);
    const product = screen.getByRole("navigation", { name: "Product" });
    expect(product.querySelector("h3")).not.toBeNull();
    expect(product.querySelector("h2")).toBeNull();
  });

  it("prints the legal row only", () => {
    render(<Site />);
    const hidden = (el: Element) => el.closest('[data-print~="hide"]') !== null;
    expect(hidden(screen.getByRole("navigation", { name: "Legal" }))).toBe(false);
    expect(hidden(screen.getByText("© 2026 Kiln Labs"))).toBe(false);
    expect(hidden(screen.getByRole("navigation", { name: "Product" }))).toBe(true);
    expect(hidden(screen.getByText("Kiln writes your release notes."))).toBe(true);
    expect(hidden(screen.getByRole("form", { name: "Newsletter" }))).toBe(true);
    expect(hidden(screen.getByRole("list", { name: "Social media" }))).toBe(true);
    expect(hidden(screen.getByRole("combobox", { name: "Language" }))).toBe(true);
  });

  it("leaves out the parts it is not given", () => {
    render(<Footer copyright="Kiln Labs" year={2026} />);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("© 2026 Kiln Labs");
    expect(within(footer).queryByRole("navigation")).toBeNull();
    expect(within(footer).queryByRole("list")).toBeNull();
  });

  it("defaults the copyright year to this year", () => {
    render(<Footer copyright="Kiln Labs" />);
    expect(screen.getByText(`© ${new Date().getFullYear()} Kiln Labs`)).toBeInTheDocument();
  });

  it("puts className on the root and classNames on the parts, and spreads props to the root", () => {
    render(<Site className="mt-r2" classNames={{ legal: "pe-r2", social: "ps-r2" }} data-testid="root" />);
    const root = screen.getByTestId("root");
    expect(root.tagName).toBe("FOOTER");
    expect(root.classList).toContain("mt-r2");
    expect(screen.getByRole("navigation", { name: "Legal" }).classList).toContain("pe-r2");
    expect(screen.getByRole("list", { name: "Social media" }).classList).toContain("ps-r2");
  });
});
