import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SectionBoundary } from "./SectionBoundary";

let failing = true;
function Demo() {
  if (failing) throw new Error("bad fixture");
  return <p>demo ok</p>;
}

function Page() {
  return (
    <>
      <SectionBoundary title="Broken demo">
        <Demo />
      </SectionBoundary>
      <p>sibling ok</p>
    </>
  );
}

beforeEach(() => {
  failing = true;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("SectionBoundary (the library's ErrorBoundary, dogfooded)", () => {
  it("marks the tripped section for the browser checks, names it, and keeps its siblings", () => {
    const { container } = render(<Page />);
    const tripped = container.querySelectorAll("[data-section-error]");
    expect(tripped).toHaveLength(1);
    expect(tripped[0]).toHaveAttribute("data-section-error", "Broken demo");
    expect(screen.getByRole("alert", { name: "Something went wrong" })).toHaveTextContent("“Broken demo” failed to render: bad fixture");
    expect(screen.getByText("sibling ok")).toBeInTheDocument();
    const reports = vi.mocked(console.error).mock.calls.filter(([first]) => String(first).startsWith("showcase:"));
    expect(reports).toHaveLength(1);
    expect(reports[0]![0]).toBe('showcase: the "Broken demo" section threw');
  });

  it("renders the section again on Try again", async () => {
    const { container } = render(<Page />);
    failing = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("demo ok")).toBeInTheDocument();
    expect(container.querySelector("[data-section-error]")).toBeNull();
  });
});
