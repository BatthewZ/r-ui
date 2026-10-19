import { useState } from "react";

import {
  Alert,
  Button,
  type LocaleLabels,
  LocaleProvider,
  Pricing,
  type PricingBilling,
  type PricingPlan,
  PricingTable,
  type PricingTableGroup,
} from "../../../src";
import { Row, Stack } from "../overlays/parts/demo";
import { GROUPS, PLANS } from "./parts/pricing-data";

export const meta = {
  title: "Pricing",
  group: "marketing",
  order: 60,
  description:
    "Plan cards whose rows line up across plans (subgrid), prices in the locale's currency format, a monthly / annual toggle that shows the saving and speaks each change once, and a comparison table whose head and feature column stay put while it scrolls inside its own frame. The highlighted plan has a doubled edge and a badge in words, never colour alone; excluded features are a cross, struck and named.",
};

/** Two plans in euros, in German, opening on annual billing. */
const TWO: PricingPlan[] = [
  {
    id: "solo",
    name: "Solo",
    description: "Für eine Person und ein Projekt.",
    price: { monthly: 9.5, annual: 96 },
    features: ["Ein Repository", "Unbegrenzte Releases", { label: "Freigabe vor Veröffentlichung", included: false }],
    action: <Button variant="secondary">Kostenlos testen</Button>,
  },
  {
    id: "studio",
    name: "Studio",
    description: "Für Teams, die jede Woche veröffentlichen.",
    price: { monthly: 29, annual: 290 },
    priceNote: "pro Redakteur",
    highlighted: true,
    features: ["Unbegrenzte Repositories", "Unbegrenzte Releases", "Freigabe vor Veröffentlichung"],
    action: <Button>14 Tage testen</Button>,
  },
];

const ENTERPRISE: PricingPlan[] = [
  PLANS[1]!,
  { ...PLANS[2]!, highlighted: true },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Many teams, your own region and a contract that says so.",
    priceNote: "Volume pricing, invoiced yearly",
    features: ["Everything in Business", "Data residency (EU or US)", "SAML and SCIM", "A named support engineer"],
    action: <Button variant="secondary">Contact us</Button>,
  },
];

/** Long names and figures: a 40% plan name, a seven-figure price, a feature that will not break. */
const LONG: PricingPlan[] = [
  {
    id: "long",
    name: "Unternehmenskommunikationsplattform",
    description: "Ein Tarif mit einem sehr langen Namen, um Zeilenumbrüche zu prüfen.",
    price: { monthly: 1234567.89 },
    priceNote: "pro Organisation und Monat, zuzüglich Mehrwertsteuer",
    features: ["Veröffentlichungsfreigabeverfahrensverwaltung", "https://example.com/a/very/long/link/that/never/breaks/on/its/own"],
    action: <Button disabled>Current plan</Button>,
  },
  { id: "free", name: "Free", price: { monthly: 0 }, action: <Button variant="secondary">Downgrade</Button> },
];

const RTL: PricingPlan[] = [
  {
    id: "basic",
    name: "أساسي",
    price: { monthly: 150, annual: 1500 },
    features: ["مستودع واحد", { label: "تسجيل دخول موحد", included: false }],
    action: <Button variant="secondary">ابدأ</Button>,
  },
  {
    id: "pro",
    name: "احترافي",
    price: { monthly: 450, annual: 4200 },
    highlighted: true,
    features: ["مستودعات غير محدودة", "تسجيل دخول موحد"],
    action: <Button>ابدأ</Button>,
  },
];

/** Three columns, so the table is wider than a phone's frame and its pinned column shows. */
const RTL_COLUMNS = [...RTL, { id: "org", name: "المؤسسات" }];

const RTL_GROUPS: PricingTableGroup[] = [
  {
    id: "main",
    label: "النشر",
    features: [
      { id: "repos", label: "المستودعات", values: { basic: "1", pro: "غير محدود", org: "غير محدود" } },
      {
        id: "sso",
        label: "تسجيل دخول موحد",
        description: "يسجّل المحررون الدخول عبر مزوّد الهوية لديك.",
        values: { basic: false, pro: true, org: true },
      },
    ],
  },
];

// Module scope: a provider's labels object must stay stable across renders.
const GERMAN: LocaleLabels = {
  Pricing: {
    monthly: "Monatlich",
    annual: "Jährlich",
    perMonth: "pro Monat",
    popular: "Beliebt",
    saving: (ratio, upTo) => `${upTo ? "Bis zu " : ""}${Math.round(ratio * 100)} % sparen mit jährlicher Abrechnung`,
    planSaving: (ratio) => `${Math.round(ratio * 100)} % gespart`,
    billedYearly: (amount) => `${amount} jährlich abgerechnet`,
    excluded: "Nicht enthalten",
  },
};

