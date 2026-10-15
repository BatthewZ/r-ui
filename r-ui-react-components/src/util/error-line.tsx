import { CircleAlert } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./style";

/*
 * The look of an error message under a control: a leading alert glyph centred on
 * the first line, then the message in error ink, breaking an unbroken word rather
 * than widening its box. Internal (not re-exported from `util/index`): Field.Error,
 * a TagInput's refusal and a date picker's "not a date" are one look from one place.
 */
export interface ErrorLineProps extends HTMLAttributes<HTMLParagraphElement> {
  /** The leading glyph. Default the alert circle; `null` removes it. */
  icon?: ReactNode;
}

export function ErrorLine({ icon, className, children, ...props }: ErrorLineProps) {
  return (
    <p className={cn("flex items-start gap-r5 text-body-2 text-fg-error", className)} {...props}>
      {icon === undefined ? (
        <span className="flex h-(--BodyText-2-line-height) shrink-0 items-center">
          <CircleAlert aria-hidden className="size-icon text-status-error" />
        </span>
      ) : (
        icon
      )}
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}
