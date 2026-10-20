/**
 * Helpers every renderer test shares. Not shipped.
 */

import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { createElement, type ReactElement, type ReactNode, useEffect } from "react";
import { expect, vi } from "vitest";

import { type FoundDiagnostic, findDiagnostics } from "./src/diagnostics";

/**
 * Renders a tree in which a node is expected to throw, without React's error
 * dump. The silence is scoped to this call: a boundary catch anywhere else is
 * unexpected and stays as loud as React makes it. Catching nothing fails, so
 * the name cannot go stale when a case stops throwing.
 */
export function renderThrowing(ui: ReactElement, options?: Omit<RenderOptions, "onCaughtError">): RenderResult {
  let caught = 0;
  const result = render(ui, {
    ...options,
    onCaughtError: () => {
      caught += 1;
    },
  });
  expect(caught, "expected a node error boundary to catch, but nothing threw").toBeGreaterThan(0);
  return result;
}

/**
 * Every diagnostic in the document, hidden ones included. Always the whole
 * body: a check that stands for "nothing went wrong" must not miss what
 * renders outside the tree `render()` returned.
 */
export function queryDiagnostics(): FoundDiagnostic[] {
  return findDiagnostics(document.body);
}

export interface MountCounts {
  mounts: number;
  unmounts: number;
  renders: number;
}

/**
 * A component that counts its mounts, unmounts and renders per `probeId`, for
 * "an arriving sibling never remounts the ones before it". Register `Probe`
 * under a name with `extendRegistry` and render documents that use it.
 */
export function createMountProbe() {
  const counts = new Map<string, MountCounts>();
  const countsFor = (id: string): MountCounts => {
    let entry = counts.get(id);
    if (entry === undefined) {
      entry = { mounts: 0, unmounts: 0, renders: 0 };
      counts.set(id, entry);
    }
    return entry;
  };

  function Probe({ probeId, children }: { probeId: string; children?: ReactNode }) {
    countsFor(probeId).renders += 1;
    useEffect(() => {
      countsFor(probeId).mounts += 1;
      return () => {
        countsFor(probeId).unmounts += 1;
      };
    }, [probeId]);
    return createElement("div", { "data-probe": probeId }, children);
  }

  return {
    Probe,
    /** The counts for `id`, zero when it never rendered. */
    counts: (id: string): MountCounts => ({ ...countsFor(id) }),
    ids: (): string[] => [...counts.keys()],
  };
}

/**
 * Per-test stand-ins for `showPopover`/`hidePopover`, which jsdom lacks. Never
 * global: their absence is also the library's shipped feature-detect branch.
 * jsdom never matches `:popover-open`, so a promoted panel is display:none
 * here; query it with `{ hidden: true }` or by selector.
 */
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

/**
 * Per-test stand-ins for `HTMLDialogElement.showModal`/`close`. A dialog's
 * children are in the DOM whether or not it is open: assert `open`, not text.
 */
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