const ARABIC: LocaleLabels = {
  Pricing: {
    billing: "فترة الفوترة",
    monthly: "شهري",
    annual: "سنوي",
    perMonth: "شهريًا",
    popular: "الأكثر شيوعًا",
    plans: "الخطط",
    excluded: "غير مشمول",
    included: "مشمول",
    feature: "الميزة",
    saving: (ratio) => `وفّر حتى ${Math.round(ratio * 100)}٪ بالفوترة السنوية`,
    billedYearly: (amount) => `${amount} تُدفع سنويًا`,
    planSaving: (ratio) => `وفّر ${Math.round(ratio * 100)}٪`,
  },
};

function ThreePlans() {
  const [billing, setBilling] = useState<PricingBilling>("monthly");
  return (
    <div className="grid gap-r2" data-sc="pricing-three">
      <Pricing plans={PLANS} currency="USD" billing={billing} onBillingChange={setBilling} />
      <output className="text-body-3 text-fg-muted">
        Billing: <span data-sc="pricing-billing">{billing}</span>
      </output>
      <div data-sc-scrolls="" data-sc="pricing-compare">
        <PricingTable plans={PLANS} groups={GROUPS} className="max-h-[calc(var(--ROW-H)*8)] [--r-marketing-pricing-surface:var(--C-SURFACE-0)]" />
      </div>
    </div>
  );
}

export default function PricingSection() {
  return (
    <Stack>
      <Row label="Three plans · monthly / annual (the best saving beside it, spoken once on change) · comparison table: grouped rows, explanations on the dotted names (hover, keyboard focus or a press), head and feature column pinned while it scrolls">
        <ThreePlans />
      </Row>
      <Row label="Two plans in euros through LocaleProvider de-DE, opening on annual billing · capped to two columns' width">
        <LocaleProvider locale="de-DE" labels={GERMAN}>
          <div data-sc="pricing-two">
            <Pricing plans={TWO} currency="EUR" defaultBilling="annual" headingLevel={4} />
          </div>
        </LocaleProvider>
      </Row>
      <Row label="An enterprise plan priced on request (“Custom”, Contact us) · monthly only, so no toggle · a highlighted plan that is not the middle one">
        <div data-sc="pricing-enterprise">
          <Pricing plans={ENTERPRISE} currency="USD" />
        </div>
      </Row>
      <Row label="Loading (skeleton cards, spoken once, the toggle disabled) · error and empty are the page's own words in the plans' place">
        <div className="grid gap-r2">
          <Pricing plans={PLANS} currency="USD" loading data-sc="pricing-loading" />
          <Alert tone="error" role="note" title="Prices could not be loaded" actions={<Button variant="secondary">Try again</Button>}>
            Check your connection, or see every plan on the pricing page.
          </Alert>
          <Alert role="note" title="No plans in your region yet">Leave your email and we will tell you when they are.</Alert>
        </div>
      </Row>
      <Row label="Long content: a long plan name, a seven-figure price, unbroken words · a disabled “Current plan” action">
        <Pricing plans={LONG} currency="EUR" locale="de-DE" data-sc="pricing-long" />
      </Row>
      <Row label="Compact subtree: cards and table re-derive their spacing · RTL in ar-EG pounds (the toggle and the pinned column on the inline start)">
        <div className="grid gap-r2">
          <div data-density="compact" className="grid gap-r3" data-sc="pricing-compact">
            <Pricing plans={PLANS} currency="USD" locale="en-US" />
            <div data-sc-scrolls="">
              <PricingTable plans={PLANS} groups={GROUPS.slice(0, 2)} className="max-h-[calc(var(--ROW-H)*8)] [--r-marketing-pricing-surface:var(--C-SURFACE-0)]" />
            </div>
          </div>
          <LocaleProvider locale="ar-EG" dir="rtl" labels={ARABIC}>
            <div className="grid gap-r3" data-sc="pricing-rtl">
              <Pricing plans={RTL} currency="EGP" />
              <div data-sc-scrolls="">
                <PricingTable plans={RTL_COLUMNS} groups={RTL_GROUPS} aria-label="قارن الخطط" className="[--r-marketing-pricing-surface:var(--C-SURFACE-0)]" />
              </div>
            </div>
          </LocaleProvider>
        </div>
      </Row>
    </Stack>
  );
}
