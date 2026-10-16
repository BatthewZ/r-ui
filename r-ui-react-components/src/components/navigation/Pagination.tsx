"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ComponentPropsWithRef, useLayoutEffect, useRef } from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { formatNumber } from "../../util/format";
import { useLinkElement } from "../../util/router";
import { cn, type SlotClassNames } from "../../util/style";
import { IconButton } from "../primitives";
import { type LabelsProp, useLabels, useLocale } from "../../util/locale";

type PageSlot = number | "gap-start" | "gap-end";

/**
 * The pages to show: always the first and last, `siblings` either side of the
 * current page, and a gap where pages are skipped. The slot count is constant
 * (`2 * siblings + 5`) so the control does not change width as the page moves.
 */
export function pageSlots(page: number, pageCount: number, siblings: number): PageSlot[] {
  const slots = 2 * siblings + 5;
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  if (pageCount <= slots) return range(1, pageCount);

  const start = Math.max(page - siblings, 1);
  const end = Math.min(page + siblings, pageCount);
  const gapStart = start > 3;
  const gapEnd = end < pageCount - 2;
  const block = slots - 2;

  if (!gapStart) return [...range(1, block), "gap-end", pageCount];
  if (!gapEnd) return [1, "gap-start", ...range(pageCount - block + 1, pageCount)];
  return [1, "gap-start", ...range(start, end), "gap-end", pageCount];
}

export interface PaginationLabels {
  /** The landmark's name. Default "Pagination". */
  nav: string;
  previous: string;
  next: string;
  /** A page button's accessible name. Default "Page 3". */
  page: (page: string) => string;
  /** The compact form's status text. Default "Page 3 of 12". */
  status: (page: string, pageCount: string) => string;
}

export const DEFAULT_PAGINATION_LABELS: PaginationLabels = {
  nav: "Pagination",
  previous: "Previous page",
  next: "Next page",
  page: (page) => `Page ${page}`,
  status: (page, pageCount) => `Page ${page} of ${pageCount}`,
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    Pagination: PaginationLabels;
  }
}

export type PaginationProps = {
  /** Controlled current page, 1-based. */
  page?: number;
  /** Uncontrolled initial page. Default 1. */
  defaultPage?: number;
  /** Called with the page chosen (in link mode too, as the link is followed). */
  onPageChange?: (page: number) => void;
  /** Total pages (at least 1). */
  pageCount: number;
  /** Pages shown either side of the current one. Default 1. */
  siblings?: number;
  /**
   * Link mode: every page, previous and next become real links to
   * `getHref(page)`, rendered by the `RouterProvider`'s link (an `<a>` without
   * one), so they can be opened in a new tab and work without JavaScript. Pass
   * `page` from the URL. Without it the pages are buttons.
   */
  getHref?: (page: number) => string;
  labels?: LabelsProp<PaginationLabels>;
  classNames?: SlotClassNames<"row" | "previous" | "next" | "list" | "page" | "status">;
} & Omit<ComponentPropsWithRef<"nav">, "children">;

/** A page number, and in link mode previous / next too: chrome-less, the quiet wash on hover. */
const PAGE_CLASSES =
  "r-navigation-pagination-page relative inline-flex h-control min-w-control items-center justify-center rounded-md px-r5 text-body-1 text-fg-secondary transition-colors hover:bg-fg-primary/8 hover:text-fg-primary active:bg-fg-primary/12 aria-[current=page]:font-semibold aria-[current=page]:text-fg-primary";

/** A link-mode arrow at an end: no `href`, so nothing to follow, and visibly unavailable. */
const ARROW_DISABLED = "aria-disabled:pointer-events-none aria-disabled:opacity-disabled";

/**
 * Previous / next and numbered pages: buttons, or real links with `getHref`. In
 * a narrow container (under 28rem of its own width, whatever the viewport) the
 * numbers give way to "Page 3 of 12". Numbers are locale-formatted.
 */
