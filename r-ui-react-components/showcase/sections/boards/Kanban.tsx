import { RotateCw } from "lucide-react";
import type { ReactNode } from "react";

import { Alert, Button, type KanbanColumn, type KanbanLabels, LocaleProvider } from "../../../src";
import { type Incident, INCIDENT_COLUMNS, IncidentBoard, INCIDENTS } from "./parts/incidents";
import { DemoLabel } from "../../shell/DemoLabel";

export const meta = {
  title: "Kanban",
  group: "boards",
  order: 10,
  description:
    "Cards in columns, moved by pointer (a short travel picks up; preview, drop line, edge scrolling, Escape cancels), by touch (hold to pick up; a moving touch scrolls) or by keys (Space or Enter, arrows mirrored right to left, Space or Enter again, Escape), every step announced. Work-in-progress limits are marked and announced, empty columns take drops, columns fold, and below about two columns the board scrolls one column at a time.",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-r5">
      <DemoLabel>{label}</DemoLabel>
      {children}
    </div>
  );
}

const ARABIC_COLUMNS: KanbanColumn[] = [
  { id: "triage", title: "الفرز", limit: 6 },
  { id: "progress", title: "قيد التنفيذ", limit: 3 },
  { id: "review", title: "المراجعة", limit: 2 },
  { id: "done", title: "تم" },
];

const ARABIC_INCIDENTS: Incident[] = [
  { id: "ar-1", columnId: "triage", key: "INC-3101", title: "أخطاء 5xx مرتفعة في الدفع", severity: 1, service: "checkout", assignee: "Mia Rossi" },
  { id: "ar-2", columnId: "triage", key: "INC-3102", title: "تأخر البحث", severity: 2, service: "search" },
  { id: "ar-3", columnId: "progress", key: "INC-3103", title: "تكرار إشعارات الدفع", severity: 2, service: "payments", assignee: "Ana Lima" },
  { id: "ar-4", columnId: "review", key: "INC-3104", title: "مهلة تنزيل الفواتير", severity: 3, service: "billing" },
];

const ARABIC_LABELS: Partial<KanbanLabels> = {
  instructions: "اضغط مسافة أو Enter لالتقاط هذه البطاقة. ثم استخدم مفاتيح الأسهم لتحريكها، ومسافة أو Enter لإفلاتها، وEscape للإلغاء.",
  empty: "لا توجد بطاقات",
  loading: "جارٍ تحميل البطاقات",
  count: (count, limit) => (limit === undefined ? `${count} بطاقات` : `${count} بطاقات، الحد ${limit}`),
  overLimit: "تجاوز الحد",
  collapse: (column) => `طي ${column}`,
  expand: (column) => `توسيع ${column}`,
  pickedUp: (card, column, position, total) => `تم التقاط ${card}. ${column}، الموضع ${position} من ${total}.`,
  moved: (column, position, total) => `نُقلت إلى ${column}، الموضع ${position} من ${total}.`,
  limitExceeded: (column, count, limit) => `${column} تجاوز حده: ${count} من ${limit}.`,
  dropped: (card, column, position, total) => `أُفلتت ${card} في ${column}، الموضع ${position} من ${total}.`,
  cancelled: (card, column, position, total) => `أُلغي النقل. ${card} في ${column}، الموضع ${position} من ${total}.`,
};

/** Bounded, so each column scrolls its own cards (and a drag near a column's edge scrolls it). */
const BOUNDED = "h-[calc(var(--ROW-H)*13)]";

export default function KanbanSection() {
  return (
    <div className="flex flex-col gap-r2">
      <Row label="Incident board: limits on In progress (3) and Review (2, over it), a long unbroken title, an acknowledge button inside every card, an add slot per column; Triage scrolls">
        <IncidentBoard aria-label="Incidents" data-sc="kanban-incidents" className={BOUNDED} />
      </Row>

      <Row label="Narrow container: one column at a time, snapping (the snap lets go while a card is dragged)">
        <div className="min-w-0 max-w-column-lg">
          <IncidentBoard aria-label="Incidents, narrow" data-sc="kanban-narrow" className={BOUNDED} />
        </div>
      </Row>

      <Row label="Compact density, collapsible columns (Done starts folded and still takes drops at its end)">
        <div data-density="compact" className="min-w-0">
          <IncidentBoard
            aria-label="Incidents, compact"
            data-sc="kanban-compact"
            collapsible
            defaultCollapsed={["done"]}
            className={BOUNDED}
          />
        </div>
      </Row>

      <Row label="Right to left, translated: Left moves toward the next column">
        <LocaleProvider dir="rtl" locale="ar" labels={{ Kanban: ARABIC_LABELS }}>
          <IncidentBoard
            aria-label="الحوادث"
            data-sc="kanban-rtl"
            columns={ARABIC_COLUMNS}
            initial={ARABIC_INCIDENTS}
            addLabel="إضافة حادثة"
            words={{ acknowledge: "إقرار", severity: "خطورة" }}
          />
        </LocaleProvider>
      </Row>

      <Row label="Empty: every column says so and takes drops">
        <IncidentBoard aria-label="Incidents, empty" data-sc="kanban-empty" initial={[]} footer={false} />
      </Row>

      <Row label="Loading · disabled (cards and their buttons work; nothing moves)">
        <div className="grid min-w-0 gap-r3">
          <IncidentBoard aria-label="Incidents, loading" data-sc="kanban-loading" loading footer={false} />
          <IncidentBoard
            aria-label="Incidents, read only"
            data-sc="kanban-disabled"
            disabled
            footer={false}
            columns={INCIDENT_COLUMNS.slice(0, 3)}
            initial={INCIDENTS.filter((i) => i.columnId !== "triage")}
          />
        </div>
      </Row>

      <Row label="Error: the board could not load (the page shows why, and a retry, in its place)">
        <Alert
          tone="error"
          title="The board could not load"
          actions={
            <Button variant="secondary" iconStart={<RotateCw />}>
              Retry
            </Button>
          }
        >
          The incident service did not answer within 10 seconds.
        </Alert>
      </Row>
    </div>
  );
}
