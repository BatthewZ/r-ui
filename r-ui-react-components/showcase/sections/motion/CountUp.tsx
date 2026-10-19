import { CountUp, type CountUpProps } from "../../../src/components/motion";
import { formatCompact, formatUnit } from "../../../src/util/format";
import { LocaleProvider } from "../../../src/util/locale";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "CountUp",
  group: "motion",
  order: 50,
  description:
    "Figures that count up from a start to their value the first time they scroll into view, every frame formatted in the locale in tabular figures, the box at the final value's width. Assistive tech reads only the final value, from the first render; the server, reduced motion and a figure already on screen show it at once. A missing value is the dash and never counts.",
};

type Stat = { label: string } & Pick<CountUpProps, "value" | "from" | "format" | "formatOptions">;

const STATS: Stat[] = [
  { label: "Teams shipping", value: 12480 },
  { label: "Uptime, last 90 days", value: 0.9995, formatOptions: { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 } },
  {
    label: "Paid out to creators",
    value: 4_200_000,
    format: (n, locale) => formatCompact(n, { locale, style: "currency", currency: "EUR" }),
  },
  { label: "Median deploy", value: 38.5, format: (n, locale) => formatUnit(n, "second", { locale, maximumFractionDigits: 1 }) },
];

function Band({ stats = STATS, label }: { stats?: Stat[]; label: string }) {
  return (
    <dl
      data-sc="count-up-band"
      aria-label={label}
      className="grid gap-r3 rounded-lg border border-border bg-surface-0 p-r2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,var(--COLUMN-SM)),1fr))]"
    >
      {stats.map(({ label: name, ...count }) => (
        <div key={name} className="grid min-w-0 content-start gap-r5">
          <dt className="text-body-2 text-fg-secondary break-words">{name}</dt>
          <dd className="text-h1">
            <CountUp data-sc="count-up" {...count} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function CountUpSection() {
  return (
    <Stack>
      <Row label="A stats band (scroll it into view from above to see the count)">
        <Band label="This year" />
      </Row>
      <Row label="from={9000} and a missing value (the dash, never counted)">
        <Band
          label="Edge cases"
          stats={[
            { label: "Seats, from last year's 9,000", value: 12480, from: 9000 },
            { label: "Refunds (not reported)", value: null },
          ]}
        />
      </Row>
      <Row label="German through the LocaleProvider: every frame grouped and marked the German way">
        <LocaleProvider locale="de-DE">
          <Band label="Dieses Jahr" />
        </LocaleProvider>
      </Row>
      <Row label="RTL with Arabic digits, compact">
        <LocaleProvider locale="ar-EG">
          <div dir="rtl" lang="ar" data-density="compact">
            <Band
              label="هذا العام"
              stats={[
                { label: "فرق تنشر", value: 12480 },
                { label: "مدة التشغيل", value: 0.9995, formatOptions: { style: "percent", minimumFractionDigits: 2 } },
              ]}
            />
          </div>
        </LocaleProvider>
      </Row>
    </Stack>
  );
}
