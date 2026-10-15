import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentPropsWithRef } from "react";
import { describe, expect, it } from "vitest";

import { Breadcrumbs } from "./Breadcrumbs";

function RouterLink({ to, ...props }: { to: string } & Omit<ComponentPropsWithRef<"a">, "href">) {
  return <a href={`/app${to}`} {...props} />;
}

const trail = (maxItems?: number) => (
  <Breadcrumbs maxItems={maxItems}>
    <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
    <Breadcrumbs.Item href="/services">Services</Breadcrumbs.Item>
    <Breadcrumbs.Item href="/services/payments">Payments</Breadcrumbs.Item>
    <Breadcrumbs.Item as={RouterLink} to="/services/payments/eu">
      eu-west-1
    </Breadcrumbs.Item>
    <Breadcrumbs.Item href="/services/payments/eu/api">payments-api</Breadcrumbs.Item>
    <Breadcrumbs.Item current>Deploy #4182</Breadcrumbs.Item>
  </Breadcrumbs>
);

describe("Breadcrumbs", () => {
  it("is a named navigation landmark holding an ordered list", () => {
    render(trail());
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("list").tagName).toBe("OL");
    expect(within(nav).getAllByRole("listitem")).toHaveLength(6);
  });

  it("marks the current page and does not make it a link", () => {
    render(trail());
    const current = screen.getByText("Deploy #4182");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.tagName).toBe("SPAN");
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("renders a router link through `as`", () => {
    render(trail());
    expect(screen.getByRole("link", { name: "eu-west-1" })).toHaveAttribute("href", "/app/services/payments/eu");
  });

  it("separators are hidden from assistive tech", () => {
    const { container } = render(trail());
    const separators = container.querySelectorAll("li > svg");
    expect(separators).toHaveLength(5);
    for (const s of separators) expect(s).toHaveAttribute("aria-hidden", "true");
  });

  it("does not collapse at or under maxItems", () => {
    render(trail(6));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
  });

  it("collapses the middle over maxItems, keeping 1 before and 2 after", () => {
    render(trail(4));
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("Home");
    expect(within(items[1]!).getByRole("button", { name: "Show 3 more" })).toBeInTheDocument();
    expect(items[2]).toHaveTextContent("payments-api");
    expect(items[3]).toHaveTextContent("Deploy #4182");
    expect(screen.queryByRole("link", { name: "Services" })).not.toBeInTheDocument();
  });

  it("expanding reveals every crumb and moves focus to the first revealed one", async () => {
    const user = userEvent.setup();
    render(trail(4));
    await user.click(screen.getByRole("button", { name: "Show 3 more" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Services" })).toHaveFocus();
  });

  it("expanding onto a plain-text crumb focuses the first revealed link instead", async () => {
    const user = userEvent.setup();
    render(
      <Breadcrumbs maxItems={4}>
        <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
        <Breadcrumbs.Item>Services</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/services/payments">Payments</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/eu">eu-west-1</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/api">payments-api</Breadcrumbs.Item>
        <Breadcrumbs.Item current>Deploy</Breadcrumbs.Item>
      </Breadcrumbs>,
    );
    await user.click(screen.getByRole("button", { name: "Show 3 more" }));
    expect(screen.getByRole("link", { name: "Payments" })).toHaveFocus();
  });

  it("expanding a run of plain-text crumbs focuses the first of them, never <body>", async () => {
    const user = userEvent.setup();
    render(
      <Breadcrumbs maxItems={3} itemsAfterCollapse={1}>
        <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
        <Breadcrumbs.Item>Region</Breadcrumbs.Item>
        <Breadcrumbs.Item>Zone</Breadcrumbs.Item>
        <Breadcrumbs.Item current>Deploy</Breadcrumbs.Item>
      </Breadcrumbs>,
    );
    await user.click(screen.getByRole("button", { name: "Show 2 more" }));
    const items = screen.getAllByRole("listitem");
    expect(items[1]).toHaveTextContent("Region");
    expect(items[1]).toHaveFocus();
  });

  it("flattens fragments and skips holes in its children", () => {
    const show = false;
    render(
      <Breadcrumbs>
        <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
        {show && <Breadcrumbs.Item href="/x">Hidden</Breadcrumbs.Item>}
        <>
          <Breadcrumbs.Item href="/a">A</Breadcrumbs.Item>
          <Breadcrumbs.Item current>B</Breadcrumbs.Item>
        </>
      </Breadcrumbs>,
    );
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Home", "A", "B"]);
  });

  it("never collapses a single crumb into a button", () => {
    render(
      <Breadcrumbs maxItems={3}>
        <Breadcrumbs.Item href="/">A</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/b">B</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/c">C</Breadcrumbs.Item>
        <Breadcrumbs.Item current>D</Breadcrumbs.Item>
      </Breadcrumbs>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("takes a translated landmark and expand label", () => {
    render(
      <Breadcrumbs maxItems={3} labels={{ nav: "Fil d'Ariane", expand: (n) => `Afficher ${n} de plus` }}>
        <Breadcrumbs.Item href="/">A</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/b">B</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/c">C</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/d">D</Breadcrumbs.Item>
        <Breadcrumbs.Item current>E</Breadcrumbs.Item>
      </Breadcrumbs>,
    );
    expect(screen.getByRole("navigation", { name: "Fil d'Ariane" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Afficher 2 de plus" })).toBeInTheDocument();
  });
});
