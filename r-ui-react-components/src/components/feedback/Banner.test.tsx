import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { Banner, type BannerStorage } from "./Banner";

/** A store in memory, with a call log, for the persistence tests. */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => void data.set(key, value)),
  } satisfies BannerStorage & { data: Map<string, string> };
}

afterEach(() => localStorage.clear());

describe("Banner", () => {
  it("is a region named by its title, not a live region, and leads with the hidden tone word", () => {
    render(
      <Banner tone="warning" title="Maintenance on Sunday">
        The API is read-only from 02:00 to 03:00 UTC.
      </Banner>,
    );
    const banner = screen.getByRole("region", { name: "Maintenance on Sunday" });
    expect(banner).toHaveTextContent(/^Warning: Maintenance on SundayThe API is read-only/);
    expect(screen.getByText("Warning:", { exact: false })).toHaveClass("sr-only");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("without a title it is named by the region label; a caller's aria-label wins over both", () => {
    const { rerender } = render(<Banner>New dashboards are here.</Banner>);
    expect(screen.getByRole("region", { name: "Announcement" })).toBeInTheDocument();
    rerender(
      <Banner title="Trial ends soon" aria-label="Billing notice">
        3 days left.
      </Banner>,
    );
    expect(screen.getByRole("region", { name: "Billing notice" })).toBeInTheDocument();
  });

  it("urgent is role=alert", () => {
    render(
      <Banner tone="error" urgent title="Checkout is down">
        We are on it.
      </Banner>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/^Error: Checkout is down/);
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("is not dismissible without onDismiss or dismissKey", () => {
    render(<Banner title="Read me">Body</Banner>);
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });

  it("dismiss hides it and calls onDismiss exactly once", async () => {
    const onDismiss = vi.fn();
    render(
      <Banner title="New feature" onDismiss={onDismiss}>
        Try it.
      </Banner>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("region")).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("with dismissKey the dismissal is stored and a remounted banner stays hidden", async () => {
    const { unmount } = render(
      <Banner title="Maintenance" dismissKey="app:banner:maint-1">
        Sunday.
      </Banner>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(localStorage.getItem("app:banner:maint-1")).toBe("dismissed");
    unmount();
    render(
      <>
        <Banner title="Maintenance" dismissKey="app:banner:maint-1">
          Sunday.
        </Banner>
        <Banner title="Another" dismissKey="app:banner:maint-2">
          Other key.
        </Banner>
      </>,
    );
    expect(screen.queryByRole("region", { name: "Maintenance" })).toBeNull();
    expect(screen.getByRole("region", { name: "Another" })).toBeInTheDocument();
  });

  it("a storage adapter is read and written under the exact key", async () => {
    const storage = memoryStorage({ seen: "dismissed" });
    const { rerender } = render(
      <Banner title="Seen" dismissKey="seen" storage={storage}>
        x
      </Banner>,
    );
    expect(screen.queryByRole("region")).toBeNull();
    rerender(
      <Banner title="Fresh" dismissKey="fresh" storage={storage}>
        x
      </Banner>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith("fresh", "dismissed");
    expect(localStorage.length).toBe(0);
  });

  it("a store that throws on read leaves it showing; one that throws on write still dismisses", async () => {
    const onDismiss = vi.fn();
    const broken: BannerStorage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    render(
      <Banner title="Blocked store" dismissKey="k" storage={broken} onDismiss={onDismiss}>
        x
      </Banner>,
    );
    expect(screen.getByRole("region", { name: "Blocked store" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("region")).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("storage={null} remembers nothing", async () => {
    render(
      <Banner title="Ephemeral" dismissKey="eph" storage={null}>
        x
      </Banner>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(localStorage.getItem("eph")).toBeNull();
  });

  it("follows a dismissal made in another tab (a storage event for its key)", () => {
    render(
      <Banner title="Shared" dismissKey="shared-key">
        x
      </Banner>,
    );
    expect(screen.getByRole("region", { name: "Shared" })).toBeInTheDocument();
    localStorage.setItem("shared-key", "dismissed");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "shared-key", newValue: "dismissed" }));
    });
    expect(screen.queryByRole("region", { name: "Shared" })).toBeNull();
  });

  it("placement top is an edge band, inline a box; sticky takes the sticky layer and prints in the flow", () => {
    const { rerender } = render(<Banner placement="top" title="Top" />);
    let banner = screen.getByRole("region");
    expect(banner).toHaveClass("border-b");
    expect(banner).not.toHaveClass("rounded-md");
    expect(banner).not.toHaveClass("sticky");
    rerender(<Banner title="Inline" sticky />);
    banner = screen.getByRole("region");
    expect(banner).toHaveClass("rounded-md", "border", "sticky", "top-0", "z-sticky");
    expect(banner).toHaveAttribute("data-print", "flow");
  });

  it("actions and the dismiss button are screen-only", () => {
    render(
      <Banner title="Upgrade" actions={<a href="#plans">See plans</a>} onDismiss={() => {}}>
        x
      </Banner>,
    );
    expect(screen.getByRole("link", { name: "See plans" }).parentElement).toHaveAttribute("data-print", "hide");
    expect(screen.getByRole("button", { name: "Dismiss" })).toHaveAttribute("data-print", "hide");
  });

  it("labels come from the provider and the instance; icon={null} removes the glyph", () => {
    const { container } = render(
      <LocaleProvider labels={{ Banner: { dismiss: "Fermer", region: "Annonce", tones: { info: "Information" } } }}>
        <Banner icon={null} onDismiss={() => {}}>
          Nouveau.
        </Banner>
      </LocaleProvider>,
    );
    const banner = screen.getByRole("region", { name: "Annonce" });
    expect(banner).toHaveTextContent(/^Information: Nouveau\.$/);
    expect(screen.getByRole("button", { name: "Fermer" })).toBeInTheDocument();
    expect(container.querySelector(".text-status-info")).toBeNull();
  });
});
