import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { Pricing, type PricingPlan, PricingTable, type PricingTableGroup } from "./Pricing";

const PLANS: PricingPlan[] = [
  { id: "starter", name: "Starter", price: { monthly: 0 }, features: ["One repository", { label: "Single sign-on", included: false }] },
  {
    id: "team",
    name: "Team",
    description: "For a product team.",
    price: { monthly: 12, annual: 120 },
    priceNote: "per editor",
    highlighted: true,
    features: ["No limit", "Single sign-on"],
    action: <button type="button">Start trial</button>,
  },
  { id: "business", name: "Business", price: { monthly: 25, annual: 240 } },
  { id: "enterprise", name: "Enterprise", action: <a href="#contact">Contact us</a> },
];

const card = (name: string) => {
  const heading = screen.getByRole("heading", { name });
  const item = heading.closest("li");
  if (!item) throw new Error(`no list item around ${name}`);
  return item;
};

describe("Pricing", () => {
  it("lists every plan as a card under its heading, prices in the locale's currency format", () => {
    render(<Pricing plans={PLANS} currency="USD" locale="en-US" />);
    const list = screen.getByRole("list", { name: "Plans" });
    expect(within(list).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Starter",
      "Team",
      "Business",
      "Enterprise",
    ]);
    // A whole amount loses its zero cents; 0 is Free; no price is Custom.
    expect(within(card("Team")).getByText("$12")).toBeInTheDocument();
    expect(within(card("Team")).getByText("per editor")).toBeInTheDocument();
    expect(within(card("Starter")).getByText("Free")).toBeInTheDocument();
    expect(within(card("Enterprise")).getByText("Custom")).toBeInTheDocument();
    expect(within(card("Enterprise")).getByRole("link", { name: "Contact us" })).toBeInTheDocument();
    // Free and custom prices are not "per month".
    expect(within(card("Starter")).queryByText("per month")).toBeNull();
    expect(within(card("Team")).getByText("per month")).toBeInTheDocument();
  });

  it("formats in the LocaleProvider's locale, and keeps a fraction where there is one", () => {
    render(
      <LocaleProvider locale="de-DE">
        <Pricing plans={[{ id: "a", name: "A", price: { monthly: 9.5 } }, { id: "b", name: "B", price: { monthly: 1200 } }]} currency="EUR" />
      </LocaleProvider>,
    );
    expect(within(card("A")).getByText(/^9,50\s€$/)).toBeInTheDocument();
    expect(within(card("B")).getByText(/^1\.200\s€$/)).toBeInTheDocument();
  });

  it("switches every price to annual billing and speaks the change once, politely", async () => {
    const user = userEvent.setup();
    const onBillingChange = vi.fn();
    render(<Pricing plans={PLANS} currency="USD" locale="en-US" onBillingChange={onBillingChange} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/^$/);

    const toggle = screen.getByRole("radiogroup", { name: "Billing period" });
    expect(within(toggle).getByRole("radio", { name: "Monthly" })).toBeChecked();
    await user.click(within(toggle).getByRole("radio", { name: "Annual" }));

    expect(onBillingChange).toHaveBeenCalledTimes(1);
    expect(onBillingChange).toHaveBeenCalledWith("annual");
    // 120 a year is 10 a month; the yearly bill and the plan's saving under it.
    expect(within(card("Team")).getByText("$10")).toBeInTheDocument();
    expect(within(card("Team")).getByText(/\$120 billed yearly/)).toBeInTheDocument();
    expect(within(card("Team")).getByText("save 17%")).toBeInTheDocument();
    expect(within(card("Business")).getByText("$20")).toBeInTheDocument();
    // A plan with no annual price keeps its own.
    expect(within(card("Starter")).getByText("Free")).toBeInTheDocument();
    expect(status).toHaveTextContent(
      "Annual billing: Starter, Free, Team, $10 per month, Business, $20 per month, Enterprise, Custom",
    );

    await user.click(within(toggle).getByRole("radio", { name: "Monthly" }));
    expect(within(card("Team")).getByText("$12")).toBeInTheDocument();
    expect(within(card("Team")).queryByText(/billed yearly/)).toBeNull();
    expect(status).toHaveTextContent(/^Monthly billing: Starter, Free, Team, \$12 per month/);
  });

  it("speaks a change a parent makes to a controlled billing, and nothing on mount", () => {
    function Controlled() {
      const [billing, setBilling] = useState<"monthly" | "annual">("annual");
      return (
        <>
          <button type="button" onClick={() => setBilling("monthly")}>
            Parent
          </button>
          <Pricing plans={PLANS.slice(1, 3)} currency="USD" locale="en-US" billing={billing} onBillingChange={setBilling} />
        </>
      );
    }
    render(<Controlled />);
    expect(screen.getByRole("status")).toHaveTextContent(/^$/);
    expect(within(card("Team")).getByText("$10")).toBeInTheDocument();
    act(() => screen.getByRole("button", { name: "Parent" }).click());
    expect(within(card("Team")).getByText("$12")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Monthly billing: Team, $12 per month, Business, $25 per month");
  });

  it("names the best saving beside the toggle, 'up to' when plans save differently, and describes the toggle with it", () => {
    const { unmount } = render(<Pricing plans={PLANS} currency="USD" locale="en-US" />);
    // Team saves 1 - 120/144 = 17%, Business 1 - 240/300 = 20%.
    expect(screen.getByRole("radiogroup", { name: "Billing period" })).toHaveAccessibleDescription(
      "Save up to 20% with annual billing",
    );
    unmount();
    render(<Pricing plans={PLANS.slice(1, 2)} currency="USD" locale="en-US" />);
    expect(screen.getByRole("radiogroup")).toHaveAccessibleDescription("Save 17% with annual billing");
  });

  it("offers no toggle when no plan has an annual price", () => {
    render(<Pricing plans={[PLANS[0]!, { id: "x", name: "X", price: { monthly: 5 } }]} currency="USD" locale="en-US" />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("tells the highlighted plan apart in words and a data hook for its edge, not colour alone", () => {
    render(<Pricing plans={PLANS} currency="USD" locale="en-US" />);
    const team = card("Team");
    expect(within(team).getByText("Most popular")).toBeInTheDocument();
    expect(team.querySelector("[data-highlighted]")).not.toBeNull();
    for (const other of ["Starter", "Business", "Enterprise"]) {
      expect(within(card(other)).queryByText("Most popular")).toBeNull();
      expect(card(other).querySelector("[data-highlighted]")).toBeNull();
    }
  });

  it("takes a plan's own badge over the default", () => {
    render(
      <Pricing plans={[{ ...PLANS[1]!, badge: <span>Best value</span> }]} currency="USD" locale="en-US" />,
    );
    expect(screen.getByText("Best value")).toBeInTheDocument();
    expect(screen.queryByText("Most popular")).toBeNull();
  });

  it("marks an excluded feature by glyph, strike and words, and leaves included ones unprefixed", () => {
    render(<Pricing plans={PLANS} currency="USD" locale="en-US" />);
    const items = within(card("Starter")).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["One repository", "Not included: Single sign-on"]);
    expect(items[0]?.querySelector("svg.lucide-check")).not.toBeNull();
    expect(items[1]?.querySelector("svg.lucide-x")).not.toBeNull();
    expect(items[1]?.querySelector(".line-through")).not.toBeNull();
    expect(within(card("Team")).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "No limit",
      "Single sign-on",
    ]);
  });

  it("reads its words from the provider and the instance, the instance last", () => {
    render(
      <LocaleProvider labels={{ Pricing: { annual: "Jährlich", free: "Kostenlos" } }}>
        <Pricing plans={PLANS} currency="USD" locale="en-US" labels={{ free: "Gratis" }} headingLevel={2} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("radio", { name: "Jährlich" })).toBeInTheDocument();
    expect(within(card("Starter")).getByText("Gratis")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(4);
  });

  it("shows skeleton cards while loading, says so once, and disables the toggle", () => {
    render(<Pricing plans={PLANS.slice(0, 2)} currency="USD" locale="en-US" loading />);
    const list = screen.getByRole("list", { name: "Plans" });
    expect(list).toHaveAttribute("aria-busy", "true");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).queryByRole("heading")).toBeNull();
    expect(screen.getAllByRole("status").map((s) => s.textContent)).toEqual(["Loading plans", ""]);
    expect(screen.getByRole("radio", { name: "Annual" })).toBeDisabled();
  });

  it("spreads props to the root and puts className there", () => {
    render(<Pricing plans={PLANS} currency="USD" locale="en-US" className="mt-r1" data-testid="root" />);
    expect(screen.getByTestId("root")).toHaveClass("mt-r1");
    expect(screen.getByTestId("root")).toContainElement(screen.getByRole("list", { name: "Plans" }));
  });
});

