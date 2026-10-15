import type { ComponentPropsWithRef } from "react";

import { cn } from "../../util/style";

export type KbdProps = ComponentPropsWithRef<"kbd">;

/**
 * One key, as a key cap: mono, UI text one step down, a hairline with a firmer
 * bottom edge. Inline, so it sits on the baseline of the text around it. For a
 * chord, write one `Kbd` per key; nest them in an outer `<kbd>` if the chord is
 * one input (`<kbd><Kbd>⌘</Kbd> <Kbd>K</Kbd></kbd>`).
 */
export function Kbd({ className, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-icon items-center justify-center rounded-sm border border-border border-b-border-strong bg-surface-1 px-r6 font-mono text-body-3 font-medium text-fg-secondary",
        className,
      )}
      {...props}
    />
  );
}
