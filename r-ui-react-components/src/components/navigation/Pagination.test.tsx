import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { formatNumber } from "../../util/format";
import { Pagination, pageSlots } from "./Pagination";

describe("pageSlots", () => {
  it("lists every page when they fit", () => {
    expect(pageSlots(1, 5, 1)).toEqual([1, 2, 3, 4, 5]);
    expect(pageSlots(4, 7, 1)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps a constant slot count with gaps at either end", () => {
    expect(pageSlots(1, 20, 1)).toEqual([1, 2, 3, 4, 5, "gap-end", 20]);
    expect(pageSlots(10, 20, 1)).toEqual([1, "gap-start", 9, 10, 11, "gap-end", 20]);
    expect(pageSlots(20, 20, 1)).toEqual([1, "gap-start", 16, 17, 18, 19, 20]);
    for (let page = 1; page <= 20; page += 1) expect(pageSlots(page, 20, 1)).toHaveLength(7);
    for (let page = 1; page <= 20; page += 1) expect(pageSlots(page, 20, 2)).toHaveLength(9);
  });
});

const page = (n: number) => screen.getByRole("button", { name: `Page ${formatNumber(n)}` });

describe("Pagination", () => {
  it("is a named landmark with prev/next and numbered pages", () => {
    render(<Pagination pageCount={12} defaultPage={6} />);
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
    expect(page(6)).toHaveAttribute("aria-current", "page");
    expect(page(5)).not.toHaveAttribute("aria-current");
    expect(page(1)).toBeInTheDocument();
    expect(page(12)).toBeInTheDocument();
  });

  it("disables previous on the first page and next on the last", () => {
    const { rerender } = render(<Pagination pageCount={3} page={1} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
    rerender(<Pagination pageCount={3} page={3} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("uncontrolled: next, prev and a page button move the page", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination pageCount={12} onPageChange={onPageChange} />);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(page(2)).toHaveAttribute("aria-current", "page");
    await user.click(page(5));
    expect(page(5)).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(page(4)).toHaveAttribute("aria-current", "page");
    expect(onPageChange.mock.calls).toEqual([[2], [5], [4]]);
  });

  it("controlled: reports the request and shows the owner's page", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination pageCount={12} page={3} onPageChange={onPageChange} />);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(4);
    expect(page(3)).toHaveAttribute("aria-current", "page");
  });

  it("clicking the current page does not report a change", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination pageCount={5} defaultPage={2} onPageChange={onPageChange} />);
    await user.click(page(2));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("reaching an end hands focus to the opposite arrow instead of dropping it", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [p, setP] = useState(2);
      return <Pagination pageCount={3} page={p} onPageChange={setP} />;
    }
    render(<Owner />);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous page" })).toHaveFocus();
    await user.keyboard("{Enter}{Enter}");
    expect(page(1)).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Next page" })).toHaveFocus();
  });

  it("shows the compact status for narrow containers, with formatted numbers", () => {
    render(<Pagination pageCount={12345} defaultPage={1234} />);
    expect(screen.getByText(`Page ${formatNumber(1234)} of ${formatNumber(12345)}`)).toBeInTheDocument();
  });

  it("clamps an out-of-range page into range", () => {
    render(<Pagination pageCount={4} page={9} onPageChange={() => {}} />);
    expect(page(4)).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("takes translated labels", () => {
    render(
      <Pagination
        pageCount={3}
        labels={{ nav: "Seiten", previous: "Zurück", next: "Weiter", page: (p) => `Seite ${p}` }}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Seiten" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zurück" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Seite 2" })).toBeInTheDocument();
  });
});
