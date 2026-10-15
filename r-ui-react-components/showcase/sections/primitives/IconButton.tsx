import { Bell, Bold, Pencil, Plus, Settings, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Button, IconButton } from "../../../src/components/primitives";
import { Row, Stack } from "./parts/demo";

export const meta = {
  title: "IconButton",
  group: "primitives",
  order: 11,
  description:
    "A compact square named by `label`. Its hit area is an invisible ::before of at least --HIT-MIN (tinted below when shown); switch Input to coarse to watch it grow while the visual does not.",
};

export default function IconButtonSection() {
  const [showHit, setShowHit] = useState(false);
  const [bold, setBold] = useState(true);
  const hit = showHit ? "before:bg-focus/25" : undefined;

  return (
    <Stack>
      <Row label="Variants: ghost (default) · secondary · primary · danger">
        <div className="flex flex-wrap items-center gap-r4">
          <IconButton label="Settings" icon={<Settings />} className={hit} />
          <IconButton label="Notifications" icon={<Bell />} variant="secondary" className={hit} />
          <IconButton label="Add widget" icon={<Plus />} variant="primary" className={hit} />
          <IconButton label="Delete widget" icon={<Trash2 />} variant="danger" className={hit} />
          <Button variant="secondary" onClick={() => setShowHit((v) => !v)} aria-pressed={showHit}>
            {showHit ? "Hide hit areas" : "Show hit areas"}
          </Button>
        </div>
      </Row>

      <Row label="Toggle (aria-pressed) · disabled · aria-disabled">
        <div className="flex flex-wrap items-center gap-r4">
          <IconButton label="Bold" icon={<Bold />} aria-pressed={bold} onClick={() => setBold((b) => !b)} />
          <IconButton label="Edit" icon={<Pencil />} disabled />
          <IconButton label="Delete" icon={<Trash2 />} variant="secondary" aria-disabled />
        </div>
      </Row>

      <Row label="Dense toolbar: on coarse input a hit area never grows back over the neighbour before it, so each visible box keeps its own presses">
        <div className="flex items-center gap-r6 self-start rounded-md border p-r6">
          {[Bold, Pencil, Trash2, Settings].map((Icon, i) => (
            <IconButton key={i} label={["Bold", "Edit", "Delete", "Settings"][i] ?? ""} icon={<Icon />} className={hit} />
          ))}
        </div>
      </Row>

      <Row label="Beside a Button: the square stays compact; compact density">
        <div className="flex flex-wrap items-center gap-r2">
          <div className="flex items-center gap-r5">
            <Button variant="secondary">Filter</Button>
            <IconButton label="Close" icon={<X />} className={hit} />
          </div>
          <div data-density="compact" className="flex items-center gap-r5">
            <Button variant="secondary">Filter</Button>
            <IconButton label="Close (compact)" icon={<X />} className={hit} />
          </div>
        </div>
      </Row>
    </Stack>
  );
}
