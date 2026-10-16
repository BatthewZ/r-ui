import { useState } from "react";

import { Banner } from "../../../src/components/feedback";
import { Button, Link, type StatusTone } from "../../../src/components/primitives";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "Banner",
  group: "feedback",
  order: 30,
  description:
    "A page- or site-wide announcement: a named region (not live) unless urgent, which is role=alert. Top placement is an edge band, inline a box; sticky takes the sticky layer. Dismissing hides it, and with a dismissKey it stays dismissed across reloads (guarded storage).",
};

/** Under the showcase's own prefix, so the browser checks' reset clears it. */
const MAINTENANCE_KEY = "r-ui-showcase:feedback-banner-maintenance";

const TONES: { tone: StatusTone; title: string; body: string }[] = [
  { tone: "success", title: "Migration finished", body: "Every workspace now runs on the new storage engine." },
  { tone: "neutral", title: "Holiday hours", body: "Support answers within one working day until 2 January." },
  { tone: "serious", title: "Degraded performance in eu-west-1", body: "Dashboards may take up to a minute to load." },
  { tone: "stale", title: "Status page delayed", body: "The figures below were last updated 25 minutes ago." },
];

export default function BannerSection() {
  // Bumped by Restore: remounts every banner, so they read storage afresh.
  const [generation, setGeneration] = useState(0);
  const restore = () => {
    try {
      localStorage.removeItem(MAINTENANCE_KEY);
    } catch {
      // A blocked store: nothing was remembered either.
    }
    setGeneration((g) => g + 1);
  };

  return (
    <Stack key={generation}>
      <Row label="Top of a page: an edge band, dismissed for good (reload the page: it stays dismissed until Restore)">
        {/* Rounded by the band itself, not clipped by the frame: a clip would cut the
            dismiss button's coarse hit area at the edge. */}
        <div className="rounded-lg border border-border bg-canvas" data-sc="banner-page">
          <Banner
            className="rounded-t-lg"
            placement="top"
            tone="info"
            title="Scheduled maintenance on Sunday"
            dismissKey={MAINTENANCE_KEY}
            actions={<Link href="#/overview/feedback-banner">Read the plan</Link>}
            data-sc="banner-persist"
          >
            Reporting is read-only from 02:00 to 03:00 UTC.
          </Banner>
          <div className="grid gap-r5 p-r3 text-body-2 text-fg-secondary">
            <p className="text-h5 text-fg-primary">Overview</p>
            <p>The page under the banner. Dismissing the banner leaves it in place.</p>
          </div>
        </div>
        <div>
          <Button variant="secondary" onClick={restore} data-sc="banner-restore">
            Restore banners
          </Button>
        </div>
      </Row>

      <Row label="Inline: warning with actions (dismissed until remount) · urgent (role=alert) · no title (named 'Announcement')">
        <div className="grid gap-r4">
          <Banner
            tone="warning"
            title="Your trial ends in 3 days"
            onDismiss={() => undefined}
            actions={
              <>
                <Button>Choose a plan</Button>
                <Button variant="ghost">Talk to sales</Button>
              </>
            }
          >
            Projects stay read-only after the trial until a plan is chosen.
          </Banner>
          <Banner tone="error" urgent title="Payments are failing">
            Card payments have been declined since 10:42 UTC. We are working with the provider.
          </Banner>
          <Banner tone="info" onDismiss={() => undefined}>
            New: dashboards can now be shared with people outside your workspace.
          </Banner>
        </div>
      </Row>

      <Row label="Sticky at the top of its own scroller (z-sticky), over the content scrolling under it">
        <div
          className="max-h-[calc(var(--ROW-H)*6)] overflow-y-auto rounded-lg border border-border"
          data-sc="banner-sticky"
          data-print="flow"
        >
          <Banner placement="top" sticky tone="warning" title="Read-only mode">
            Edits are paused while the database fails over.
          </Banner>
          <div className="grid gap-r4 p-r3 text-body-2 text-fg-secondary">
            {Array.from({ length: 8 }, (_, i) => (
              <p key={i}>
                Row {i + 1}: content that scrolls under the sticky banner, so the band stays in view while the region is
                read.
              </p>
            ))}
          </div>
        </div>
      </Row>

      <Row label="Every other tone · long content · compact · RTL">
        <div className="grid gap-r4">
          {TONES.map((t) => (
            <Banner key={t.tone} tone={t.tone} title={t.title}>
              {t.body}
            </Banner>
          ))}
          <Banner
            tone="info"
            title="Datenschutzrichtlinie aktualisiert: Änderungen bei der Verarbeitung personenbezogener Daten"
            onDismiss={() => undefined}
            actions={<Button variant="secondary">Änderungen ansehen</Button>}
          >
            Ab dem 1. November gelten aktualisierte Bedingungen für Auftragsverarbeitung, Unterauftragsverarbeiter und
            internationale Datenübermittlungen. Superlangeswortohneumbruchmöglichkeitdasdenrahmennichtsprengendarf.
          </Banner>
          <div data-density="compact">
            <Banner tone="success" title="Compact" onDismiss={() => undefined}>
              Density re-derives inside the banner.
            </Banner>
          </div>
          <div dir="rtl">
            <Banner
              tone="warning"
              title="صيانة مجدولة"
              onDismiss={() => undefined}
              labels={{ dismiss: "إغلاق", tones: { warning: "تحذير" } }}
            >
              ستكون التقارير للقراءة فقط يوم الأحد.
            </Banner>
          </div>
        </div>
      </Row>
    </Stack>
  );
}
