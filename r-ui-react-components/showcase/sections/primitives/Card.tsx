import { Download, MoreHorizontal, RefreshCw } from "lucide-react";

import { Badge, Button, Card, IconButton, Skeleton, StatusLabel } from "../../../src/components/primitives";
import { formatCompact, formatPercent } from "../../../src/util/format";
import { Row, Stack } from "./parts/demo";

export const meta = {
  title: "Card",
  group: "primitives",
  order: 30,
  description:
    "Surface 0, hairline, no shadow, and a size container: the header's actions sit beside the title and drop under it only when they do not fit there. data-density on the card compacts everything inside.",
};

function ServiceCard({ title = "API gateway" }: { title?: string }) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>{title}</Card.Title>
        <Card.Description>Requests per minute, last 24 hours</Card.Description>
        <Card.Actions>
          <Button variant="secondary" iconStart={<Download />}>
            Export
          </Button>
          <IconButton label="More actions" icon={<MoreHorizontal />} />
        </Card.Actions>
      </Card.Header>
      <Card.Body>
        <div className="flex flex-wrap items-baseline gap-x-r3 gap-y-r5">
          <span className="text-kpi font-semibold">{formatCompact(128_430)}</span>
          <span className="text-body-2 text-trend-good">{formatPercent(-0.042, { signDisplay: "exceptZero" })} errors</span>
        </div>
      </Card.Body>
      <Card.Footer>
        <StatusLabel tone="success" className="me-auto">
          Operational
        </StatusLabel>
        <Button variant="ghost" iconStart={<RefreshCw />}>
          Refresh
        </Button>
      </Card.Footer>
    </Card>
  );
}

export default function CardSection() {
  return (
    <Stack>
      <Row label="Wide · narrow (same card, the actions no longer fit beside the title) · compact">
        <div className="grid gap-r3 rounded-lg bg-canvas p-r3 @3xl:grid-cols-[2fr_1fr_1fr]">
          <ServiceCard />
          <ServiceCard title="Billing worker with a long service name that wraps" />
          <div data-density="compact" className="grid">
            <ServiceCard title="Compact card" />
          </div>
        </div>
      </Row>

      <Row label="Body only · loading · empty · stale">
        <div className="grid gap-r3 rounded-lg bg-canvas p-r3 @2xl:grid-cols-4">
          <Card className="p-r2">
            <p className="text-body-2 text-fg-secondary">
              A card with no parts pads itself through className.
            </p>
          </Card>
          <Card aria-busy>
            <Card.Header>
              <Skeleton className="w-1/2" label="Loading usage" />
              <Skeleton className="w-3/4 text-body-2" />
            </Card.Header>
            <Card.Body>
              <Skeleton shape="block" className="h-chart" />
            </Card.Body>
          </Card>
          <Card>
            <Card.Header>
              <Card.Title>Alerts</Card.Title>
            </Card.Header>
            <Card.Body className="text-body-2 text-fg-muted">No alerts in the last 7 days.</Card.Body>
          </Card>
          <Card>
            <Card.Header>
              <Card.Title>Queue depth</Card.Title>
              <Card.Actions>
                <Badge tone="stale">Stale · 14 min</Badge>
              </Card.Actions>
            </Card.Header>
            <Card.Body>
              <span className="text-kpi font-semibold text-fg-secondary">{formatCompact(3_912)}</span>
            </Card.Body>
          </Card>
        </div>
      </Row>

      <Row label="RTL">
        <div dir="rtl" className="rounded-lg bg-canvas p-r3">
          <Card>
            <Card.Header>
              <Card.Title>بوابة الواجهة البرمجية</Card.Title>
              <Card.Description>الطلبات في الدقيقة</Card.Description>
              <Card.Actions>
                <Button variant="secondary">تصدير</Button>
              </Card.Actions>
            </Card.Header>
            <Card.Body>{formatCompact(128_430, { locale: "ar" })}</Card.Body>
          </Card>
        </div>
      </Row>
    </Stack>
  );
}