const GROUPS: PricingTableGroup[] = [
  {
    id: "publishing",
    label: "Publishing",
    features: [
      { id: "repos", label: "Repositories", values: { starter: "1", team: "No limit", business: "No limit" } },
      { id: "rss", label: "Docs page and RSS", values: { starter: true, team: true, business: true } },
    ],
  },
  {
    id: "security",
    label: "Security",
    features: [
      {
        id: "sso",
        label: "Single sign-on",
        description: "Sign in through your identity provider.",
        values: { starter: false, business: true },
      },
    ],
  },
];

describe("PricingTable", () => {
  it("is a named table: plans as column headers, features as row headers, each group its own row group", () => {
    render(<PricingTable plans={PLANS.slice(0, 3)} groups={GROUPS} />);
    const table = screen.getByRole("table", { name: "Compare plans" });
    const heads = within(table).getAllByRole("columnheader");
    expect(heads.map((h) => h.textContent)).toEqual(["Feature", "Starter", "Most popularTeam", "Business"]);
    // A group's heading is a row header too, for its row group.
    expect(within(table).getAllByRole("rowheader").map((h) => [h.getAttribute("scope"), h.textContent])).toEqual([
      ["rowgroup", "Publishing"],
      ["row", "Repositories"],
      ["row", "Docs page and RSS"],
      ["rowgroup", "Security"],
      ["row", "Single sign-on"],
    ]);
    expect(within(table).getAllByRole("rowheader").filter((h) => h.getAttribute("scope") === "row").map((h) => h.textContent)).toEqual([
      "Repositories",
      "Docs page and RSS",
      "Single sign-on",
    ]);
    const bodies = table.querySelectorAll("tbody");
    expect(bodies).toHaveLength(2);
    const groupHead = within(bodies[1] as HTMLElement).getByText("Security").closest("th");
    expect(groupHead).toHaveAttribute("scope", "rowgroup");
    expect(groupHead).toHaveAttribute("colspan", "4");
  });

  it("speaks a check as Included and a cross or a missing value as Not included, and shows text as written", () => {
    render(<PricingTable plans={PLANS.slice(0, 3)} groups={GROUPS} />);
    const sso = screen.getByRole("rowheader", { name: "Single sign-on" }).closest("tr") as HTMLElement;
    const cells = within(sso).getAllByRole("cell");
    // Starter false, Team missing, Business true.
    expect(cells.map((c) => c.textContent)).toEqual(["Not included", "Not included", "Included"]);
    expect(cells[0]?.querySelector("svg.lucide-x")).not.toBeNull();
    expect(cells[2]?.querySelector("svg.lucide-check")).not.toBeNull();
    const repos = screen.getByRole("rowheader", { name: "Repositories" }).closest("tr") as HTMLElement;
    expect(within(repos).getAllByRole("cell").map((c) => c.textContent)).toEqual(["1", "No limit", "No limit"]);
  });

  it("pins the feature column: the corner and every feature's header carry the sticky part", () => {
    render(<PricingTable plans={PLANS.slice(0, 3)} groups={GROUPS} />);
    const table = screen.getByRole("table");
    const sticky = table.querySelectorAll(".r-marketing-pricing-sticky");
    expect(sticky).toHaveLength(4);
    const rows = screen.getAllByRole("rowheader").filter((h) => h.getAttribute("scope") === "row");
    expect(rows).toHaveLength(3);
    for (const header of rows) expect(header).toHaveClass("r-marketing-pricing-sticky");
    expect(table.querySelector("thead")).toHaveAttribute("data-sticky");
  });

  it("explains a feature on keyboard focus of its name, and on a press", async () => {
    const user = userEvent.setup();
    render(<PricingTable plans={PLANS.slice(0, 3)} groups={GROUPS} />);
    const term = screen.getByRole("button", { name: "Single sign-on" });
    expect(screen.queryByRole("tooltip")).toBeNull();

    await user.tab();
    expect(term).toHaveFocus();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Sign in through your identity provider.");
    expect(term).toHaveAccessibleDescription("Sign in through your identity provider.");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();

    // A press (how touch gets there) opens it and it stays open.
    await user.click(term);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Sign in through your identity provider.");
    // A feature without a description is plain text, not a button.
    expect(screen.queryByRole("button", { name: "Repositories" })).toBeNull();
  });

  it("takes the caller's name and the shared labels", () => {
    render(
      <PricingTable
        plans={PLANS.slice(0, 3)}
        groups={GROUPS}
        aria-label="Every feature"
        labels={{ included: "Yes", excluded: "No", feature: "Funktion" }}
      />,
    );
    const table = screen.getByRole("table", { name: "Every feature" });
    expect(within(table).getAllByRole("columnheader")[0]).toHaveTextContent("Funktion");
    const rss = screen.getByRole("rowheader", { name: "Docs page and RSS" }).closest("tr") as HTMLElement;
    expect(within(rss).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Yes", "Yes", "Yes"]);
  });
});
