import { useState } from "react";

import {
  Alert,
  Button,
  Calendar,
  CopyButton,
  DateRangePicker,
  DEFAULT_DATE_RANGE_PRESETS,
  Field,
  LocaleProvider,
  type LocaleLabels,
  Meter,
  NumberInput,
  Pagination,
  Timeline,
  type TimelineEvent,
} from "../../../src";
import type {} from "../../../src/components/content/CopyButton";
import type {} from "../../../src/components/data/Meter";
import type {} from "../../../src/components/data/Timeline";
import type {} from "../../../src/components/dates/calendar-base";
import type {} from "../../../src/components/dates/DateRangePicker";
import type {} from "../../../src/components/form/NumberInput";
import type {} from "../../../src/components/navigation/Pagination";
import type {} from "../../../src/components/primitives/Alert";
import { Grid, Row, Stack } from "../form/parts/demo";

// The `LocaleLabels` keys below (each component adds its own to LabelsRegistry) are
// in the type program through the type-only imports above, whatever else it holds.

export const meta = {
  title: "LocaleProvider",
  group: "locale",
  order: 10,
  description:
    "Locale and translations set once: every component beneath reads its words from the provider (keyed by component) and formats numbers, dates and relative times in its locale. Precedence: defaults < providers (outer to inner) < a component's own labels and locale props. The inner provider switches to Arabic and right to left (`dir` renders a display-contents wrapper); what it leaves out still comes from the German provider around it.",
};

const TONES_DE = { error: "Fehler", warning: "Warnung", success: "Erfolg", info: "Hinweis", serious: "Ernst", stale: "Veraltet" };

const GERMAN: LocaleLabels = {
  Alert: { dismiss: "Schließen", tones: TONES_DE },
  Meter: { tones: TONES_DE },
  CopyButton: { copy: "Kopieren", copied: "Kopiert", failed: "Kopieren fehlgeschlagen" },
  NumberInput: { increment: "Erhöhen", decrement: "Verringern" },
  Pagination: {
    nav: "Seitennavigation",
    previous: "Vorherige Seite",
    next: "Nächste Seite",
    page: (page) => `Seite ${page}`,
    status: (page, count) => `Seite ${page} von ${count}`,
  },
  Timeline: {
    more: "Mehr anzeigen",
    expand: "Weiterlesen",
    collapse: "Weniger anzeigen",
    empty: "Noch keine Ereignisse",
    loading: "Ereignisse werden geladen",
    unknownDay: "Datum unbekannt",
    region: "Verlauf",
    tones: TONES_DE,
  },
  DateRangePicker: {
    formatLetters: { day: "TT", month: "MM", year: "JJJJ" },
    unparseable: (text, pattern) => `„${text}“ ist kein Datum. Format: ${pattern}.`,
    outOfRange: ({ min, max }) =>
      min && max ? `Ein Datum von ${min} bis ${max} wählen.` : min ? `${min} oder später wählen.` : `${max} oder früher wählen.`,
    unavailable: (date) => `${date} ist nicht verfügbar.`,
    previousMonth: "Vorheriger Monat",
    nextMonth: "Nächster Monat",
    today: "heute",
    selected: "ausgewählt",
    rangeStart: "Beginn des Zeitraums",
    rangeEnd: "Ende des Zeitraums",
    inRange: "im Zeitraum",
    dialog: "Zeitraum wählen",
    presets: "Schnellauswahl",
    start: "Beginn",
    end: "Ende",
    apply: "Übernehmen",
    cancel: "Abbrechen",
    clear: "Leeren",
    placeholder: "Zeitraum wählen",
    endBeforeStart: "Das Ende liegt vor dem Beginn.",
  },
};

const ARABIC: LocaleLabels = {
  Meter: { tones: { error: "خطأ", warning: "تحذير", success: "نجاح" } },
  CopyButton: { copy: "نسخ", copied: "تم النسخ", failed: "تعذر النسخ" },
  NumberInput: { increment: "زيادة", decrement: "إنقاص" },
  Pagination: {
    nav: "ترقيم الصفحات",
    previous: "الصفحة السابقة",
    next: "الصفحة التالية",
    page: (page) => `الصفحة ${page}`,
    status: (page, count) => `الصفحة ${page} من ${count}`,
  },
  Calendar: {
    previousMonth: "الشهر السابق",
    nextMonth: "الشهر التالي",
    today: "اليوم",
    selected: "محدد",
    rangeStart: "بداية النطاق",
    rangeEnd: "نهاية النطاق",
    inRange: "ضمن النطاق",
  },
};

