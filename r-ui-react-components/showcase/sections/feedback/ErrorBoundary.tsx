import { useState } from "react";

import { ErrorBoundary, ErrorFallback } from "../../../src/components/feedback";
import { Select } from "../../../src/components/form";
import { Button, Card } from "../../../src/components/primitives";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "ErrorBoundary",
  group: "feedback",
  order: 40,
  description:
    "One boundary per widget: a widget that throws becomes an ErrorFallback while its siblings keep working. Try again re-renders it (a retry that fails again keeps focus on Try again); resetKeys clear it when the input changes; details shows the error text.",
};

/** Throws while rendering when `fail` says so, like a widget handed data it cannot draw. */
function Widget({ name, value, fail }: { name: string; value: string; fail: boolean }) {
  if (fail) throw new Error(`${name}: cannot read properties of undefined (reading 'points')`);
  return (
    <div className="grid gap-r6">
      <span className="text-h3 tabular-nums">{value}</span>
      <span className="text-body-2 text-fg-secondary">{name}, last 30 days</span>
    </div>
  );
}

/** Three cards, each behind its own boundary; Revenue can be made to throw once or twice. */
function Dashboard() {
  // How many more renders Revenue fails for (0 = healthy).
  const [failures, setFailures] = useState(0);
  return (
    <div className="grid gap-r3 @2xl:grid-cols-3" data-sc="eb-dashboard">
      <Card data-sc="eb-widget-revenue">
        <Card.Header>
          <Card.Title>Revenue</Card.Title>
          <Card.Actions>
            <Button variant="secondary" onClick={() => setFailures(1)} data-sc="eb-throw">
              Throw
            </Button>
            <Button variant="secondary" onClick={() => setFailures(2)} data-sc="eb-throw-twice">
              Throw twice
            </Button>
          </Card.Actions>
        </Card.Header>
        <Card.Body className="pb-r2">
          <ErrorBoundary details onReset={() => setFailures((f) => Math.max(0, f - 1))}>
            <Widget name="Revenue" value="€48,210" fail={failures > 0} />
          </ErrorBoundary>
        </Card.Body>
      </Card>
      {[
        ["Orders", "1,284"],
        ["Refunds", "37"],
      ].map(([name, value]) => (
        <Card key={name} data-sc={`eb-widget-${name!.toLowerCase()}`}>
          <Card.Header>
            <Card.Title>{name}</Card.Title>
          </Card.Header>
          <Card.Body className="pb-r2">
            <ErrorBoundary>
              <Widget name={name!} value={value!} fail={false} />
            </ErrorBoundary>
          </Card.Body>
        </Card>
      ))}
    </div>
  );
}

const REGIONS = { eu: "€31,900", us: "$22,450", apac: null } as const;
type Region = keyof typeof REGIONS;

/** Choosing APAC (no data) throws; choosing another region clears the boundary through resetKeys. */
function ResetKeys() {
  const [region, setRegion] = useState<Region>("eu");
  const value = REGIONS[region];
  return (
    <Card>
      <Card.Header>
        <Card.Title>Revenue by region</Card.Title>
        <Card.Actions>
          <Select aria-label="Region" value={region} onValueChange={(v) => setRegion(v as Region)}>
            <option value="eu">Europe</option>
            <option value="us">United States</option>
            <option value="apac">Asia-Pacific (no data: throws)</option>
          </Select>
        </Card.Actions>
      </Card.Header>
      <Card.Body className="pb-r2">
        <ErrorBoundary resetKeys={[region]}>
          <Widget name={`Revenue ${region.toUpperCase()}`} value={value ?? ""} fail={value === null} />
        </ErrorBoundary>
      </Card.Body>
    </Card>
  );
}

const SAMPLE = new Error("Request failed with status 503: upstream connect error or disconnect/reset before headers");

export default function ErrorBoundarySection() {
  return (
    <Stack>
      <Row label="A dashboard with a boundary per widget: Throw takes down Revenue only; Try again recovers (Throw twice: the first retry fails too)">
        <Dashboard />
      </Row>

      <Row label="resetKeys: picking a region with no data throws; picking another clears it without a retry">
        <ResetKeys />
      </Row>

      <Row label="ErrorFallback alone (a failure never thrown): default · retry + details · custom message · compact · narrow · RTL">
        <div className="grid gap-r3 @2xl:grid-cols-2">
          <ErrorFallback />
          <ErrorFallback error={SAMPLE} onRetry={() => undefined} details />
          <ErrorFallback onRetry={() => undefined}>The server answered 503. Your filters are kept.</ErrorFallback>
          <div data-density="compact">
            <ErrorFallback onRetry={() => undefined} />
          </div>
          <div className="w-1/2 min-w-0">
            <ErrorFallback
              onRetry={() => undefined}
              labels={{ title: "Ein Fehler ist aufgetreten", retry: "Erneut versuchen" }}
            >
              Dieser Bereich konnte nicht angezeigt werden.
            </ErrorFallback>
          </div>
          <div dir="rtl">
            <ErrorFallback
              onRetry={() => undefined}
              labels={{ title: "حدث خطأ ما", message: "تعذر عرض هذا الجزء من الصفحة.", retry: "حاول مرة أخرى" }}
            />
          </div>
        </div>
      </Row>
    </Stack>
  );
}
