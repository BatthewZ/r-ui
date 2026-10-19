"use client";

import { Check, X } from "lucide-react";
import { type ComponentPropsWithRef, type CSSProperties, type ReactNode, useId, useState } from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { formatNumber, listFormatter } from "../../util/format";
import { type LabelsProp, useLabels, useLocale } from "../../util/locale";
import { cn, type SlotClassNames } from "../../util/style";
import { Table, type TableProps } from "../data";
import { SegmentedControl } from "../form";
import { Grid } from "../layout";
import { Tooltip } from "../overlays";
import { Badge, Card, Skeleton } from "../primitives";

/** Which price a plan shows: each month's, or a yearly bill's monthly share. */
export type PricingBilling = "monthly" | "annual";

export interface PricingPrice {
  /** Billed every month, in major units of the currency (12 is $12). 0 is free. */
  monthly: number;
  /**
   * Billed once a year, in major units (120 is $120 a year). Under annual billing
   * the card shows its monthly share ($10) and the yearly bill under it; the
   * saving is measured against twelve monthly bills. Omitted: monthly only.
   */
  annual?: number;
}

/** A line in a plan card: a string is included; `{ included: false }` is drawn struck out with a cross. */
export type PricingPlanFeature = string | { label: string; included?: boolean };

export interface PricingPlan {
  /** Stable key; the comparison table's values are keyed by it. */
  id: string;
  name: string;
  /** One sentence on who the plan is for. */
  description?: ReactNode;
  /** Omitted: priced on request (an enterprise plan), shown as `labels.custom`. */
  price?: PricingPrice;
  /** Under the price: what it is per ("per editor"), a trial, a minimum. */
  priceNote?: ReactNode;
  features?: readonly PricingPlanFeature[];
  /** The call to action, usually one `Button` or a link styled as one. It fills the card's width. */
  action?: ReactNode;
  /** The plan to steer toward: a doubled strong edge and a badge (`labels.popular` unless `badge`). */
  highlighted?: boolean;
  /** A badge beside the name. Defaults to `labels.popular` on the highlighted plan. */
  badge?: ReactNode;
}

export interface PricingLabels {
  /** The billing toggle's name. */
  billing: string;
  monthly: string;
  annual: string;
  /** Beside the toggle: the best saving annual billing gives (a ratio, 0.17), `upTo` when plans differ. */
  saving: (ratio: number, upTo: boolean) => string;
  /** On an annual price: what that plan saves over twelve monthly bills (a ratio). */
  planSaving: (ratio: number) => string;
  /** After a price: every shown price is per month (annual ones as their monthly share). */
  perMonth: string;
  /** Under an annual price: the yearly bill, formatted, and its raw amount. */
  billedYearly: (amount: string, value: number) => string;
  /** The price of a plan that costs nothing. */
  free: string;
  /** The price of a plan priced on request. */
  custom: string;
  /** The highlighted plan's default badge. */
  popular: string;
  /** The plan list's name. */
  plans: string;
  included: string;
  excluded: string;
  /** The comparison table's feature column (visually hidden). */
  feature: string;
  /** The comparison table's name. */
  compare: string;
  /** Spoken while the plans load. */
  loading: string;
  /** Spoken once after the billing period changes; `prices` lists each plan's new price. */
  billingChanged: (billing: PricingBilling, prices: string) => string;
  /** One plan in that list. */
  planPrice: (plan: string, price: string) => string;
}

export const DEFAULT_PRICING_LABELS: PricingLabels = {
  billing: "Billing period",
  monthly: "Monthly",
  annual: "Annual",
  saving: (ratio, upTo) => `Save ${upTo ? "up to " : ""}${Math.round(ratio * 100)}% with annual billing`,
  planSaving: (ratio) => `save ${Math.round(ratio * 100)}%`,
  perMonth: "per month",
  billedYearly: (amount) => `${amount} billed yearly`,
  free: "Free",
  custom: "Custom",
  popular: "Most popular",
  plans: "Plans",
  included: "Included",
  excluded: "Not included",
  feature: "Feature",
  compare: "Compare plans",
  loading: "Loading plans",
  billingChanged: (billing, prices) => `${billing === "annual" ? "Annual" : "Monthly"} billing: ${prices}`,
  planPrice: (plan, price) => `${plan}, ${price}`,
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    Pricing: PricingLabels;
  }
}

