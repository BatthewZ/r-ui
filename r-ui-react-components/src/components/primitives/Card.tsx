import { Children, type ComponentPropsWithRef, isValidElement, type ReactNode } from "react";

import { cn } from "../../util/style";

export type CardProps = ComponentPropsWithRef<"div">;

/**
 * A raised region: surface 0, a hairline border, no shadow (depth is for
 * floating layers). The card is a size container (`@container`), so its parts
 * and anything inside adapt to the CARD's width, not the viewport's.
 *
 * Density: put `data-density="compact"` on the card itself (or any ancestor);
 * every spacing, type and control token re-derives inside it.
 *
 * Layout is a column with `r3` between parts and `r2` around them; the parts
 * carry the inline padding, so `Card.Footer`'s hairline runs edge to edge, and
 * the footer sits at the bottom of a card stretched by its grid row.
 * With no parts, pad the content yourself (`className="p-r2"`).
 */
function CardRoot({ className, ...props }: CardProps) {
  return (
    <div
      data-print="avoid-break"
      className={cn(
        "@container flex min-w-0 flex-col gap-r3 rounded-lg border border-border bg-surface-0 py-r2 text-fg-primary",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The header's text (title, description and any other child, in order) goes
 * down the start; `Card.Actions` sit on the end, top-aligned. The actions drop
 * under the text only when they do not fit beside it while the text keeps
 * `--COLUMN-SM`, so a short link stays beside its title in a narrow card and a
 * long control row wraps rather than squeezing the title. Write the parts as
 * direct children, in any order: `Card.Actions` is picked out by type.
 */
function CardHeader({ className, children, ...props }: ComponentPropsWithRef<"div">) {
  const parts = Children.toArray(children);
  const actions = parts.filter(isActions);
  const text = parts.filter((part) => !isActions(part));
  return (
    <div
      className={cn("flex flex-wrap items-start gap-x-r3 gap-y-r4 px-r2", text.length === 0 && "justify-end", className)}
      {...props}
    >
      {text.length > 0 && <div className="flex min-w-0 grow basis-column-sm flex-col">{text}</div>}
      {actions}
    </div>
  );
}

const isActions = (node: ReactNode) => isValidElement(node) && node.type === CardActions;

export type CardTitleProps = {
  /** The heading level that fits the page outline. The look is the same at every level. */
  as?: "h2" | "h3" | "h4" | "h5" | "h6";
} & ComponentPropsWithRef<"h3">;

function CardTitle({ as: Tag = "h3", className, ...props }: CardTitleProps) {
  return <Tag className={cn("min-w-0 break-words text-h4 text-fg-primary", className)} {...props} />;
}

function CardDescription({ className, ...props }: ComponentPropsWithRef<"p">) {
  return <p className={cn("mt-r6 min-w-0 break-words text-body-2 text-fg-secondary", className)} {...props} />;
}

/**
 * Controls for the card as a whole. In a header they sit on the end, or under
 * the text when they do not fit beside it. They never widen the card: they
 * wrap, and an item that cannot wrap (a `Badge`) is capped at their width.
 */
function CardActions({ className, ...props }: ComponentPropsWithRef<"div">) {
  return <div className={cn("flex min-w-0 max-w-full flex-wrap items-center gap-r5 *:max-w-full", className)} {...props} />;
}

function CardBody({ className, ...props }: ComponentPropsWithRef<"div">) {
  return <div className={cn("min-w-0 px-r2 text-body-1", className)} {...props} />;
}

function CardFooter({ className, ...props }: ComponentPropsWithRef<"div">) {
  return (
    <div
      className={cn("mt-auto flex flex-wrap items-center justify-end gap-r5 border-t border-border px-r2 pt-r3", className)}
      {...props}
    />
  );
}

/** Compound card: `Card.Header`, `Card.Title`, `Card.Description`, `Card.Actions`, `Card.Body`, `Card.Footer`. */
export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Title: CardTitle,
  Description: CardDescription,
  Actions: CardActions,
  Body: CardBody,
  Footer: CardFooter,
});
