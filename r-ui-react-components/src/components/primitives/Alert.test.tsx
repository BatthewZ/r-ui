import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TONE_LABELS } from "../../util/tone";
import { Alert, DEFAULT_ALERT_LABELS } from "./Alert";
import { Button } from "./Button";

describe("Alert", () => {
  it("error is role=alert and leads with the severity word", () => {
    render(
      <Alert tone="error" title="Payment failed">
        Card declined.
      </Alert>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/^Error: Payment failedCard declined\.$/);
    expect(screen.getByText("Error:", { exact: false })).toHaveClass("sr-only");
  });

  it("serious is an alert; info, success, warning, neutral and stale are status", () => {
    const { rerender } = render(<Alert tone="serious">x</Alert>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    for (const tone of ["info", "success", "warning", "neutral", "stale"] as const) {
      rerender(<Alert tone={tone}>x</Alert>);
      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).toBeNull();
    }
  });

  it("speaks the shared tone word (neutral says nothing), and DEFAULT_ALERT_LABELS is that set", () => {
    const { rerender } = render(<Alert tone="info">Maintenance at 2am</Alert>);
    expect(screen.getByRole("status")).toHaveTextContent(/^Info: Maintenance at 2am$/);
    rerender(<Alert tone="neutral">Maintenance at 2am</Alert>);
    expect(screen.getByRole("status")).toHaveTextContent(/^Maintenance at 2am$/);
    expect(DEFAULT_ALERT_LABELS.tones).toBe(TONE_LABELS);
  });

  it("a static callout can opt out of the live role", () => {
    render(
      <Alert role="note" tone="info">
        Tip
      </Alert>,
    );
    expect(screen.getByRole("note")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("labels.tones overrides or removes the spoken severity", () => {
    const { rerender } = render(
      <Alert tone="warning" labels={{ tones: { warning: "Attention" } }}>
        Quota at 90%
      </Alert>,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/^Attention: Quota at 90%$/);
    rerender(
      <Alert tone="warning" labels={{ tones: { warning: "" } }}>
        Quota at 90%
      </Alert>,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/^Quota at 90%$/);
  });

  it("draws the tone's glyph in its mark colour; icon={null} removes it", () => {
    const { rerender, container } = render(<Alert tone="success">Saved</Alert>);
    const glyph = container.querySelector('[aria-hidden="true"].text-status-success');
    expect(glyph?.querySelector("svg")).not.toBeNull();
    rerender(
      <Alert tone="success" icon={null}>
        Saved
      </Alert>,
    );
    expect(container.querySelector(".text-status-success")).toBeNull();
  });

  it("title uses the tone's text-safe ink, body the primary ink, on the subtle bg", () => {
    render(
      <Alert tone="serious" title="Disk pressure" data-testid="a">
        Node 4
      </Alert>,
    );
    expect(screen.getByTestId("a")).toHaveClass("bg-status-serious-bg");
    expect(screen.getByText("Disk pressure")).toHaveClass("text-fg-serious");
    expect(screen.getByText("Node 4")).toHaveClass("text-fg-primary");
  });

  it("renders actions, and a dismiss button only when onDismiss is given", async () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<Alert actions={<Button>Retry</Button>}>Sync failed</Alert>);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();

    rerender(
      <Alert actions={<Button>Retry</Button>} onDismiss={onDismiss} labels={{ dismiss: "Close message" }}>
        Sync failed
      </Alert>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Close message" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{Enter}");
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});
