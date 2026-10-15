/**
 * Per-test stand-ins for the platform pieces jsdom lacks: `showPopover` /
 * `hidePopover` and `HTMLDialogElement.showModal` / `close`.
 *
 * Install them per test, never globally: jsdom's real lack of them is also the
 * shipped feature-detect branch (panels stay in place, absolutely positioned;
 * a dialog opens non-modally), and the rest of the suite runs against that.
 *
 * jsdom applies `[popover]:not(:popover-open) { display: none }` and never
 * matches `:popover-open`, so a "promoted" panel is display:none here: query it
 * with `{ hidden: true }` or by selector.
 */
import { vi } from "vitest";

export function stubPopover() {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  const show = vi.fn(function (this: HTMLElement) {
    this.dataset.testPopoverOpen = "";
  });
  const hide = vi.fn(function (this: HTMLElement) {
    delete this.dataset.testPopoverOpen;
  });
  proto.showPopover = show;
  proto.hidePopover = hide;
  return {
    show,
    hide,
    restore() {
      delete proto.showPopover;
      delete proto.hidePopover;
    },
  };
}

export function stubDialog() {
  const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
  const showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  const close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
  proto.showModal = showModal;
  proto.close = close;
  return {
    showModal,
    close,
    restore() {
      delete proto.showModal;
      delete proto.close;
    },
  };
}
