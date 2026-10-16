import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { RouterProvider } from "../../util/router";
import { RequireAuth } from "./RequireAuth";

const SECRET = <p>Payroll ledger</p>;

describe("RequireAuth", () => {
  it("while loading renders a status and never the protected content", () => {
    render(<RequireAuth status="loading">{SECRET}</RequireAuth>);
    expect(screen.getByRole("status")).toHaveTextContent("Checking your session…");
    expect(screen.queryByText("Payroll ledger")).toBeNull();
  });

  it("does not ask authorize until signed in", () => {
    const authorize = vi.fn(() => true);
    const { rerender } = render(
      <RequireAuth status="loading" authorize={authorize}>
        {SECRET}
      </RequireAuth>,
    );
    rerender(
      <RequireAuth status="unauthenticated" authorize={authorize}>
        {SECRET}
      </RequireAuth>,
    );
    expect(authorize).not.toHaveBeenCalled();
    rerender(
      <RequireAuth status="authenticated" authorize={authorize}>
        {SECRET}
      </RequireAuth>,
    );
    expect(authorize).toHaveBeenCalled();
    expect(screen.getByText("Payroll ledger")).toBeInTheDocument();
  });

  it("renders children unwrapped once authenticated, and drops them when the status goes back to loading", () => {
    const { container, rerender } = render(<RequireAuth status="authenticated">{SECRET}</RequireAuth>);
    expect(container.firstElementChild?.tagName).toBe("P");
    rerender(<RequireAuth status="loading">{SECRET}</RequireAuth>);
    expect(screen.queryByText("Payroll ledger")).toBeNull();
  });

  it("an unknown status is treated as a wait, not as access", () => {
    // A status from an untyped auth hook (or a newer library) must not open the gate.
    const status = "refreshing" as unknown as "loading";
    render(<RequireAuth status={status}>{SECRET}</RequireAuth>);
    expect(screen.queryByText("Payroll ledger")).toBeNull();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("refused by authorize: the forbidden fallback, or the caller's", () => {
    const { rerender } = render(
      <RequireAuth status="authenticated" authorize={() => false}>
        {SECRET}
      </RequireAuth>,
    );
    expect(screen.getByText("You don’t have access")).toBeInTheDocument();
    expect(screen.queryByText("Payroll ledger")).toBeNull();
    rerender(
      <RequireAuth status="authenticated" authorize={() => false} forbiddenFallback={<p>Ask finance</p>}>
        {SECRET}
      </RequireAuth>,
    );
    expect(screen.getByText("Ask finance")).toBeInTheDocument();
  });

  it("signed out: a sign-in link through the router's link", () => {
    function AppLink(props: ComponentPropsWithRef<"a">) {
      return <a data-app-link="" {...props} />;
    }
    render(
      <RouterProvider link={AppLink}>
        <RequireAuth status="unauthenticated" signInHref="/sign-in" className="min-h-row">
          {SECRET}
        </RequireAuth>
      </RouterProvider>,
    );
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link).toHaveAttribute("href", "/sign-in");
    expect(link).toHaveAttribute("data-app-link");
    expect(link.closest("[data-auth-state]")).toHaveClass("min-h-row");
    expect(screen.queryByText("Payroll ledger")).toBeNull();
  });

  it("calls onUnauthenticated once per arrival, not once per render", () => {
    const onUnauthenticated = vi.fn();
    const view = (status: "loading" | "authenticated" | "unauthenticated", label?: string) => (
      <RequireAuth status={status} onUnauthenticated={onUnauthenticated} labels={label ? { signIn: label } : undefined}>
        {SECRET}
      </RequireAuth>
    );
    const { rerender } = render(view("loading"));
    expect(onUnauthenticated).not.toHaveBeenCalled();
    rerender(view("unauthenticated"));
    rerender(view("unauthenticated", "Log in"));
    rerender(view("unauthenticated", "Anmelden"));
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    rerender(view("authenticated"));
    rerender(view("unauthenticated"));
    expect(onUnauthenticated).toHaveBeenCalledTimes(2);
  });

  it("takes custom fallbacks over the defaults", () => {
    const { rerender } = render(
      <RequireAuth status="loading" loadingFallback={<p>Mine</p>}>
        {SECRET}
      </RequireAuth>,
    );
    expect(screen.getByText("Mine")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
    rerender(
      <RequireAuth status="unauthenticated" unauthenticatedFallback={<p>Go away</p>}>
        {SECRET}
      </RequireAuth>,
    );
    expect(screen.getByText("Go away")).toBeInTheDocument();
  });

  it("takes words from the LocaleProvider", () => {
    render(
      <LocaleProvider labels={{ RequireAuth: { loading: "Sitzung wird geprüft…" } }}>
        <RequireAuth status="loading">{SECRET}</RequireAuth>
      </LocaleProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Sitzung wird geprüft…");
  });
});
