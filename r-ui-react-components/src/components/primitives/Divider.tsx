import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn, type SlotClassNames } from "../../util/style";

export type DividerProps =
  | ({
      orientation?: "horizontal";
      /** A short label centred on the rule ("or", a date). Read as ordinary text. */
      children?: ReactNode;
      classNames?: SlotClassNames<"line" | "label">;
    } & Omit<ComponentPropsWithRef<"div">, "children">)
  | ({ orientation: "vertical"; children?: never; classNames?: never } & Omit<ComponentPropsWithRef<"div">, "children">);

/**
 * A hairline in `--C-BORDER`. It adds no margin of its own: space it with the
 * parent's `gap`, like everything else.
 *
 * - horizontal, unlabelled: `role="separator"` (thematic break).
 * - vertical: `role="separator"` + `aria-orientation`, stretched to the row.
 * - labelled: two decorative lines around real text, with no separator role,
 *   because a separator's children are presentational and the label would be
 *   lost to assistive tech.
 */
export function Divider(props: DividerProps) {
  if (props.orientation === "vertical") {
    const { orientation, className, ...rest } = props;
    return (
      <div
        role="separator"
        aria-orientation={orientation}
        className={cn("w-px shrink-0 self-stretch bg-border", className)}
        {...rest}
      />
    );
  }

  const { orientation: _orientation, children, classNames, className, ...rest } = props;
  if (children == null || children === false) {
    return <div role="separator" className={cn("h-px w-full shrink-0 bg-border", className)} {...rest} />;
  }
  const line = cn("h-px min-w-r2 flex-1 bg-border", classNames?.line);
  return (
    <div className={cn("flex w-full items-center gap-r4 text-body-3 text-fg-muted", className)} {...rest}>
      <span className={line} aria-hidden />
      <span className={cn("shrink-0", classNames?.label)}>{children}</span>
      <span className={line} aria-hidden />
    </div>
  );
}
