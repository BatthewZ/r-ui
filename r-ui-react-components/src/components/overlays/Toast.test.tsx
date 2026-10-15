import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubPopover } from "./overlay-stubs.test.helpers";
import { type ToastApi, type ToastProviderProps, ToastProvider, useToast } from "./Toast";

let api: ToastApi;
function Capture() {
  api = useToast();
  return null;
}

function setup(props: Partial<ToastProviderProps> = {}) {
  render(
    <ToastProvider {...props}>
      <Capture />
    </ToastProvider>
  );
  const region = screen.getByRole("region", { name: props.labels?.region ?? "Notifications" });
  const [assertive, polite] = region.querySelectorAll("ol");
  if (!assertive || !polite) throw new Error("both live regions must be mounted");
  return { region, assertive, polite };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ToastProvider + useToast", () => {
  it("mounts both live regions up front, empty", () => {
    const { assertive, polite } = setup();
    expect(assertive).toHaveAttribute("aria-live", "assertive");
    expect(polite).toHaveAttribute("aria-live", "polite");
    expect(assertive).toBeEmptyDOMElement();
    expect(polite).toBeEmptyDOMElement();
  });

  it("routes errors to the assertive region and everything else to the polite one", () => {
    const { assertive, polite } = setup();
    act(() => {
      api.toast({ title: "Saved", tone: "success" });
      api.toast({ title: "Export failed", tone: "error" });
      api.toast({ title: "Heads up" });
    });
    expect(within(assertive).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Error: Export failed"]);
    expect(within(polite).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Success: Saved", "Heads up"]);
  });

  it("names the tone in words for assistive tech; the icon is decorative", () => {
    const { polite } = setup({ labels: { tones: { warning: "Attention" } } });
    act(() => {
      api.toast({ title: "Disk almost full", tone: "warning" });
      api.toast({ title: "Synced", tone: "success" });
    });
    const [warning, success] = within(polite).getAllByRole("listitem");
    // The override replaces one tone's word; the others keep the shared default.
    expect(warning).toHaveTextContent("Attention: Disk almost full");
    expect(success).toHaveTextContent("Success: Synced");
    expect(warning!.querySelector("svg")?.closest("[aria-hidden]")).not.toBeNull();
  });

  it("translates the landmark and the dismiss button through labels", () => {
    setup({ labels: { region: "Benachrichtigungen", dismiss: "Schließen" } });
    act(() => {
      api.toast({ title: "Gespeichert" });
    });
    expect(screen.getByRole("button", { name: "Schließen" })).toBeInTheDocument();
  });

  it("serious, like error, interrupts and stays; stale and accent are polite", () => {
    const { assertive, polite } = setup({ duration: 1000 });
    act(() => {
      api.toast({ title: "Latency high", tone: "serious" });
      api.toast({ title: "Data is an hour old", tone: "stale" });
      api.toast({ title: "Now viewing EU", tone: "accent" });
    });
    expect(within(assertive).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Serious: Latency high"]);
    expect(within(polite).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Stale: Data is an hour old",
      "Current: Now viewing EU",
    ]);
    act(() => vi.advanceTimersByTime(60_000));
    expect(within(assertive).getAllByRole("listitem")).toHaveLength(1);
    expect(within(polite).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("auto-dismisses after its duration", () => {
    const { polite } = setup({ duration: 3000 });
    act(() => {
      api.toast({ title: "Saved" });
    });
    act(() => vi.advanceTimersByTime(2999));
    expect(within(polite).getAllByRole("listitem")).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(within(polite).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("pauses the clock while hovered and resumes with the time that was left", () => {
    const { region, polite } = setup({ duration: 3000 });
    act(() => {
      api.toast({ title: "Saved" });
    });
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.pointerEnter(region);
    act(() => vi.advanceTimersByTime(10_000));
    expect(within(polite).getAllByRole("listitem")).toHaveLength(1);
    fireEvent.pointerLeave(region);
    act(() => vi.advanceTimersByTime(999));
    expect(within(polite).getAllByRole("listitem")).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(within(polite).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("pauses while focus is inside the stack", () => {
    const { polite } = setup({ duration: 3000 });
    act(() => {
      api.toast({ title: "Saved" });
    });
    act(() => screen.getByRole("button", { name: "Dismiss" }).focus());
    act(() => vi.advanceTimersByTime(10_000));
    expect(within(polite).getAllByRole("listitem")).toHaveLength(1);
  });

  it("a toast dismissed from its own button takes the pause with it, so the next one still times out", () => {
    const { polite } = setup({ duration: 3000 });
    act(() => {
      api.toast({ title: "Saved" });
    });
    const dismiss = screen.getByRole("button", { name: "Dismiss" });
    act(() => dismiss.focus());
    fireEvent.click(dismiss);
    expect(within(polite).queryAllByRole("listitem")).toHaveLength(0);
    act(() => {
      api.toast({ title: "Exported" });
    });
    act(() => vi.advanceTimersByTime(2999));
    expect(within(polite).getAllByRole("listitem")).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(within(polite).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("dismissing a toast from its own button moves focus to the next toast's Dismiss", () => {
    render(
      <ToastProvider>
        <Capture />
        <button type="button">Save</button>
      </ToastProvider>
    );
    act(() => {
      api.toast({ title: "One", tone: "error" });
      api.toast({ title: "Two", tone: "error" });
    });
    const [first, second] = screen.getAllByRole("listitem");
    const firstDismiss = within(first!).getByRole("button", { name: "Dismiss" });
    act(() => firstDismiss.focus());
    fireEvent.click(firstDismiss);
    expect(within(second!).getByRole("button", { name: "Dismiss" })).toHaveFocus();
  });

  it("dismissing the last toast from its own button returns focus to where it was, and the clocks run again", () => {
    render(
      <ToastProvider duration={3000}>
        <Capture />
        <button type="button">Save</button>
      </ToastProvider>
    );
    const save = screen.getByRole("button", { name: "Save" });
    act(() => save.focus());
    act(() => {
      api.toast({ title: "Saved", tone: "error" });
    });
    const dismiss = screen.getByRole("button", { name: "Dismiss" });
    act(() => dismiss.focus());
    fireEvent.click(dismiss);
    expect(save).toHaveFocus();
    act(() => {
      api.toast({ title: "Exported" });
    });
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("dismiss(id) on the toast holding focus hands focus on too", () => {
    render(
      <ToastProvider>
        <Capture />
        <button type="button">Save</button>
      </ToastProvider>
    );
    const save = screen.getByRole("button", { name: "Save" });
    act(() => save.focus());
    let id = "";
    act(() => {
      id = api.toast({ title: "Archived", action: { label: "Undo", onClick: () => {} } });
    });
    act(() => screen.getByRole("button", { name: "Undo" }).focus());
    act(() => api.dismiss(id));
    expect(save).toHaveFocus();
  });

  it("errors and toasts with an action stay until dismissed", () => {
    const { assertive, polite } = setup({ duration: 1000 });
    act(() => {
      api.toast({ title: "Failed", tone: "error" });
      api.toast({ title: "Archived", action: { label: "Undo", onClick: () => {} } });
    });
    act(() => vi.advanceTimersByTime(60_000));
    expect(within(assertive).getAllByRole("listitem")).toHaveLength(1);
    expect(within(polite).getAllByRole("listitem")).toHaveLength(1);
  });

  it("the action runs once and dismisses the toast", () => {
    const onUndo = vi.fn();
    const { polite } = setup();
    act(() => {
      api.toast({ title: "Archived", action: { label: "Undo", onClick: onUndo } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(within(polite).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("the dismiss button and dismiss(id) remove a toast", () => {
    const { polite } = setup();
    let id = "";
    act(() => {
      api.toast({ title: "One" });
      id = api.toast({ title: "Two" });
    });
    fireEvent.click(within(within(polite).getAllByRole("listitem")[0]!).getByRole("button", { name: "Dismiss" }));
    expect(within(polite).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Two"]);
    act(() => api.dismiss(id));
    expect(within(polite).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("re-using an id replaces the toast in place", () => {
    const { polite } = setup();
    act(() => {
      api.toast({ id: "upload", title: "Uploading…" });
    });
    act(() => {
      api.toast({ id: "upload", title: "Uploaded", tone: "success" });
    });
    expect(within(polite).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Success: Uploaded"]);
  });

  it("keeps at most `max`, the oldest leaving first", () => {
    const { polite } = setup({ max: 2 });
    act(() => {
      api.toast({ title: "A" });
      api.toast({ title: "B" });
      api.toast({ title: "C" });
    });
    expect(within(polite).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["B", "C"]);
  });

  it("stacks newest nearest the corner's edge", () => {
    const { polite } = setup({ position: "top-end" });
    act(() => {
      api.toast({ title: "First" });
      api.toast({ title: "Second" });
    });
    expect(within(polite).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Second", "First"]);
  });

  it("useToast outside a provider throws a clear error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Capture />)).toThrow("useToast must be used inside <ToastProvider>");
  });

  it("promotes the stack to the top layer and raises it again when a toast arrives", () => {
    const popover = stubPopover();
    try {
      render(
        <ToastProvider>
          <Capture />
        </ToastProvider>
      );
      // A promoted element is display:none to jsdom (it never matches :popover-open).
      const region = document.querySelector<HTMLElement>('section[aria-label="Notifications"]');
      expect(region).toHaveAttribute("popover", "manual");
      expect(popover.show).toHaveBeenCalledTimes(1);
      act(() => {
        api.toast({ title: "Saved" });
      });
      // jsdom never matches :popover-open, so each arrival is a fresh show.
      expect(popover.show).toHaveBeenCalledTimes(2);
      expect(popover.show.mock.contexts[1]).toBe(region);
    } finally {
      popover.restore();
    }
  });
});