type CurrencyDisplay = "symbol" | "narrowSymbol" | "code";

/** Money through the shared formatter: a whole amount drops its zero cents ($12, not $12.00). */
function formatMoney(value: number, currency: string, display: CurrencyDisplay, locale: string | undefined) {
  return formatNumber(value, {
    locale,
    style: "currency",
    currency,
    currencyDisplay: display,
    ...(Number.isInteger(value) && { minimumFractionDigits: 0 }),
  });
}

/** What annual billing saves over twelve monthly bills, as a ratio (0 when nothing). */
function savingOf(price: PricingPrice | undefined): number {
  if (price?.annual === undefined || !(price.monthly > 0)) return 0;
  return Math.max(0, 1 - price.annual / (price.monthly * 12));
}

type Quote =
  | { kind: "free" | "custom" }
  | { kind: "paid"; amount: number; yearly: number | undefined; saving: number };

/** The price a plan shows under a billing period. A plan without an annual price shows its monthly one. */
function quoteFor(price: PricingPrice | undefined, billing: PricingBilling): Quote {
  if (!price) return { kind: "custom" };
  const annual = billing === "annual" && price.annual !== undefined;
  const amount = annual ? (price.annual ?? 0) / 12 : price.monthly;
  if (amount === 0) return { kind: "free" };
  return { kind: "paid", amount, yearly: annual ? price.annual : undefined, saving: annual ? savingOf(price) : 0 };
}

export type PricingHeadingLevel = 2 | 3 | 4 | 5 | 6;

export type PricingProps = {
  plans: readonly PricingPlan[];
  /** ISO 4217 code every price is in (`"USD"`, `"EUR"`, `"JPY"`). */
  currency: string;
  /** How the currency is named beside an amount. @default "symbol" */
  currencyDisplay?: CurrencyDisplay;
  billing?: PricingBilling;
  /** @default "monthly" */
  defaultBilling?: PricingBilling;
  onBillingChange?: (billing: PricingBilling) => void;
  /** BCP 47 locale for the prices and the plan list. Omitted: the `LocaleProvider`'s, else the runtime's. */
  locale?: string;
  /** The plan names' heading level in the page outline (default 3). The look is the same at every level. */
  headingLevel?: PricingHeadingLevel;
  /** Skeleton cards in the plans' place (as many as `plans`, else three), spoken once. */
  loading?: boolean;
  labels?: LabelsProp<PricingLabels>;
  classNames?: SlotClassNames<"toggle" | "saving" | "plans" | "plan" | "price" | "action" | "features">;
} & Omit<ComponentPropsWithRef<"div">, "children">;

/**
 * Plan cards with an optional monthly / annual toggle.
 *
 * - Each plan is a card in a list: name (a heading), description, price,
 *   call to action and feature list. Cards in a row share their rows (CSS
 *   subgrid), so names, prices, actions and lists line up across plans whatever
 *   each one holds. The list auto-fits `--COLUMN-MD` columns by its own width
 *   and is capped to the plans' count, so two plans do not stretch a wide page.
 * - Prices are `Intl` currency in the locale (`formatNumber`), a whole amount
 *   without zero cents. 0 is `labels.free`; a plan without a price is
 *   `labels.custom` (an enterprise "Contact us").
 * - The highlighted plan is told apart without colour: a doubled strong edge
 *   (kept under forced colours) and a badge in words.
 * - Included and excluded features differ by glyph (check, cross), and an
 *   excluded one is struck through and named "Not included" to a screen reader.
 * - The toggle (shown when some plan has both prices) is a `SegmentedControl`;
 *   the best saving sits beside it and describes it. A change is spoken once,
 *   politely, with every plan's new price.
 */
