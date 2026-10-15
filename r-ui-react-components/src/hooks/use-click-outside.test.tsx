import { fireEvent,render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { useClickOutside } from "./use-click-outside";

function TestComponent({
  handler,
  enabled = true,
}: {
  handler: () => void;
  enabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, handler, enabled);
  return (
    <div>
      <div ref={ref} data-testid="inside">
        Inside
      </div>
      <div data-testid="outside">Outside</div>
    </div>
  );
}

describe("useClickOutside", () => {
  it("calls handler when clicking outside the ref element", () => {
    const handler = vi.fn();
    render(<TestComponent handler={handler} />);

    fireEvent.mouseDown(screen.getByTestId("outside"));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not call handler when clicking inside the ref element", () => {
    const handler = vi.fn();
    render(<TestComponent handler={handler} />);

    fireEvent.mouseDown(screen.getByTestId("inside"));

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not call handler when enabled is false", () => {
    const handler = vi.fn();
    render(<TestComponent handler={handler} enabled={false} />);

    fireEvent.mouseDown(screen.getByTestId("outside"));

    expect(handler).not.toHaveBeenCalled();
  });

  /**
   * The ref is the caller's and outlives the component, still pointing at a
   * live element, so the listener's own `!ref.current` bail-out cannot hide a
   * listener left behind: only removing it keeps the handler silent.
   */
  it("removes both listeners on unmount", () => {
    const handler = vi.fn();
    const target = document.createElement("div");
    document.body.append(target);
    const ref = { current: target };
    function Hooked() {
      useClickOutside(ref, handler);
      return null;
    }
    const { unmount } = render(<Hooked />);
    fireEvent.mouseDown(document.body);
    expect(handler).toHaveBeenCalledTimes(1);

    unmount();
    fireEvent.mouseDown(document.body);
    fireEvent.touchStart(document.body);

    expect(handler).toHaveBeenCalledTimes(1);
    target.remove();
  });
});
