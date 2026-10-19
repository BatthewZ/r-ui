import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "../primitives";
import { FeatureRows, type FeatureRowsProps } from "./FeatureRows";

function Rows(props: Partial<FeatureRowsProps>) {
  return (
    <FeatureRows data-testid="rows" {...props}>
      <FeatureRows.Row eyebrow="Drafts" title="Write less" media={<img alt="Editor" src="a.png" />} actions={<Button>Try it</Button>}>
        <p>From merged work.</p>
      </FeatureRows.Row>
      <FeatureRows.Row title="Sort by audience" media={<img alt="Audiences" src="b.png" />}>
        <p>Who it affects.</p>
      </FeatureRows.Row>
      <FeatureRows.Row title="Publish everywhere" media={<img alt="Channels" src="c.png" />}>
        <p>One click.</p>
      </FeatureRows.Row>
    </FeatureRows>
  );
}

const rows = () => [...screen.getByTestId("rows").children] as HTMLElement[];
const part = (row: HTMLElement, name: "text" | "media") => row.querySelector<HTMLElement>(`:scope > [data-part="${name}"]`)!;

describe("FeatureRows", () => {
  it("every row is text first, media second in the DOM, whichever side the media is drawn on", () => {
    render(<Rows />);
    const all = rows();
    expect(all).toHaveLength(3);
    for (const row of all) {
      const children = [...row.children].map((el) => el.getAttribute("data-part"));
      expect(children).toEqual(["text", "media"]);
    }
    // Reading order inside the text column: eyebrow, title, body, actions.
    const order = [
      screen.getByText("Drafts"),
      screen.getByRole("heading", { name: "Write less" }),
      screen.getByText("From merged work."),
      screen.getByRole("button", { name: "Try it" }),
      screen.getByRole("img", { name: "Editor" }),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("alternates the media's side (end, start, end) by grid placement only", () => {
    render(<Rows />);
    const all = rows();
    expect(all.map((row) => row.dataset.mediaSide)).toEqual(["end", "start", "end"]);
    const [first, second] = all as [HTMLElement, HTMLElement];
    // Wide rows are two columns of the ROWS' container, not the viewport.
    expect(first).toHaveClass("@3xl:grid-cols-2");
    expect(screen.getByTestId("rows")).toHaveClass("@container");
    // Media at the end needs no placement; media at the start is placed in column 1, text in column 2.
    expect(part(first, "media")).not.toHaveClass("@3xl:col-start-1");
    expect(part(first, "text")).not.toHaveClass("@3xl:col-start-2");
    expect(part(second, "media")).toHaveClass("@3xl:col-start-1", "@3xl:row-start-1");
    expect(part(second, "text")).toHaveClass("@3xl:col-start-2");
  });

  it("a fixed side applies to every row, and a row may override it", () => {
    render(
      <FeatureRows mediaSide="start" data-testid="rows">
        <FeatureRows.Row title="A" media={<span>a</span>} />
        <FeatureRows.Row title="B" media={<span>b</span>} />
        <FeatureRows.Row title="C" media={<span>c</span>} mediaSide="end" />
      </FeatureRows>,
    );
    expect(rows().map((row) => row.dataset.mediaSide)).toEqual(["start", "start", "end"]);
  });

  it("stacked, the media shows first by default (CSS order, not DOM order) or last on request", () => {
    const { rerender } = render(<Rows />);
    for (const row of rows()) {
      expect(part(row, "media")).toHaveClass("order-first", "@3xl:order-none");
      expect(row.lastElementChild).toBe(part(row, "media"));
    }
    rerender(<Rows stackedMedia="last" />);
    for (const row of rows()) expect(part(row, "media")).not.toHaveClass("order-first");
  });

  it("titles are h3 on the display scale by default; headingLevel moves the outline only", () => {
    const { rerender } = render(<Rows />);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
    rerender(<Rows headingLevel={2} />);
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings).toHaveLength(3);
    for (const heading of headings) expect(heading).toHaveClass("text-display-3");
  });

  it("omits the slots it is not given", () => {
    render(
      <FeatureRows data-testid="rows">
        <FeatureRows.Row title="Only a title" />
      </FeatureRows>,
    );
    const [row] = rows() as [HTMLElement];
    expect(row.children).toHaveLength(1);
    expect(part(row, "text").children).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Only a title" })).toBeInTheDocument();
  });
});