const PRESET_NAMES: Record<string, string> = {
  "last-24-hours": "Letzte 24 Stunden",
  "last-7-days": "Letzte 7 Tage",
  "last-30-days": "Letzte 30 Tage",
  "this-month": "Dieser Monat",
};
const PRESETS_DE = DEFAULT_DATE_RANGE_PRESETS.map((preset) => ({ ...preset, label: PRESET_NAMES[preset.id] ?? preset.label }));

const NOW = new Date(2026, 9, 15, 14, 30);
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);
const EVENTS: TimelineEvent[] = [
  { id: "deploy", time: ago(12), title: "Version 4.2.0 ausgerollt", tone: "success", meta: "checkout · eu-central" },
  { id: "latency", time: ago(95), title: "Latenz über 1.200 ms", tone: "warning", meta: "search · p95" },
  { id: "incident", time: ago(26 * 60), title: "Zahlungsdienst nicht erreichbar", tone: "error", meta: "payments" },
];

function DismissibleAlert() {
  const [shown, setShown] = useState(true);
  return shown ? (
    <Alert tone="warning" title="Speicher fast voll" onDismiss={() => setShown(false)}>
      93,5 % von 2 TB belegt.
    </Alert>
  ) : (
    <Button variant="secondary" onClick={() => setShown(true)}>
      Hinweis wieder anzeigen
    </Button>
  );
}

export default function LocaleSection() {
  return (
    <LocaleProvider locale="de-DE" labels={GERMAN}>
      <Stack>
        <Row label="German (de-DE): words from the provider; numbers, dates and relative times in its locale">
          <div className="grid gap-r3" data-sc="locale-german">
            <Pagination pageCount={1200} defaultPage={1000} />
            <div className="w-column-sm max-w-full">
              <Pagination pageCount={1200} defaultPage={1000} />
            </div>
            <Grid>
              <Field>
                <Field.Label>Schwellenwert</Field.Label>
                <NumberInput defaultValue={1234.5} precision={1} />
              </Field>
              <Field>
                <Field.Label>Zeitraum</Field.Label>
                <DateRangePicker presets={PRESETS_DE} />
              </Field>
              <Meter label="Fehlerbudget verbraucht" value={82} thresholds={[{ at: 75, tone: "warning" }]} />
            </Grid>
            <DismissibleAlert />
            <Timeline events={EVENTS} now={NOW} label="Letzte Ereignisse" />
            <div className="flex flex-wrap items-center gap-r4">
              <CopyButton value="de-DE" showLabel variant="secondary" />
              <CopyButton value="de-DE" showLabel variant="secondary" labels={{ copy: "Gebietsschema kopieren" }} />
              <span className="text-body-2 text-fg-muted">The second button's own labels beat the provider's.</span>
            </div>
          </div>
        </Row>
        <Row label="Nested: Arabic (ar-EG), right to left. Only what it sets changes; anything it leaves out still comes from the German provider">
          <LocaleProvider locale="ar-EG" dir="rtl" labels={ARABIC}>
            <div className="grid gap-r3" data-sc="locale-arabic">
              <Pagination pageCount={1200} defaultPage={1000} />
              <Grid>
                <Field>
                  <Field.Label>الحد</Field.Label>
                  <NumberInput defaultValue={1234.5} precision={1} />
                </Field>
                <Meter label="ميزانية الأخطاء" value={82} thresholds={[{ at: 75, tone: "warning" }]} />
                <Calendar aria-label="تاريخ الاستحقاق" defaultValue={new Date(2026, 9, 15)} />
              </Grid>
              <div>
                <CopyButton value="ar-EG" showLabel variant="secondary" />
              </div>
            </div>
          </LocaleProvider>
        </Row>
      </Stack>
    </LocaleProvider>
  );
}
