import type { ComponentPropsWithRef } from "react";

import { cn, type SlotClassNames } from "../../util/style";

export type DisclosurePanelProps = ComponentPropsWithRef<"div"> & {
  /**
   * `body` is the padded box inside the clip. The inset cannot sit on the outer
   * element: it collapses to zero height when closed, and its padding would not.
   */
  classNames?: SlotClassNames<"body">;
};

/**
 * The region a trigger shows and hides, shared by `Collapsible` and `Accordion`.
 *
 * Height animates in CSS (the group's styles.css): the outer box transitions
 * `grid-template-rows` between `0fr` and `1fr`, the clip inside hides what has
 * not arrived yet. Closed, the content is `inert` (out of the tab order and the
 * accessibility tree; the clip only hides it from the eye) and, once collapsed,
 * `visibility: hidden`. Always mounted, so state inside it survives a close and
 * there is something to animate.
 */
export function DisclosurePanel({
  open,
  className,
  classNames,
  children,
  ...props
}: DisclosurePanelProps & { open: boolean }) {
  return (
    <div
      data-state={open ? "open" : "closed"}
      inert={!open}
      {...props}
      className={cn("r-disclosure-panel", className)}
    >
      <div className="r-disclosure-clip">
        <div className={cn("pb-r3", classNames?.body)}>{children}</div>
      </div>
    </div>
  );
}
