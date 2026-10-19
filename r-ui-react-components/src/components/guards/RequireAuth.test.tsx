import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentPropsWithRef, useEffect, useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { RouterProvider } from "../../util/router";
import { type AuthStatus, RequireAuth } from "./RequireAuth";

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

/**
 * An app's gate: status buttons, a sign-in that waits before it succeeds, a
 * session refresh that a timer starts (an update no event flushes), and an
 * admin switch for authorize.
 */
function Gate() {
  const [status, setStatus] = useState<AuthStatus>("unauthenticated");
  const [admin, setAdmin] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <>
      {(["loading", "unauthenticated", "authenticated"] as const).map((s) => (
        <button key={s} type="button" onClick={() => setStatus(s)}>
          {s}
        </button>
      ))}
      <button
        type="button"
        onClick={() => {
          setStatus("loading");
          timer.current = setTimeout(() => setStatus("authenticated"), 30);
        }}
      >
        Simulate sign-in
      </button>
      <button
        type="button"
        onClick={() => {
          timer.current = setTimeout(() => setStatus("loading"), 30);
        }}
      >
        Refresh session
      </button>
      <button type="button" onClick={() => setAdmin((a) => !a)}>
        Toggle admin
      </button>
      <div data-testid="gate" data-status={status}>
        <RequireAuth status={status} authorize={() => admin} signInHref="/sign-in">
          <p data-secret="">Payroll ledger</p>
        </RequireAuth>
      </div>
    </>
  );
}

describe("RequireAuth, watched commit by commit", () => {
  it("no DOM state the gate passes through holds the protected content unless the status is authenticated", async () => {
    const user = userEvent.setup();
    render(<Gate />);
    const gate = screen.getByTestId("gate");
    // Every batch of DOM mutations (one per commit here: each step awaits) is a state the page could paint.
    const states: string[] = [];
    const flashes: string[] = [];
    const record = () => {
      const status = gate.dataset.status;
      const secret = gate.querySelector("[data-secret]") !== null;
      const wait = gate.querySelector('[data-auth-state="loading"] [role="status"]') !== null;
      const entry = `${status}:${secret ? "card" : wait ? "wait" : "other"}`;
      if (states.at(-1) !== entry) states.push(entry);
      if (secret && status !== "authenticated") flashes.push(entry);
    };
    const observer = new MutationObserver(record);
    observer.observe(gate, { subtree: true, childList: true, attributes: true, characterData: true });
    record();

    // Signed out: words and a named link, the icon hidden.
    expect(within(gate).getByText("Sign in to continue")).toBeInTheDocument();
    expect(within(gate).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    expect(within(gate).queryAllByRole("img")).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Simulate sign-in" }));
    expect(within(gate).getByRole("status")).toHaveTextContent("Checking your session…");
    expect(within(gate).queryAllByRole("img")).toEqual([]);
    expect(await within(gate).findByText("Payroll ledger")).toBeInTheDocument();

    // A timer takes it back to loading: React commits that update, then runs its effects, apart.
    await user.click(screen.getByRole("button", { name: "Refresh session" }));
    await waitFor(() => expect(gate.dataset.status).toBe("loading"));
    expect(within(gate).queryByText("Payroll ledger")).toBeNull();
    await user.click(screen.getByRole("button", { name: "authenticated" }));

    // Back to loading while signed in: the card goes in that same commit.
    await user.click(screen.getByRole("button", { name: "loading" }));
    expect(within(gate).queryByText("Payroll ledger")).toBeNull();

    await user.click(screen.getByRole("button", { name: "authenticated" }));
    await user.click(screen.getByRole("button", { name: "Toggle admin" }));
    expect(within(gate).getByText("You don’t have access")).toBeInTheDocument();
    expect(within(gate).queryAllByRole("img")).toEqual([]);
    await user.click(screen.getByRole("button", { name: "unauthenticated" }));
    observer.disconnect();

    expect(flashes).toEqual([]);
    // Positive control: the observer saw the wait, the card, and the states after it.
    expect(states).toEqual([
      "unauthenticated:other",
      "loading:wait",
      "authenticated:card",
      "loading:wait",
      "authenticated:card",
      "loading:wait",
      "authenticated:card",
      "authenticated:other",
      "unauthenticated:other",
    ]);
  });
});
