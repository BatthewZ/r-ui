import { LayoutGrid, List } from "lucide-react";
import { type CSSProperties, useState } from "react";

import { SegmentedControl } from "../../../src/components/form";
import { useViewTransition } from "../../../src/components/motion";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "View transitions",
  group: "motion",
  order: 30,
  description:
    "useViewTransition() runs a React update inside document.startViewTransition, flushed so the new view is what the browser snapshots. Items with a view-transition-name morph to their new place. Without the API, or under reduced motion, the update simply applies.",
};

const SERVICES = ["checkout-api", "payments-worker", "search-indexer", "notifications", "image-resizer", "auth-gateway"];

export default function ViewTransitionSection() {
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const transition = useViewTransition();
  return (
    <Stack>
      <Row label="Switch the layout: each card morphs from its old box to its new one">
        <div className="flex flex-col gap-r3">
          <SegmentedControl
            aria-label="Layout"
            value={layout}
            onValueChange={(next) => void transition(() => setLayout(next === "grid" ? "grid" : "list"))}
            className="self-start"
          >
            <SegmentedControl.Item value="list" icon={<List />}>
              List
            </SegmentedControl.Item>
            <SegmentedControl.Item value="grid" icon={<LayoutGrid />}>
              Grid
            </SegmentedControl.Item>
          </SegmentedControl>
          <ul
            className={
              layout === "grid"
                ? "grid gap-r4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,var(--COLUMN-SM)),1fr))]"
                : "flex max-w-measure flex-col gap-r5"
            }
          >
            {SERVICES.map((name) => (
              <li
                key={name}
                style={{ viewTransitionName: `sc-vt-${name}` } as CSSProperties}
                className="rounded-md border border-border bg-surface-0 px-r3 py-r4 font-mono text-body-1"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      </Row>
    </Stack>
  );
}
