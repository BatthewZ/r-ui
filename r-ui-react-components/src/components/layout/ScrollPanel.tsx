import type { ComponentPropsWithRef } from "react";

import { cn } from "../../util/style";

export type ScrollPanelProps = ComponentPropsWithRef<"div">;

/**
 * A bounded column whose body alone scrolls, with a footer (an action row)
 * beneath the scroller rather than inside it, so the scrollbar stops at the
 * footer's edge. Use it for a boxed region with actions: a settings panel, a
 * side sheet's form. A long form in the page's own scroll keeps
 * `FormActions sticky` instead, and a table keeps its sticky head inside its
 * scroller.
 *
 * The panel draws nothing: bound its height (`max-h-…`, or a definite height
 * from its parent) and give it a box (`rounded-md border bg-surface-0`) where
 * it needs one. Wrapping a form, put the `Form` around the panel, so the body's
 * fields and the footer's submit share it. A body with nothing focusable in it
 * takes `tabIndex={0}`, `role="region"` and an `aria-label`, so the keyboard
 * can scroll it.
 */
function ScrollPanelRoot({ className, ...props }: ScrollPanelProps) {
  return <div data-print="flow" className={cn("flex min-h-0 min-w-0 flex-col", className)} {...props} />;
}

/** The scroller. Its padding is room for the focus rings it would otherwise clip. */
function ScrollPanelBody({ className, ...props }: ComponentPropsWithRef<"div">) {
  return <div data-print="flow" className={cn("min-h-0 flex-1 overflow-y-auto p-r3", className)} {...props} />;
}

/** Stays below the scroller, on a hairline. Holds `FormActions`, or any row of controls. */
function ScrollPanelFooter({ className, ...props }: ComponentPropsWithRef<"div">) {
  return <div className={cn("shrink-0 border-t border-border px-r3 py-r4", className)} {...props} />;
}

/** Compound panel: `ScrollPanel.Body` (scrolls) and `ScrollPanel.Footer` (does not). */
export const ScrollPanel = Object.assign(ScrollPanelRoot, { Body: ScrollPanelBody, Footer: ScrollPanelFooter });
