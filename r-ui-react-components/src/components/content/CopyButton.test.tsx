import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CopyButton } from "./CopyButton";

/**
 * jsdom has no clipboard and no `execCommand`; `userEvent.setup()` installs an
 * in-memory `navigator.clipboard`, which is the Clipboard API path. The fallback
 * path is driven by removing that and stubbing `execCommand` at the boundary.
 * Real permission prompts and the system clipboard are a browser check
 * (`content-code.js`).
 */
const status = () => screen.getByRole("status");

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  Reflect.deleteProperty(document, "execCommand");
});

describe("CopyButton", () => {
  it("is an icon-only button named Copy that writes its value and announces it", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    render(<CopyButton value="npm i lowlight" onCopy={onCopy} />);
    const button = screen.getByRole("button", { name: "Copy" });
    expect(button).toHaveClass("hit-area");
    expect(status()).toHaveTextContent(/^$/);

    await user.click(button);

    expect(await navigator.clipboard.readText()).toBe("npm i lowlight");
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledWith("npm i lowlight");
    expect(status()).toHaveTextContent("Copied");
    expect(status()).toHaveAttribute("aria-live", "polite");
    // The live region sits outside the button: one inside would never be read.
    expect(button).not.toContainElement(status());
    // The name stays; the announcement is what tells.
    expect(button).toHaveAccessibleName("Copy");
    expect(button).toHaveAttribute("data-state", "copied");
  });

  it("changes the announcement text on a repeat copy, so it is announced again", async () => {
    const user = userEvent.setup();
    render(<CopyButton value="x" />);
    const button = screen.getByRole("button", { name: "Copy" });
    await user.click(button);
    const first = status().textContent;
    await user.click(button);
    const second = status().textContent;
    expect(first?.trim()).toBe("Copied");
    expect(second?.trim()).toBe("Copied");
    expect(second).not.toBe(first);
  });

  it("returns to idle after resetAfter", async () => {
    // Fake timers and user-event's own delays deadlock, so this one clicks with
    // fireEvent; with no Clipboard API installed it takes the fallback path.
    vi.useFakeTimers();
    Object.defineProperty(document, "execCommand", { value: () => true, configurable: true });
    render(<CopyButton value="x" resetAfter={500} />);
    const button = screen.getByRole("button", { name: "Copy" });
    fireEvent.click(button);
    await act(async () => {});
    expect(button).toHaveAttribute("data-state", "copied");
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(button).toHaveAttribute("data-state", "copied");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(button).toHaveAttribute("data-state", "idle");
    expect(status()).toHaveTextContent(/^$/);
  });

  it("falls back to a selection copy beside the button when the Clipboard API is refused", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
    let copied: string | null = null;
    let host: Element | null = null;
    const execCommand = vi.fn((command: string) => {
      const area = document.querySelector("textarea");
      copied = area ? area.value.slice(area.selectionStart, area.selectionEnd) : null;
      host = area?.parentElement ?? null;
      return command === "copy";
    });
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });
    render(
      <div data-testid="host">
        <CopyButton value="fallback text" />
      </div>,
    );
    const button = screen.getByRole("button", { name: "Copy" });

    await user.click(button);

    expect(execCommand).toHaveBeenCalledTimes(1);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(copied).toBe("fallback text");
    // Next to the button, not on <body>: inside a modal dialog <body> is inert.
    expect(host).toBe(screen.getByTestId("host"));
    expect(document.querySelector("textarea")).toBeNull();
    expect(button).toHaveFocus();
    expect(status()).toHaveTextContent("Copied");
  });

  it("reports and announces a failure when nothing could write", async () => {
    const user = userEvent.setup();
    const error = new DOMException("denied", "NotAllowedError");
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(error);
    Object.defineProperty(document, "execCommand", { value: () => false, configurable: true });
    const onCopy = vi.fn();
    const onCopyError = vi.fn();
    render(<CopyButton value="x" onCopy={onCopy} onCopyError={onCopyError} labels={{ failed: "Nicht kopiert" }} />);
    const button = screen.getByRole("button", { name: "Copy" });

    await user.click(button);

    expect(onCopy).not.toHaveBeenCalled();
    expect(onCopyError).toHaveBeenCalledTimes(1);
    const reported: unknown = onCopyError.mock.calls[0]?.[0];
    expect(reported).toBeInstanceOf(Error);
    expect((reported as Error).message).toContain("denied");
    expect(status()).toHaveTextContent("Nicht kopiert");
    expect(button).toHaveAttribute("data-state", "failed");
  });

  it("with showLabel is a labelled Button whose text swaps without changing its box", async () => {
    const user = userEvent.setup();
    render(<CopyButton value="x" showLabel labels={{ copy: "Copy link", copied: "Link copied" }} />);
    const button = screen.getByRole("button", { name: "Copy link" });
    expect(button).toHaveClass("h-control");
    await user.click(button);
    expect(button).toHaveAccessibleName("Link copied");
    // All labels stay in the DOM (one cell), the inactive ones invisible.
    expect(screen.getByText("Copy link")).toHaveClass("invisible");
  });

  it("does not copy when the caller's onClick prevents it", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<CopyButton value="secret" onClick={(event) => event.preventDefault()} />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).not.toHaveBeenCalled();
    expect(status()).toHaveTextContent(/^$/);
  });

  it("does not update after unmounting mid-write", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    vi.spyOn(navigator.clipboard, "writeText").mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const onCopy = vi.fn();
    const { unmount } = render(<CopyButton value="x" onCopy={onCopy} />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    unmount();
    await act(async () => release());
    // The write did happen, so it is reported; nothing tried to update the gone button.
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
