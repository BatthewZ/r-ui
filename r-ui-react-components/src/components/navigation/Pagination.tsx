"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ComponentPropsWithRef, useRef } from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { formatNumber } from "../../util/format";
import { cn, type SlotClassNames } from "../../util/style";
import { IconButton } from "../primitives";

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

const DEFAULT_LABELS: PaginationLabels = {
  nav: "Pagination",
  previous: "Previous page",
  next: "Next page",
  page: (page) => `Page ${page}`,
  status: (page, pageCount) => `Page ${page} of ${pageCount}`,
};

export type PaginationProps = {
  /** Controlled current page, 1-based. */
  page?: number;
  /** Uncontrolled initial page. Default 1. */
  defaultPage?: number;
  onPageChange?: (page: number) => void;
  /** Total pages (at least 1). */
  pageCount: number;
  /** Pages shown either side of the current one. Default 1. */
  siblings?: number;
  labels?: Partial<PaginationLabels>;
  classNames?: SlotClassNames<"previous" | "next" | "list" | "page" | "status">;
} & Omit<ComponentPropsWithRef<"nav">, "children">;

/**
 * Previous / next and numbered page buttons. In a narrow container (under 28rem
 * of its own width, whatever the viewport) the numbers give way to "Page 3 of 12".
 * Numbers are locale-formatted.
 */
export function Pagination({
  page: pageProp,
  defaultPage = 1,
  onPageChange,
  pageCount: pageCountProp,
  siblings = 1,
  labels: labelsProp,
  className,
  classNames,
  ...props
}: PaginationProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const pageCount = Math.max(1, Math.floor(pageCountProp));
  const [rawPage, setPage] = useControllableState({
    value: pageProp,
    defaultValue: defaultPage,
    onChange: onPageChange,
  });
  const page = Math.min(Math.max(1, rawPage), pageCount);
  const navRef = useRef<HTMLElement>(null);

  const go = (next: number) => {
    setPage(next);
    // Reaching an end disables the button that got us there; hand focus to its
    // opposite so it does not fall back to <body>.
    const edge = next <= 1 ? "next" : next >= pageCount ? "previous" : null;
    if (edge && navRef.current?.contains(document.activeElement)) {
      const active = document.activeElement as HTMLElement;
      if (active.dataset.pagination !== undefined && active.dataset.pagination !== edge) {
        navRef.current.querySelector<HTMLElement>(`[data-pagination="${edge}"]`)?.focus();
      }
    }
  };

  const fmt = (n: number) => formatNumber(n);

  return (
    <nav ref={navRef} aria-label={labels.nav} className={cn("@container min-w-0", className)} {...props}>
      <div className="flex items-center gap-r6">
        <IconButton
          variant="ghost"
          label={labels.previous}
          icon={<ChevronLeft aria-hidden className="size-icon rtl:-scale-x-100" />}
          disabled={page <= 1}
          data-pagination="previous"
          className={cn("size-control", classNames?.previous)}
          onClick={() => go(page - 1)}
        />
        <ul className={cn("hidden items-center gap-r6 @md:flex", classNames?.list)}>
          {pageSlots(page, pageCount, siblings).map((slot) =>
            typeof slot === "number" ? (
              <li key={slot}>
                <button
                  type="button"
                  aria-label={labels.page(fmt(slot))}
                  aria-current={slot === page ? "page" : undefined}
                  className={cn(
                    "r-navigation-pagination-page relative inline-flex h-control min-w-control items-center justify-center rounded-md px-r5 text-body-1 text-fg-secondary",
                    "transition-colors hover:bg-fg-primary/8 hover:text-fg-primary active:bg-fg-primary/12 aria-[current=page]:font-semibold aria-[current=page]:text-fg-primary",
                    classNames?.page,
                  )}
                  onClick={() => go(slot)}
                >
                  {fmt(slot)}
                </button>
              </li>
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
        <IconButton
          variant="ghost"
          label={labels.next}
          icon={<ChevronRight aria-hidden className="size-icon rtl:-scale-x-100" />}
          disabled={page >= pageCount}
          data-pagination="next"
          className={cn("size-control", classNames?.next)}
          onClick={() => go(page + 1)}
        />
      </div>
    </nav>
  );
}