export function Pagination({
  page: pageProp,
  defaultPage = 1,
  onPageChange,
  pageCount: pageCountProp,
  siblings = 1,
  getHref,
  labels: labelsProp,
  className,
  classNames,
  ...props
}: PaginationProps) {
  const labels = useLabels("Pagination", DEFAULT_PAGINATION_LABELS, labelsProp);
  const locale = useLocale();
  // `|| 1`: NaN (a `?page=abc` parsed with `Number`, a 0/0 count) escapes Math.max/min.
  const pageCount = Math.max(1, Math.floor(pageCountProp) || 1);
  const [rawPage, setPage] = useControllableState({
    value: pageProp,
    defaultValue: defaultPage,
    onChange: onPageChange,
  });
  const page = Math.min(Math.max(1, Math.floor(rawPage) || 1), pageCount);
  const navRef = useRef<HTMLElement>(null);
  const LinkElement = useLinkElement(undefined, getHref?.(page));

  // Reaching an end disables the control that got us there; focus goes to its
  // opposite so it does not fall back to <body>. That arrow may itself be
  // disabled until the new page commits (two pages; link mode, where the owner
  // commits the URL's page later), so the handoff waits for the commit.
  const pendingFocus = useRef<{ edge: "previous" | "next"; page: number } | null>(null);

  const go = (next: number) => {
    const edge = next <= 1 ? "next" : next >= pageCount ? "previous" : null;
    const active = document.activeElement;
    const fromArrow =
      active instanceof HTMLElement &&
      navRef.current?.contains(active) &&
      active.dataset.pagination !== undefined &&
      active.dataset.pagination !== edge;
    pendingFocus.current = edge && fromArrow ? { edge, page: next } : null;
    setPage(next);
  };

  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    // The owner moved somewhere else: this is not the move that asked for focus.
    if (pending.page !== page) return;
    const nav = navRef.current;
    const active = document.activeElement;
    if (!nav || (active !== document.body && !nav.contains(active))) return;
    nav.querySelector<HTMLElement>(`[data-pagination="${pending.edge}"]`)?.focus();
  }, [page]);

  const fmt = (n: number) => formatNumber(n, { locale });

  const arrow = (direction: "previous" | "next") => {
    const target = direction === "previous" ? page - 1 : page + 1;
    const disabled = direction === "previous" ? page <= 1 : page >= pageCount;
    const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
    const icon = <Icon aria-hidden className="size-icon rtl:-scale-x-100" />;
    const arrowClass = direction === "previous" ? classNames?.previous : classNames?.next;
    if (!getHref) {
      return (
        <IconButton
          variant="ghost"
          label={labels[direction]}
          icon={icon}
          disabled={disabled}
          data-pagination={direction}
          className={cn("size-control", arrowClass)}
          onClick={() => go(target)}
        />
      );
    }
    // An `<a>` with no href is not a link; at an end it keeps the role and says it is unavailable.
    return disabled ? (
      <a role="link" aria-disabled="true" aria-label={labels[direction]} data-pagination={direction} className={cn(PAGE_CLASSES, "px-0", ARROW_DISABLED, arrowClass)}>
        {icon}
      </a>
    ) : (
      <LinkElement
        href={getHref(target)}
        aria-label={labels[direction]}
        title={labels[direction]}
        data-pagination={direction}
        className={cn(PAGE_CLASSES, "px-0", arrowClass)}
        onClick={() => go(target)}
      >
        {icon}
      </LinkElement>
    );
  };

  const pageControl = (slot: number) => {
    const props = {
      "aria-label": labels.page(fmt(slot)),
      "aria-current": slot === page ? ("page" as const) : undefined,
      className: cn(PAGE_CLASSES, classNames?.page),
      onClick: () => go(slot),
      children: fmt(slot),
    };
    return getHref ? <LinkElement href={getHref(slot)} {...props} /> : <button type="button" {...props} />;
  };

  return (
    <nav ref={navRef} aria-label={labels.nav} className={cn("@container min-w-0", className)} {...props}>
      <div className={cn("flex items-center gap-r6", classNames?.row)}>
        {arrow("previous")}
        <ul className={cn("hidden items-center gap-r6 @md:flex", classNames?.list)}>
          {pageSlots(page, pageCount, siblings).map((slot) =>
            typeof slot === "number" ? (
              <li key={slot}>{pageControl(slot)}</li>
            ) : (
              <li key={slot} aria-hidden className="inline-flex min-w-control justify-center text-fg-muted">
                …
              </li>
            ),
          )}
        </ul>
        <span
          aria-live="polite"
          className={cn("px-r5 text-body-1 whitespace-nowrap text-fg-secondary @md:hidden", classNames?.status)}
        >
          {labels.status(fmt(page), fmt(pageCount))}
        </span>
        {arrow("next")}
      </div>
    </nav>
  );
}
