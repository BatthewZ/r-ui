import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "../../util/locale";

import { AvatarGroup } from "./AvatarGroup";

const TEAM = [
  { name: "Ada Lovelace" },
  { name: "Grace Hopper" },
  { name: "Alan Turing" },
  { name: "Katherine Johnson" },
  { name: "Edsger Dijkstra" },
  { name: "Barbara Liskov" },
];

const items = () => within(screen.getByRole("list", { name: "Team" })).getAllByRole("listitem");

describe("AvatarGroup", () => {
  it("is a list named by its label, each face an image named by its person", () => {
    render(<AvatarGroup label="Team" items={TEAM.slice(0, 3)} />);
    expect(items()).toHaveLength(3);
    expect(screen.getAllByRole("img").map((img) => img.getAttribute("aria-label"))).toEqual([
      "Ada Lovelace",
      "Grace Hopper",
      "Alan Turing",
    ]);
    expect(items()[1]).toHaveAttribute("title", "Grace Hopper");
    expect(screen.queryByText(/more/)).toBeNull();
  });

  it("past max, draws max − 1 faces and a +n chip that names who it stands for", () => {
    render(<AvatarGroup label="Team" items={TEAM} max={4} />);
    expect(items()).toHaveLength(4);
    expect(screen.getAllByRole("img")).toHaveLength(3);
    const chip = items()[3]!;
    expect(chip).toHaveTextContent("+3");
    expect(within(chip).getByText("3 more: Katherine Johnson, Edsger Dijkstra, Barbara Liskov")).toHaveClass("sr-only");
    expect(within(chip).getByText("+3")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows everyone when they fit max, and never fewer than two circles", () => {
    const { rerender } = render(<AvatarGroup label="Team" items={TEAM.slice(0, 4)} max={4} />);
    expect(screen.getAllByRole("img")).toHaveLength(4);
    rerender(<AvatarGroup label="Team" items={TEAM} max={1} />);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(items()[1]).toHaveTextContent("+5");
  });

  it("hands the surplus to renderOverflow", () => {
    render(
      <AvatarGroup
        label="Team"
        items={TEAM}
        max={3}
        renderOverflow={(overflow) => (
          <button type="button" className={overflow.className} aria-label={overflow.label}>
            <span className={overflow.textClassName}>{overflow.text}</span>
            {overflow.items.length}
          </button>
        )}
      />,
    );
    const more = screen.getByRole("button", { name: "4 more: Alan Turing, Katherine Johnson, Edsger Dijkstra, Barbara Liskov" });
    expect(more).toHaveClass("r-primitives-avatar-chip", "size-control");
    expect(more).toHaveTextContent("+44");
  });

  it("sizes faces and chip together", () => {
    render(<AvatarGroup label="Team" items={TEAM} max={3} size="icon" />);
    expect(screen.getByRole("list")).toHaveAttribute("data-size", "icon");
    for (const img of screen.getAllByRole("img")) expect(img).toHaveClass("size-icon");
    expect(items()[2]!.firstElementChild).toHaveClass("size-icon");
  });

  it("reads its words from a LocaleProvider", () => {
    render(
      <LocaleProvider labels={{ AvatarGroup: { more: (n) => `+${n}`, moreNames: (n) => `und ${n} weitere` } }}>
        <AvatarGroup label="Team" items={TEAM} max={5} />
      </LocaleProvider>,
    );
    expect(screen.getByText("und 2 weitere")).toBeInTheDocument();
  });
});
