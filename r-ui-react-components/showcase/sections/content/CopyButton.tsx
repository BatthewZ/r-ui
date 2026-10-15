import { Card, Input } from "../../../src";
import { CopyButton } from "../../../src/components/content";
import { Row, Stack } from "../primitives/parts/demo";

export const meta = {
  title: "CopyButton",
  group: "content",
  order: 10,
  description:
    "Clipboard API with a selection-copy fallback; the icon cross-fades to a check (motion tokens) and a polite status announces it. Icon-only keeps the IconButton's hit area; labelled is a Button whose width holds while its text swaps.",
};

const KEY = "sk_live_51NcRk2Lx0aQ7e9";

export default function CopyButtonSection() {
  return (
    <Stack>
      <Row label="Icon only: ghost (default) · secondary · primary · disabled">
        <div className="flex flex-wrap items-center gap-r4">
          <CopyButton value="npm install @batthewz/r-ui-react-components" />
          <CopyButton value="secondary" variant="secondary" />
          <CopyButton value="primary" variant="primary" />
          <CopyButton value="nothing" disabled />
        </div>
      </Row>

      <Row label="Labelled · translated labels · beside a read-only field">
        <div className="flex flex-wrap items-center gap-r4">
          <CopyButton value="https://example.com/invite/9f2c" showLabel labels={{ copy: "Copy invite link", copied: "Link copied" }} />
          <CopyButton value="x" showLabel variant="secondary" labels={{ copy: "Kopieren", copied: "Kopiert", failed: "Fehlgeschlagen" }} />
        </div>
        <div className="flex max-w-full items-center gap-r5">
          <Input aria-label="API key" readOnly value={KEY} className="min-w-0 flex-1 font-mono" />
          <CopyButton value={KEY} variant="secondary" labels={{ copy: "Copy API key" }} />
        </div>
      </Row>

      <Row label="Compact card · right-to-left">
        <div className="grid gap-r3 @2xl:grid-cols-2">
          <Card data-density="compact">
            <Card.Header>
              <Card.Title>Webhook secret</Card.Title>
              <Card.Actions>
                <CopyButton value="whsec_123" labels={{ copy: "Copy webhook secret" }} />
              </Card.Actions>
            </Card.Header>
          </Card>
          <div dir="rtl" className="flex items-center gap-r4">
            <span className="text-body-1">نسخ الرابط</span>
            <CopyButton value="rtl" showLabel labels={{ copy: "نسخ", copied: "تم النسخ" }} />
          </div>
        </div>
      </Row>
    </Stack>
  );
}
