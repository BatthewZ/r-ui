"use client";

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ElementType, ReactNode, Ref } from "react";

import { useLinkElement } from "../../util/router";
import { cn, type SlotClassNames } from "../../util/style";
import { safeUrl } from "../../util/url";
import {
  BUTTON_BASE,
  BUTTON_PRESSED,
  BUTTON_VARIANT,
  type ButtonVariant,
  guardClick,
  isAriaDisabled,
} from "./button-styles";
import { Spinner } from "./Spinner";

type ButtonOwnProps = {
  variant?: ButtonVariant;
  /**
   * Busy: `aria-busy`, a centred spinner over the (still measured, still named)
   * content so the width never jumps, and activation is ignored. The button
   * stays focusable, so focus is not dropped to <body> mid-submit.
   */
  loading?: boolean;
  /** Decorative glyph before the label, sized to `--ICON`. */
  iconStart?: ReactNode;
  /** Decorative glyph after the label, sized to `--ICON`. */
  iconEnd?: ReactNode;
  classNames?: SlotClassNames<"label" | "icon" | "spinner">;
};

export type ButtonProps = ButtonOwnProps & {
  ref?: Ref<HTMLButtonElement>;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export type ButtonLinkProps = ButtonOwnProps & {
  /**
   * Makes it a link that looks like the button: the `RouterProvider`'s link for
   * an internal `href`, else an `<a>`. It passes through `safeUrl`: a refused
   * scheme (`javascript:` …) is dropped and the link goes nowhere.
   */
  href: string;
  /** Renders the link (default: the router's link for an internal `href`, else `<a>`). */
  linkAs?: ElementType;
  ref?: Ref<HTMLAnchorElement>;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

const SHAPE = "h-control min-w-hit max-w-full gap-r5 rounded-md px-control-pad text-body-1 font-medium";

function Content({ loading, iconStart, iconEnd, classNames, children }: ButtonOwnProps & { children?: ReactNode }) {
  return (
    <>
      <span className={cn("inline-flex min-w-0 items-center gap-r5", loading && "opacity-0")}>
        {iconStart && (
          <span className={cn("r-primitives-icon-slot", classNames?.icon)} aria-hidden>
            {iconStart}
          </span>
        )}
        {children != null && children !== false && (
          <span className={cn("min-w-0 truncate", classNames?.label)}>{children}</span>
        )}
        {iconEnd && (
          <span className={cn("r-primitives-icon-slot", classNames?.icon)} aria-hidden>
            {iconEnd}
          </span>
        )}
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner className={classNames?.spinner} />
        </span>
      )}
    </>
  );
}

/**
 * The action button. Height is `h-control` (density, raised to the hit floor
 * on coarse pointers); text is UI scale wherever it sits, prose included.
 * Given an `href`, it is a link with the same look (navigation, not an action).
 *
 * States: rest, hover, active, focus-visible (the base ring), disabled
 * (`disabled`, or `aria-disabled` to stay focusable; a link has only
 * `aria-disabled`), loading, and pressed (`aria-pressed` makes it a toggle and
 * paints the selection pair, as IconButton).
 */
export function Button(props: ButtonProps | ButtonLinkProps) {
  return isLink(props) ? <LinkButton {...props} /> : <ActionButton {...props} />;
}

const isLink = (props: ButtonProps | ButtonLinkProps): props is ButtonLinkProps =>
  "href" in props && props.href !== undefined;

function ActionButton({
  variant = "primary",
  loading = false,
  iconStart,
  iconEnd,
  classNames,
  className,
  children,
  onClick,
  type = "button",
  ...props
}: ButtonProps) {
  const inert = loading || isAriaDisabled(props["aria-disabled"]);
  return (
    <button
      // A bare <button> is type="submit": a Cancel rendered before the real
      // submit would become the form's default action.
      type={type}
      className={cn(BUTTON_BASE, SHAPE, BUTTON_VARIANT[variant], BUTTON_PRESSED, className)}
      {...props}
      aria-disabled={inert || undefined}
      aria-busy={loading || undefined}
      onClick={guardClick(inert, onClick)}
    >
      <Content loading={loading} iconStart={iconStart} iconEnd={iconEnd} classNames={classNames}>
        {children}
      </Content>
    </button>
  );
}

function LinkButton({
  variant = "primary",
  loading = false,
  iconStart,
  iconEnd,
  classNames,
  className,
  children,
  onClick,
  href,
  linkAs,
  ...props
}: ButtonLinkProps) {
  const inert = loading || isAriaDisabled(props["aria-disabled"]);
  const safe = safeUrl(href) || undefined;
  const Link = useLinkElement(linkAs, safe);
  return (
    <Link
      href={safe}
      className={cn(BUTTON_BASE, SHAPE, BUTTON_VARIANT[variant], className)}
      {...props}
      aria-disabled={inert || undefined}
      aria-busy={loading || undefined}
      onClick={guardClick(inert, onClick)}
    >
      <Content loading={loading} iconStart={iconStart} iconEnd={iconEnd} classNames={classNames}>
        {children}
      </Content>
    </Link>
  );
}
