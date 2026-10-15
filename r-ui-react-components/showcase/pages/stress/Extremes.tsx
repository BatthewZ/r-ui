import { Copy, FolderInput, Pencil, Trash2 } from "lucide-react";

import { type DataTableColumn, DataTable, DescriptionList, StatCard, Table } from "../../../src/components/data";
import { Pagination, Tabs } from "../../../src/components/navigation";
import { DropdownMenu } from "../../../src/components/overlays";
import { Alert, Badge, Button, Card, StatusLabel } from "../../../src/components/primitives";
import { formatCompact, formatNumber, formatPercent } from "../../../src/util/format";
import { type Service, SERVICES, STATUS_LABEL } from "../../sections/data/fixtures";
import { Case } from "./parts";

const UNBROKEN =
  "registry.example.com/payments/checkout-service@sha256:9f2c1e7a4b3d5c6e8f0a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7";
const UNBROKEN_WORD = "Donaudampfschifffahrtselektrizitätenhauptbetriebswerkbauunterbeamtengesellschaft";

const SERVICE_COLUMNS: DataTableColumn<Service>[] = [
  { id: "name", header: "Service", value: (s) => s.name, title: (s) => s.name },
  {
    id: "status",
    header: "Status",
    value: (s) => s.status,
    cell: (s) => <StatusLabel tone={s.status}>{STATUS_LABEL[s.status]}</StatusLabel>,
  },
  { id: "rps", header: "Req/s", value: (s) => s.rps ?? -1, numeric: true, cell: (s) => formatNumber(s.rps), priority: 2 },
  { id: "p95", header: "p95 ms", value: (s) => s.p95 ?? -1, numeric: true, cell: (s) => formatNumber(s.p95), priority: 3 },
];

const NUMBERS: { label: string; value: number | null }[] = [
  { label: "Max safe integer", value: Number.MAX_SAFE_INTEGER },
  { label: "Huge negative", value: -48_213_907_221.77 },
  { label: "Tiny", value: 0.000_012 },
  { label: "Zero", value: 0 },
  { label: "Missing (null)", value: null },
  { label: "Not a number", value: Number.NaN },
  { label: "Infinity", value: Number.POSITIVE_INFINITY },
];

