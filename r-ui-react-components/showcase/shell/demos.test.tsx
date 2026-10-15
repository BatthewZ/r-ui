import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SearchInputSection from "../sections/form/SearchInput";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the SearchInput demo's simulated latency", () => {
  it("is busy while a query settles, then idle", () => {
    render(<SearchInputSection />);
    const field = screen.getByRole("searchbox", { name: "Find a service" });
    expect(field).toHaveAttribute("aria-busy", "true");
    act(() => vi.advanceTimersByTime(600));
    expect(field).not.toHaveAttribute("aria-busy");
  });

  it("stops being busy when the field is cleared mid-search", () => {
    render(<SearchInputSection />);
    const field = screen.getByRole("searchbox", { name: "Find a service" });
    expect(field).toHaveAttribute("aria-busy", "true");
    fireEvent.click(screen.getAllByRole("button", { name: "Clear search" })[0]!);
    expect(field).toHaveValue("");
    act(() => vi.advanceTimersByTime(2000));
    expect(field).not.toHaveAttribute("aria-busy");
  });
});
