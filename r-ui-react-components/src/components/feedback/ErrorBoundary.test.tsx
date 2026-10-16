import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { ErrorBoundary, ErrorFallback, errorText } from "./ErrorBoundary";

// React reports every error a boundary catches to console.error; keep the run
// readable. The spy only quiets the log: every assertion is about the DOM.
let consoleError: MockInstance;
beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => consoleError.mockRestore());

/** Throws while `failing` says so: the stand-in for a widget with bad data. */
function Widget({ name, failing }: { name: string; failing: () => boolean }) {
  if (failing()) throw new Error(`${name} exploded`);
  return <p>{name} ok</p>;
}

describe("ErrorBoundary", () => {
  it("contains a throw: the fallback replaces only that part, siblings still render, onError hears it once", () => {
    const onError = vi.fn();
    render(
      <div>
        <ErrorBoundary onError={onError}>
          <Widget name="Revenue" failing={() => true} />
        </ErrorBoundary>
        <ErrorBoundary>
          <Widget name="Orders" failing={() => false} />
        </ErrorBoundary>
      </div>,
    );
    expect(screen.getByText("Orders ok")).toBeInTheDocument();
    expect(screen.queryByText("Revenue ok")).toBeNull();
    const fallback = screen.getByRole("alert", { name: "Something went wrong" });
    expect(fallback).toHaveTextContent("This part of the page could not be shown.");
    expect(onError).toHaveBeenCalledTimes(1);
    const [error, info] = onError.mock.calls[0]!;
    expect((error as Error).message).toBe("Revenue exploded");
    expect(info).toHaveProperty("componentStack");
  });

  it("Try again renders the children afresh; onReset runs first, with the reason", async () => {
    let broken = true;
    const onReset = vi.fn(() => {
      broken = false;
    });
    render(
      <ErrorBoundary onReset={onReset}>
        <Widget name="Chart" failing={() => broken} />
      </ErrorBoundary>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledWith("retry");
    expect(screen.getByText("Chart ok")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a retry that fails again brings the fallback back with focus on Try again", async () => {
    let attempts = 0;
    render(
      <ErrorBoundary onReset={() => (attempts += 1)}>
        <Widget name="Map" failing={() => attempts < 2} />
      </ErrorBoundary>,
    );
    const first = screen.getByRole("button", { name: "Try again" });
    expect(first).not.toHaveFocus();
    await userEvent.click(first);
    const second = screen.getByRole("button", { name: "Try again" });
    expect(second).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByText("Map ok")).toBeInTheDocument();
  });

  it("a change of resetKeys clears the error; the same keys do not", () => {
    let broken = true;
    const onReset = vi.fn();
    const { rerender } = render(
      <ErrorBoundary resetKeys={["eu"]} onReset={onReset}>
        <Widget name="Region" failing={() => broken} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    broken = false;
    rerender(
      <ErrorBoundary resetKeys={["eu"]} onReset={onReset}>
        <Widget name="Region" failing={() => broken} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onReset).not.toHaveBeenCalled();
    rerender(
      <ErrorBoundary resetKeys={["us"]} onReset={onReset}>
        <Widget name="Region" failing={() => broken} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Region ok")).toBeInTheDocument();
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledWith("resetKeys");
  });

  it("keys that change in the very update that throws do not clear it at once", async () => {
    const onReset = vi.fn();
    const onError = vi.fn();
    function Host() {
      const [region, setRegion] = useState("eu");
      return (
        <>
          <button type="button" onClick={() => setRegion("us")}>
            Switch
          </button>
          <ErrorBoundary resetKeys={[region]} onReset={onReset} onError={onError}>
            <Widget name="Region" failing={() => region === "us"} />
          </ErrorBoundary>
        </>
      );
    }
    render(<Host />);
    expect(screen.getByText("Region ok")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Switch" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    // Cleared at once, it would reset and throw a second time.
    expect(onReset).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("a thrown non-Error (even undefined) still trips it", () => {
    function ThrowsUndefined(): never {
      throw undefined;
    }
    render(
      <ErrorBoundary>
        <ThrowsUndefined />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("a custom fallback gets the error and reset", async () => {
    let broken = true;
    render(
      <ErrorBoundary
        fallback={({ error, reset }) => (
          <button
            type="button"
            onClick={() => {
              broken = false;
              reset();
            }}
          >
            Reload {(error as Error).message}
          </button>
        )}
      >
        <Widget name="Feed" failing={() => broken} />
      </ErrorBoundary>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Reload Feed exploded" }));
    expect(screen.getByText("Feed ok")).toBeInTheDocument();
  });

  it("details shows the error text in a named, focusable block; off by default", async () => {
    const { rerender } = render(
      <ErrorBoundary>
        <Widget name="Table" failing={() => true} />
      </ErrorBoundary>,
    );
    expect(screen.queryByText("Error details")).toBeNull();
    rerender(
      <ErrorBoundary details>
        <Widget name="Table" failing={() => true} />
      </ErrorBoundary>,
    );
    await userEvent.click(screen.getByText("Error details"));
    const block = screen.getByLabelText("Error details");
    expect(block.tagName).toBe("PRE");
    expect(block).toHaveAttribute("tabindex", "0");
    expect(block.textContent).toContain("Table exploded");
  });

  it("labels reach the default fallback from the provider and the boundary", () => {
    render(
      <LocaleProvider labels={{ ErrorFallback: { title: "Une erreur est survenue", retry: "Réessayer" } }}>
        <ErrorBoundary labels={{ retry: "Encore" }}>
          <Widget name="KPI" failing={() => true} />
        </ErrorBoundary>
      </LocaleProvider>,
    );
    expect(screen.getByRole("alert", { name: "Une erreur est survenue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Encore" })).toBeInTheDocument();
  });
});

describe("ErrorFallback", () => {
  it("stands alone for a failure that was never thrown: no retry without onRetry, children replace the message", () => {
    render(<ErrorFallback className="mt-r3">The server answered 500.</ErrorFallback>);
    const fallback = screen.getByRole("alert", { name: "Something went wrong" });
    expect(fallback).toHaveClass("mt-r3");
    expect(fallback).toHaveTextContent("The server answered 500.");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("the retry button is screen-only", () => {
    render(<ErrorFallback onRetry={() => {}} />);
    expect(screen.getByRole("button", { name: "Try again" })).toHaveAttribute("data-print", "hide");
  });
});

describe("errorText", () => {
  it("reads an Error's stack once, a string as itself, and survives a hostile object", () => {
    const error = new TypeError("bad input");
    expect(errorText(error)).toContain("bad input");
    expect(errorText(error).split("bad input")).toHaveLength(2);
    const noStack = new Error("plain");
    noStack.stack = undefined;
    expect(errorText(noStack)).toBe("Error: plain");
    expect(errorText("just text")).toBe("just text");
    expect(errorText(Object.create(null))).toBe("[object Object]");
  });
});