export function Pricing({
  plans,
  currency,
  currencyDisplay = "symbol",
  billing: billingProp,
  defaultBilling = "monthly",
  onBillingChange,
  locale: localeProp,
  headingLevel = 3,
  loading = false,
  labels: labelsProp,
  classNames,
  className,
  ...props
}: PricingProps) {
  const labels = useLabels("Pricing", DEFAULT_PRICING_LABELS, labelsProp);
  const locale = useLocale(localeProp);
  const savingId = `${useId()}-saving`;
  const [billing, setBilling] = useControllableState({
    value: billingProp,
    defaultValue: defaultBilling,
    onChange: onBillingChange,
  });

  const money = (value: number) => formatMoney(value, currency, currencyDisplay, locale);
  const spoken = (quote: Quote) =>
    quote.kind === "paid" ? `${money(quote.amount)} ${labels.perMonth}` : quote.kind === "free" ? labels.free : labels.custom;

  // Announced on the observed change, so a parent's `billing` speaks too; never on mount.
  const [seen, setSeen] = useState(billing);
  const [message, setMessage] = useState("");
  if (seen !== billing) {
    setSeen(billing);
    const list = listFormatter(locale, { type: "unit" }).format(
      plans.map((plan) => labels.planPrice(plan.name, spoken(quoteFor(plan.price, billing)))),
    );
    setMessage(labels.billingChanged(billing, list));
  }

  const toggles = plans.some((plan) => plan.price?.annual !== undefined && plan.price.monthly > 0);
  const savings = new Set(plans.map((plan) => Math.round(savingOf(plan.price) * 100)).filter((percent) => percent > 0));
  const best = Math.max(0, ...savings);
  const Heading = `h${headingLevel}` as const;

  return (
    <div className={cn("relative grid gap-r2", className)} {...props}>
      {toggles && (
        <div
          data-print="hide"
          className={cn("flex flex-wrap items-center justify-center gap-x-r4 gap-y-r5", classNames?.toggle)}
        >
          <SegmentedControl
            aria-label={labels.billing}
            aria-describedby={best > 0 ? savingId : undefined}
            value={billing}
            onValueChange={(value) => setBilling(value === "annual" ? "annual" : "monthly")}
            disabled={loading}
          >
            <SegmentedControl.Item value="monthly">{labels.monthly}</SegmentedControl.Item>
            <SegmentedControl.Item value="annual">{labels.annual}</SegmentedControl.Item>
          </SegmentedControl>
          {best > 0 && (
            <p id={savingId} className={cn("min-w-0 text-body-2 font-medium text-fg-secondary", classNames?.saving)}>
              {labels.saving(best / 100, savings.size > 1)}
            </p>
          )}
        </div>
      )}
      <Grid
        as="ul"
        role="list"
        aria-label={labels.plans}
        aria-busy={loading || undefined}
        minColumn="md"
        gap="r2"
        rowGap="r3"
        className={cn("r-marketing-pricing-plans", classNames?.plans)}
        style={{ "--r-marketing-pricing-count": Math.max(1, plans.length || 3) } as CSSProperties}
      >
        {loading
          ? Array.from({ length: plans.length || 3 }, (_, index) => (
              <li key={index} className="flex min-w-0">
                <Card className="flex-1 px-r2">
                  <Skeleton label={index === 0 ? labels.loading : undefined} className="w-2/5" />
                  <Skeleton shape="block" className="h-control w-3/5" />
                  <Skeleton lines={4} />
                </Card>
              </li>
            ))
          : plans.map((plan) => {
              const quote = quoteFor(plan.price, billing);
              const badge = plan.badge ?? (plan.highlighted ? <Badge tone="accent">{labels.popular}</Badge> : null);
              return (
                <li key={plan.id} className="row-span-5 grid min-w-0 grid-rows-subgrid">
                  <Card
                    data-highlighted={plan.highlighted ? "" : undefined}
                    className={cn(
                      // Not a size container: containment makes its own formatting context, and a
                      // contained grid cannot be a subgrid (Card is `@container` by default).
                      "row-span-5 grid grid-rows-subgrid @container-normal",
                      plan.highlighted && "border-border-strong border-[length:calc(var(--BORDER-WIDTH)*2)]",
                      classNames?.plan,
                    )}
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-x-r4 gap-y-r5 px-r2">
                      <Heading className="min-w-0 [overflow-wrap:anywhere] text-h4 text-fg-primary">{plan.name}</Heading>
                      {badge}
                    </div>
                    <div className="min-w-0 px-r2">
                      {plan.description != null && (
                        <p className="[overflow-wrap:anywhere] text-body-2 text-fg-secondary">{plan.description}</p>
                      )}
                    </div>
                    <div className={cn("flex min-w-0 flex-col gap-r6 px-r2", classNames?.price)} data-price={quote.kind}>
                      <p className="flex flex-wrap items-baseline gap-x-r5">
                        <span className="min-w-0 [overflow-wrap:anywhere] text-display-3 text-fg-primary">
                          {quote.kind === "paid" ? money(quote.amount) : quote.kind === "free" ? labels.free : labels.custom}
                        </span>
                        {quote.kind === "paid" && <span className="text-body-2 text-fg-secondary">{labels.perMonth}</span>}
                      </p>
                      {plan.priceNote != null && (
                        <p className="[overflow-wrap:anywhere] text-body-2 text-fg-secondary">{plan.priceNote}</p>
                      )}
                      {quote.kind === "paid" && quote.yearly !== undefined && (
                        <p className="text-body-2 text-fg-muted">
                          {labels.billedYearly(money(quote.yearly), quote.yearly)}
                          {Math.round(quote.saving * 100) > 0 && (
                            <>
                              {" · "}
                              <span className="font-medium text-fg-secondary">
                                {labels.planSaving(quote.saving)}
                              </span>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    <div data-print="hide" className={cn("flex min-w-0 flex-col gap-r5 px-r2 *:w-full", classNames?.action)}>
                      {plan.action}
                    </div>
                    <PlanFeatures features={plan.features} labels={labels} className={classNames?.features} />
                  </Card>
                </li>
              );
            })}
      </Grid>
      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  );
}

function PlanFeatures({
  features = [],
  labels,
  className,
}: {
  features?: readonly PricingPlanFeature[];
  labels: PricingLabels;
  className?: string;
}) {
  if (features.length === 0) return <div />;
  return (
    <ul role="list" className={cn("flex min-w-0 flex-col gap-r5 px-r2 text-body-2", className)}>
      {features.map((feature) => {
        const { label, included = true } = typeof feature === "string" ? { label: feature } : feature;
        const Icon = included ? Check : X;
        return (
          <li
            key={label}
            data-included={included}
            className={cn("flex min-w-0 items-start gap-r5", included ? "text-fg-primary" : "text-fg-muted")}
          >
            <span aria-hidden className="inline-flex h-[1lh] shrink-0 items-center">
              <Icon className="size-icon" />
            </span>
            <span className={cn("min-w-0 [overflow-wrap:anywhere]", !included && "line-through")}>
              {!included && <span className="sr-only">{labels.excluded}: </span>}
              {label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/*  Comparison table                                                   */
/* ------------------------------------------------------------------ */

export interface PricingTableFeature {
  /** Stable key for the row. */
  id: string;
  label: ReactNode;
  /** What the feature means, on hover, keyboard focus or a press of its name (a tooltip). */
  description?: ReactNode;
  /**
   * Per plan id: `true` included (a check), `false` or missing not included (a
   * cross), anything else shown as written ("10 a month", "No limit").
   */
  values: Readonly<Record<string, ReactNode>>;
}

export interface PricingTableGroup {
  id: string;
  /** The group's heading row, spanning the table. Omitted: the rows follow the previous group's. */
  label?: ReactNode;
  features: readonly PricingTableFeature[];
}

export type PricingTableProps = {
  /** The plans as columns, in order (the same objects `Pricing` takes will do). */
  plans: readonly Pick<PricingPlan, "id" | "name" | "highlighted" | "badge">[];
  groups: readonly PricingTableGroup[];
  labels?: LabelsProp<PricingLabels>;
} & Omit<TableProps, "children" | "variant" | "layout" | "striped" | "stickyHeader" | "footer">;

/**
 * Plans compared feature by feature: the library `Table`, plans as columns,
 * each group of features a `<tbody>` under a heading row (`scope="rowgroup"`),
 * each feature a row header.
 *
 * - The head and the feature column stay put while the table scrolls: the
 *   table is its own scroller, capped to the viewport's height (a caller's
 *   `max-h-…` overrides), so its head sticks inside it rather than to the page.
 * - Narrow (decision): the table keeps its columns and scrolls sideways inside
 *   its own frame with the feature column pinned, rather than turning into a
 *   list per plan. Comparing across plans is the table's point, and per-plan
 *   lists repeat what the cards above already show. The feature column takes
 *   at most 40% of the table's width; each plan column keeps half a
 *   `--COLUMN-SM`.
 * - A feature's `description` makes its name a button that shows it in a
 *   `Tooltip`: on hover, on keyboard focus (then it describes the button), and
 *   on a press, which is how touch reaches it.
 * - A check or a cross says "Included" / "Not included" to a screen reader; the
 *   glyphs differ in shape, not only in ink. The highlighted plan's column head
 *   carries its badge in words.
 */
export function PricingTable({
  plans,
  groups,
  labels: labelsProp,
  className,
  "aria-label": ariaLabel,
  ...props
}: PricingTableProps) {
  const labels = useLabels("Pricing", DEFAULT_PRICING_LABELS, labelsProp);
  const span = plans.length + 1;
  return (
    <Table
      variant="rules"
      stickyHeader
      aria-label={ariaLabel ?? (props["aria-labelledby"] ? undefined : labels.compare)}
      className={cn("r-marketing-pricing-table", className)}
      {...props}
    >
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell wrap className="r-marketing-pricing-sticky">
            <span className="sr-only">{labels.feature}</span>
          </Table.HeaderCell>
          {plans.map((plan) => {
            const badge = plan.badge ?? (plan.highlighted ? <Badge tone="accent">{labels.popular}</Badge> : null);
            return (
              <Table.HeaderCell
                key={plan.id}
                wrap
                data-highlighted={plan.highlighted ? "" : undefined}
                className="r-marketing-pricing-plan-column text-center align-bottom"
              >
                <span className="inline-flex min-w-0 max-w-full flex-col items-center gap-r6">
                  {badge}
                  <span className="[overflow-wrap:anywhere] text-body-1 font-semibold text-fg-primary">{plan.name}</span>
                </span>
              </Table.HeaderCell>
            );
          })}
        </Table.Row>
      </Table.Head>
      {groups.map((group) => (
        <Table.Body key={group.id}>
          {group.label != null && (
            <Table.Row data-pricing-group="">
              <Table.HeaderCell
                scope="rowgroup"
                colSpan={span}
                wrap
                className="r-marketing-pricing-group text-body-2 font-semibold text-fg-primary"
              >
                <span>{group.label}</span>
              </Table.HeaderCell>
            </Table.Row>
          )}
          {group.features.map((feature) => (
            <Table.Row key={feature.id}>
              <Table.HeaderCell
                scope="row"
                wrap
                className="r-marketing-pricing-sticky text-body-2 font-normal text-fg-primary"
              >
                {feature.description != null ? (
                  <FeatureTerm description={feature.description}>{feature.label}</FeatureTerm>
                ) : (
                  feature.label
                )}
              </Table.HeaderCell>
              {plans.map((plan) => (
                <Table.Cell key={plan.id} wrap className="text-center">
                  <PlanValue value={feature.values[plan.id]} labels={labels} />
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      ))}
    </Table>
  );
}

/** A feature's name as a press-to-explain term: its tooltip opens on hover and focus, and on a press for touch. */
function FeatureTerm({ description, children }: { description: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip content={description} open={open} onOpenChange={setOpen}>
      <button
        type="button"
        className="r-marketing-pricing-term hit-area max-w-full cursor-help text-start [overflow-wrap:anywhere]"
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function PlanValue({ value, labels }: { value: ReactNode; labels: PricingLabels }) {
  if (value === true || value === false || value == null) {
    const included = value === true;
    const Icon = included ? Check : X;
    return (
      <span data-included={included}>
        <Icon aria-hidden className={cn("inline size-icon", included ? "text-fg-primary" : "text-fg-muted")} />
        <span className="sr-only">{included ? labels.included : labels.excluded}</span>
      </span>
    );
  }
  return <span className="[overflow-wrap:anywhere] text-body-2">{value}</span>;
}
