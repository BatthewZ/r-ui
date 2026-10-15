import { useState } from "react";

import { Alert, Button, Link, type StatusTone } from "../../../src/components/primitives";
import { Row, Stack } from "./parts/demo";

export const meta = {
  title: "Alert",
  group: "primitives",
  order: 40,
  description:
    "Tone, glyph, title, body, actions, dismiss. Title in the tone's text-safe ink and body in primary ink, both contract pairs on the tone's subtle background; error and serious are role=alert.",
};

const SAMPLES: { tone: StatusTone; title: string; body: string }[] = [
  { tone: "info", title: "Scheduled maintenance", body: "The reporting API is read-only on Sunday from 02:00 to 03:00 UTC." },
  { tone: "success", title: "Export ready", body: "orders-2026-10.csv (2.4 MB) is ready to download." },
  { tone: "warning", title: "Quota at 90%", body: "You have used 9,000 of 10,000 monthly API calls." },
  { tone: "error", title: "Payment failed", body: "The card ending 4242 was declined. Update it to keep your workspace active." },
  { tone: "serious", title: "Elevated error rate", body: "eu-west-1 is returning 5xx on 3.2% of requests." },
  { tone: "stale", title: "Data is 14 minutes old", body: "The collector has not reported since 10:46. Figures below may be out of date." },
  { tone: "neutral", title: "Note", body: "Figures exclude refunds issued after the period closed." },
];

export default function AlertSection() {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = SAMPLES.filter((s) => !dismissed.includes(s.tone));

  return (
    <Stack>
      <Row label="Every tone, dismissible (restore below)">
        <div className="grid gap-r4">
          {visible.map((s) => (
            <Alert
              key={s.tone}
              tone={s.tone}
              title={s.title}
              onDismiss={() => setDismissed((d) => [...d, s.tone])}
              actions={
                s.tone === "error" ? (
                  <>
                    <Button variant="secondary">Update card</Button>
                    <Button variant="ghost">Contact billing</Button>
                  </>
                ) : undefined
              }
            >
              {s.body}
            </Alert>
          ))}
          {dismissed.length > 0 && (
            <div>
              <Button variant="secondary" onClick={() => setDismissed([])}>
                Restore {dismissed.length} dismissed
              </Button>
            </div>
          )}
        </div>
      </Row>

      <Row label="Body only · no glyph · static callout (role=note) with a link · compact · narrow · RTL">
        <div className="grid gap-r4 @2xl:grid-cols-2">
          <Alert tone="info">Your changes are saved automatically.</Alert>
          <Alert tone="success" icon={null} title="Deployed">
            Version 4.2.0 is live.
          </Alert>
          <Alert role="note" tone="neutral" title="Tip">
            Press <kbd className="font-mono">/</kbd> to search. <Link href="#/overview/primitives-link">Keyboard shortcuts</Link>
          </Alert>
          <div data-density="compact">
            <Alert tone="warning" title="Compact" onDismiss={() => undefined}>
              Density re-derives inside the alert.
            </Alert>
          </div>
          <div className="w-1/2 min-w-0">
            <Alert tone="error" title="Synchronisation échouée" onDismiss={() => undefined}>
              La synchronisation des données a échoué après trois tentatives consécutives.
            </Alert>
          </div>
          <div dir="rtl">
            <Alert tone="warning" title="تحذير" onDismiss={() => undefined} labels={{ dismiss: "إغلاق" }}>
              تم استخدام 90٪ من الحصة الشهرية.
            </Alert>
          </div>
        </div>
      </Row>
    </Stack>
  );
}
