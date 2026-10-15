import { ArrowRight, Download, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "../../../src/components/primitives";
import { Row, Stack } from "./parts/demo";

export const meta = {
  title: "Button",
  group: "primitives",
  order: 10,
  description:
    "Four variants at h-control; loading keeps the width; aria-disabled stays focusable. Flip density and input: the height follows --CONTROL-H.",
};

const VARIANTS = ["primary", "secondary", "ghost", "danger"] as const;

export default function ButtonSection() {
  const [busy, setBusy] = useState(false);
  const save = () => {
    setBusy(true);
    window.setTimeout(() => setBusy(false), 1600);
  };

  return (
    <Stack>
      <Row label="Variants">
        <div className="flex flex-wrap items-center gap-r4">
          {VARIANTS.map((v) => (
            <Button key={v} variant={v} data-testid={`button-${v}`}>
              {v === "danger" ? "Delete project" : v.charAt(0).toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </div>
      </Row>

      <Row label="With icons">
        <div className="flex flex-wrap items-center gap-r4">
          <Button iconStart={<Plus />}>New report</Button>
          <Button variant="secondary" iconStart={<Download />}>
            Export CSV
          </Button>
          <Button variant="ghost" iconEnd={<ArrowRight />}>
            View all
          </Button>
          <Button variant="danger" iconStart={<Trash2 />}>
            Delete
          </Button>
        </div>
      </Row>

      <Row label="Disabled (native) · aria-disabled (focusable) · loading">
        <div className="flex flex-wrap items-center gap-r4">
          {VARIANTS.map((v) => (
            <Button key={v} variant={v} disabled>
              Disabled
            </Button>
          ))}
          <Button variant="secondary" aria-disabled>
            Aria-disabled
          </Button>
          {VARIANTS.map((v) => (
            <Button key={`l-${v}`} variant={v} loading>
              Saving changes
            </Button>
          ))}
        </div>
      </Row>

      <Row label="Loading toggles without a width jump (click)">
        <div className="flex flex-wrap items-center gap-r4">
          <Button loading={busy} onClick={save} iconStart={<Download />}>
            Download report
          </Button>
        </div>
      </Row>

      <Row label="Long label in a narrow box truncates (title on hover is the caller's)">
        <div className="w-1/2 min-w-0 rounded-md border border-dashed border-border-strong p-r5">
          <Button variant="secondary" title="Synchroniser toutes les sources de données maintenant">
            Synchroniser toutes les sources de données maintenant
          </Button>
        </div>
      </Row>

      <Row label="Compact subtree · inside prose (stays UI scale) · RTL">
        <div className="flex flex-wrap items-start gap-r2">
          <div data-density="compact" className="flex items-center gap-r4 rounded-md border p-r4">
            <Button>Compact</Button>
            <Button variant="secondary">Cancel</Button>
          </div>
          <div className="prose">
            <p>
              Prose leading around a <Button variant="secondary">button</Button> that keeps the control height.
            </p>
          </div>
          <div dir="rtl" className="flex items-center gap-r4">
            <Button iconEnd={<ArrowRight />}>متابعة</Button>
            <Button variant="ghost">إلغاء</Button>
          </div>
        </div>
      </Row>
    </Stack>
  );
}