function LongStrings() {
  return (
    <div className="grid grid-cols-1 gap-r3 @3xl:grid-cols-2">
      <Card>
        <Card.Header>
          <Card.Title>{UNBROKEN}</Card.Title>
          <Card.Description>Pulled from the registry on every deploy</Card.Description>
          <Card.Actions>
            <Button variant="secondary">Copy</Button>
          </Card.Actions>
        </Card.Header>
        <Card.Body className="flex flex-col gap-r3">
          <div className="flex min-w-0 flex-wrap gap-r4">
            <Badge tone="info">{UNBROKEN_WORD}</Badge>
          </div>
          <DescriptionList>
            <DescriptionList.Item term="Image">{UNBROKEN}</DescriptionList.Item>
            <DescriptionList.Item term="Status">
              <StatusLabel tone="warning">{UNBROKEN_WORD}</StatusLabel>
            </DescriptionList.Item>
          </DescriptionList>
        </Card.Body>
      </Card>
      <div className="flex min-w-0 flex-col gap-r3">
        <Alert tone="warning" title={UNBROKEN_WORD}>
          {UNBROKEN}
        </Alert>
        <Table variant="boxed" aria-label="Unbroken strings in cells">
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Image</Table.HeaderCell>
              <Table.HeaderCell numeric>Pulls</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            <Table.Row>
              <Table.Cell title={UNBROKEN}>{UNBROKEN}</Table.Cell>
              <Table.Cell numeric>{formatNumber(Number.MAX_SAFE_INTEGER)}</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
        <div className="flex flex-wrap gap-r4">
          <Button variant="secondary">{UNBROKEN_WORD}</Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Minimal cases that once broke the library (reported as KnownBug repros, then
 * fixed). Out in the open now, so stress-matrix's spill check guards them.
 */
function UnbrokenInEverySlot() {
  return (
    <div className="grid grid-cols-1 gap-r3 @3xl:grid-cols-2">
      <Card data-testid="regression-card-header-actions">
        <Card.Header>
          <Card.Title>Checkout service image</Card.Title>
          <Card.Actions>
            <Badge tone="info">{UNBROKEN_WORD}</Badge>
          </Card.Actions>
        </Card.Header>
      </Card>
      <Card data-testid="regression-card-description">
        <Card.Header>
          <Card.Title>Image</Card.Title>
          <Card.Description>{UNBROKEN_WORD}</Card.Description>
        </Card.Header>
      </Card>
      <DescriptionList data-testid="regression-description-term">
        <DescriptionList.Item term={UNBROKEN_WORD}>wraps fine</DescriptionList.Item>
      </DescriptionList>
      <div className="w-column-sm max-w-full">
        <StatCard
          data-testid="regression-statcard-value"
          label="Requests (all time)"
          value={formatNumber(Number.MAX_SAFE_INTEGER)}
          delta={1e12}
          sentiment="good"
        />
      </div>
    </div>
  );
}

function Numbers() {
  return (
    <div className="flex flex-col gap-r3">
      <div className="grid grid-cols-1 gap-r3 @xl:grid-cols-2 @4xl:grid-cols-4">
        <StatCard label="Requests (all time)" value={formatCompact(Number.MAX_SAFE_INTEGER)} delta={1e12} formatDelta={(d) => formatCompact(d)} sentiment="good" deltaLabel="vs last year" />
        <StatCard label="Net revenue" value={formatCompact(-48_213_907_221.77)} unit="€" delta={-0.999} formatDelta={(d) => formatPercent(d)} sentiment="bad" />
        <StatCard label="Cost per request" value={formatNumber(null)} unit="µ$" deltaLabel="No data in this range" />
        <StatCard label="Queue depth" value={formatCompact(1.2e15)} delta={0} sentiment="neutral" deltaLabel="unchanged" />
      </div>
      <Table variant="rules" aria-label="Number extremes">
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Case</Table.HeaderCell>
            <Table.HeaderCell numeric>formatNumber</Table.HeaderCell>
            <Table.HeaderCell numeric priority={2}>formatCompact</Table.HeaderCell>
            <Table.HeaderCell numeric priority={3}>formatPercent</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {NUMBERS.map((n) => (
            <Table.Row key={n.label}>
              <Table.Cell>{n.label}</Table.Cell>
              <Table.Cell numeric>{formatNumber(n.value)}</Table.Cell>
              <Table.Cell numeric priority={2}>
                {formatCompact(n.value)}
              </Table.Cell>
              <Table.Cell numeric priority={3}>
                {formatPercent(n.value)}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}

function RowCounts() {
  return (
    <div className="grid grid-cols-1 gap-r3 @3xl:grid-cols-2">
      <Case label="0 rows">
        <DataTable aria-label="No services" columns={SERVICE_COLUMNS} rows={[]} getRowKey={(s) => s.id} selectable />
      </Case>
      <Case label="1 row (the longest name, every value missing)">
        <DataTable
          aria-label="One service"
          columns={SERVICE_COLUMNS}
          rows={SERVICES.filter((s) => s.id === "recs")}
          getRowKey={(s) => s.id}
          selectable
        />
      </Case>
    </div>
  );
}

const DE_TABS = [
  { value: "overview", label: "Übersicht" },
  { value: "logs", label: "Protokolleinträge" },
  { value: "traces", label: "Ablaufverfolgungen" },
  { value: "config", label: "Konfigurationseinstellungen" },
];

function Translated() {
  return (
    <div className="flex min-w-0 flex-col gap-r3">
      <Tabs defaultValue="overview">
        <Tabs.List aria-label="Dienstdetails">
          {DE_TABS.map((t) => (
            <Tabs.Tab key={t.value} value={t.value}>
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {DE_TABS.map((t) => (
          <Tabs.Panel key={t.value} value={t.value} className="text-fg-secondary">
            Inhalt für „{t.label}“.
          </Tabs.Panel>
        ))}
      </Tabs>
      <div className="flex flex-wrap items-center gap-r4">
        <Button variant="primary">Änderungen übernehmen</Button>
        <Button variant="secondary">Dashboard exportieren</Button>
        <DropdownMenu>
          <DropdownMenu.Trigger>Weitere Aktionen</DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item icon={<Pencil />}>Umbenennen</DropdownMenu.Item>
            <DropdownMenu.Item icon={<Copy />}>Duplizieren</DropdownMenu.Item>
            <DropdownMenu.Item icon={<FolderInput />}>In einen anderen Arbeitsbereich verschieben</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item icon={<Trash2 />} tone="error">
              Dashboard endgültig löschen
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
      <Pagination
        pageCount={1_284}
        defaultPage={642}
        labels={{
          nav: "Seitennummerierung",
          previous: "Vorherige Seite",
          next: "Nächste Seite",
          page: (p) => `Seite ${p}`,
          status: (p, c) => `Seite ${p} von ${c}`,
        }}
      />
      <div className="grid grid-cols-1 gap-r3 @xl:grid-cols-2">
        <StatCard
          label="Durchschnittliche Antwortzeit (95. Perzentil)"
          value={formatNumber(212)}
          unit="ms"
          delta={38}
          sentiment="bad"
          deltaLabel="im Vergleich zu den vorherigen 24 Stunden"
        />
        <StatCard
          label="Fehlerquote aller Zahlungsdienste"
          value={formatPercent(0.0042, { maximumFractionDigits: 2 })}
          delta={-0.8}
          sentiment="good"
          deltaLabel="im Vergleich zu den vorherigen 24 Stunden"
        />
      </div>
    </div>
  );
}

const AR_TABS = [
  { value: "overview", label: "نظرة عامة" },
  { value: "logs", label: "السجلات" },
  { value: "traces", label: "التتبعات" },
];

function RightToLeft() {
  return (
    <div dir="rtl" lang="ar" data-testid="stress-rtl" className="flex min-w-0 flex-col gap-r3">
      <Tabs defaultValue="overview" variant="enclosed">
        <Tabs.List aria-label="تفاصيل الخدمة">
          {AR_TABS.map((t) => (
            <Tabs.Tab key={t.value} value={t.value}>
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {AR_TABS.map((t) => (
          <Tabs.Panel key={t.value} value={t.value} className="text-fg-secondary">
            محتوى {t.label}.
          </Tabs.Panel>
        ))}
      </Tabs>
      <div className="flex flex-wrap items-center gap-r4">
        <DropdownMenu>
          <DropdownMenu.Trigger>إجراءات</DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item icon={<Pencil />} shortcut="R">
              إعادة تسمية
            </DropdownMenu.Item>
            <DropdownMenu.Item icon={<Copy />}>تكرار</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item icon={<Trash2 />} tone="error">
              حذف
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
      <Pagination
        pageCount={24}
        defaultPage={12}
        labels={{
          nav: "ترقيم الصفحات",
          previous: "الصفحة السابقة",
          next: "الصفحة التالية",
          page: (p) => `الصفحة ${p}`,
          status: (p, c) => `الصفحة ${p} من ${c}`,
        }}
      />
      <Table variant="rules" aria-label="الخدمات">
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>الخدمة</Table.HeaderCell>
            <Table.HeaderCell truncate={false}>الحالة</Table.HeaderCell>
            <Table.HeaderCell numeric>طلب/ث</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {SERVICES.slice(0, 4).map((s, i) => (
            <Table.Row key={s.id} selected={i === 1}>
              <Table.Cell>{s.name}</Table.Cell>
              <Table.Cell truncate={false}>
                <StatusLabel tone={s.status}>{STATUS_LABEL[s.status]}</StatusLabel>
              </Table.Cell>
              <Table.Cell numeric>{formatNumber(i === 2 ? null : s.rps)}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}

export function ExtremesPanel() {
  return (
    <div className="@container flex min-w-0 flex-col gap-r1">
      <Case label="Very long unbroken strings: wrap or truncate (with the full value in title), never push the page sideways">
        <LongStrings />
      </Case>
      <Case label="An unbroken word in a card's actions and description, a list term, and a narrow KPI tile: the title keeps its room, everything wraps inside its box">
        <UnbrokenInEverySlot />
      </Case>
      <Case label="Huge, negative, tiny and missing numbers: locale-formatted, missing is “—”, never NaN">
        <Numbers />
      </Case>
      <Case label="Zero rows and one row">
        <RowCounts />
      </Case>
      <Case label="Translated (German, ~30% longer): tabs, buttons, menu, pagination, KPI labels">
        <Translated />
      </Case>
      <Case label="Right-to-left (dir=rtl): tabs, menu, pagination and a table mirror">
        <RightToLeft />
      </Case>
    </div>
  );
}
