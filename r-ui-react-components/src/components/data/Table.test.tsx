import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Table, type TableProps } from "./Table";

function Services(props: Partial<TableProps> & { onSort?: () => void; selectable?: boolean }) {
  const { onSort, selectable, ...rest } = props;
  return (
    <Table aria-label="Services" {...rest}>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>Service</Table.HeaderCell>
          <Table.HeaderCell numeric sort="desc" onSort={onSort}>
            p95 ms
          </Table.HeaderCell>
          <Table.HeaderCell numeric priority={3} onSort={onSort}>
            Req/s
          </Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        <Table.Row selected={selectable ? true : undefined}>
          <Table.Cell>checkout-service-with-a-long-name</Table.Cell>
          <Table.Cell numeric>640</Table.Cell>
          <Table.Cell numeric priority={3}>
            2,310
          </Table.Cell>
        </Table.Row>
        <Table.Row selected={selectable ? false : undefined}>
          <Table.Cell title="search (discovery)">
            <b>search</b> discovery
          </Table.Cell>
          <Table.Cell numeric>212</Table.Cell>
          <Table.Cell numeric priority={3}>
            6,120
          </Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  );
}

describe("Table", () => {
  it("names the <table>, not its scroll wrapper", () => {
    render(<Services />);
    const table = screen.getByRole("table", { name: "Services" });
    expect(table.tagName).toBe("TABLE");
    expect(table.parentElement).not.toHaveAttribute("aria-label");
  });

  it("is named by a caption", () => {
    render(
      <Table>
        <Table.Caption>Deploys this week</Table.Caption>
        <Table.Body>
          <Table.Row>
            <Table.Cell>v1</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>,
    );
    expect(screen.getByRole("table", { name: "Deploys this week" })).toBeInTheDocument();
  });

  it("puts a real button in a sortable header and calls onSort once per activation", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(<Services onSort={onSort} />);
    const button = screen.getByRole("button", { name: "p95 ms" });
    expect(button.closest("th")).toBe(screen.getByRole("columnheader", { name: "p95 ms" }));
    await user.click(button);
    expect(onSort).toHaveBeenCalledTimes(1);
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onSort).toHaveBeenCalledTimes(3);
  });

  it("sets aria-sort on the sorted header only", () => {
    render(<Services onSort={() => undefined} />);
    expect(screen.getByRole("columnheader", { name: "p95 ms" })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("columnheader", { name: "Req/s" })).not.toHaveAttribute("aria-sort");
    expect(screen.getByRole("columnheader", { name: "Service" })).not.toHaveAttribute("aria-sort");
    // A header without onSort has no button.
    expect(within(screen.getByRole("columnheader", { name: "Service" })).queryByRole("button")).toBeNull();
  });

  it("publishes aria-selected only when the table has selection", () => {
    const { unmount } = render(<Services />);
    for (const row of screen.getAllByRole("row")) expect(row).not.toHaveAttribute("aria-selected");
    unmount();

    render(<Services selectable />);
    const [, first, second] = screen.getAllByRole("row");
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(first).toHaveAttribute("data-selected");
    expect(second).toHaveAttribute("aria-selected", "false");
    expect(second).not.toHaveAttribute("data-selected");
  });

  it("gives a truncating text cell its full value as title; an explicit title wins", () => {
    render(<Services />);
    expect(screen.getByRole("cell", { name: "checkout-service-with-a-long-name" })).toHaveAttribute(
      "title",
      "checkout-service-with-a-long-name",
    );
    expect(screen.getByRole("cell", { name: "search discovery" })).toHaveAttribute("title", "search (discovery)");
  });

  it("end-aligns numeric cells with tabular figures and sizes them to content", () => {
    render(<Services />);
    const num = screen.getByRole("cell", { name: "640" });
    expect(num).toHaveClass("text-end", "tabular-nums", "w-0", "whitespace-nowrap");
    expect(num).not.toHaveClass("max-w-0");
    const text = screen.getByRole("cell", { name: "checkout-service-with-a-long-name" });
    expect(text).toHaveClass("max-w-0", "truncate");
    expect(text).not.toHaveClass("text-end");
  });

  it("wraps a `wrap` cell onto more lines in either layout, with no width trick and no title", () => {
    const plans = (layout: "auto" | "fixed") => (
      <Table layout={layout} aria-label="Plans">
        <Table.Body>
          <Table.Row>
            <Table.HeaderCell scope="row" wrap className="py-r4">
              Review before publishing
            </Table.HeaderCell>
            <Table.Cell wrap>Up to five reviewers per channel</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    );
    const { rerender } = render(plans("auto"));
    for (const layout of ["auto", "fixed"] as const) {
      rerender(plans(layout));
      const header = screen.getByRole("rowheader");
      const cell = screen.getByRole("cell");
      for (const el of [header, cell]) {
        expect(el).toHaveClass("whitespace-normal", "break-words");
        for (const cls of ["truncate", "whitespace-nowrap", "w-0", "max-w-0"]) expect(el).not.toHaveClass(cls);
        expect(el).not.toHaveAttribute("title");
      }
      // The caller's padding still beats the wrap padding.
      expect(header).toHaveClass("py-r4");
      expect(header).not.toHaveClass("py-r5");
      expect(cell).toHaveClass("py-r5");
    }
  });

  it("drops a column by the table's own container, never the viewport", () => {
    render(<Services />);
    expect(screen.getByRole("table").parentElement).toHaveClass("@container/table");
    expect(screen.getByRole("columnheader", { name: "Req/s" })).toHaveClass("@max-lg/table:hidden");
    expect(screen.getByRole("cell", { name: "2,310" })).toHaveClass("@max-lg/table:hidden");
    expect(screen.getByRole("columnheader", { name: "Service" }).className).not.toMatch(/table:hidden/);
  });

  it("draws rules and a frame per variant", () => {
    const { rerender } = render(<Services variant="boxed" />);
    const root = () => screen.getByRole("table").parentElement;
    const cell = () => screen.getByRole("cell", { name: "640" });
    expect(root()).toHaveClass("border", "rounded-lg");
    expect(cell()).toHaveClass("border-b");
    rerender(<Services variant="rules" />);
    expect(root()).not.toHaveClass("border");
    expect(cell()).toHaveClass("border-b");
    rerender(<Services variant="plain" />);
    expect(cell()).not.toHaveClass("border-b");
  });

  it("uses a fixed layout that clips every cell", () => {
    render(<Services layout="fixed" />);
    expect(screen.getByRole("table")).toHaveClass("table-fixed");
    const num = screen.getByRole("cell", { name: "640" });
    expect(num).toHaveClass("truncate");
    expect(num).not.toHaveClass("w-0");
  });

  it("bands rows by data index, not DOM position", () => {
    render(
      <Table striped>
        <Table.Body>
          <Table.Row index={0}>
            <Table.Cell>a</Table.Cell>
          </Table.Row>
          <Table.Row index={1}>
            <Table.Cell>b</Table.Cell>
          </Table.Row>
          <Table.Row index={4}>
            <Table.Cell>e</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>,
    );
    const [a, b, e] = screen.getAllByRole("row");
    expect(a).not.toHaveClass("bg-surface-1");
    expect(b).toHaveClass("bg-surface-1");
    expect(e).not.toHaveClass("bg-surface-1");
  });

  it("lets the caller's className win on the root and lands other props there", () => {
    render(<Services className="rounded-sm" data-testid="root" />);
    const root = screen.getByTestId("root");
    expect(root).toBe(screen.getByRole("table").parentElement);
    expect(root).toHaveClass("rounded-sm");
    expect(root).not.toHaveClass("rounded-lg");
    expect(root).toHaveClass("overflow-auto");
  });

  it("pins the head when sticky, with an opaque band even in an unbanded chrome", () => {
    const { rerender } = render(<Services variant="plain" />);
    const head = () => screen.getAllByRole("rowgroup")[0];
    const th = () => screen.getByRole("columnheader", { name: "Service" });
    expect(head()).not.toHaveClass("sticky");
    expect(th()).not.toHaveClass("bg-surface-1");
    rerender(<Services variant="plain" stickyHeader />);
    expect(head()?.tagName).toBe("THEAD");
    expect(head()).toHaveClass("sticky", "top-0");
    expect(th()).toHaveClass("bg-surface-1");
  });
});
