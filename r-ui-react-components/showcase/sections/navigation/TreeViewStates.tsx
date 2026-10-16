import { FileText, Folder } from "lucide-react";
import { useMemo } from "react";

import { Grid } from "../../../src/components/layout";
import { TreeView } from "../../../src/components/navigation";
import { Row } from "./parts/demo";
import { ARABIC, FILES, manyNodes } from "./parts/tree-data";

export const meta = {
  title: "TreeView states",
  group: "navigation",
  order: 71,
  description:
    "Empty, loading and failed trees; TreeView.Item composition; right to left (the chevron and the arrows mirror); compact density (rows follow --ROW-H, which coarse input raises to the hit floor); and 2,550 rows, of which only those in view are mounted.",
};

const FRAME = "min-w-0 rounded-lg border bg-surface-1 p-r5";
const ALL_OPEN = Array.from({ length: 50 }, (_, f) => `f${f}`);

export default function TreeViewStatesSection() {
  const many = useMemo(() => manyNodes(50), []);
  return (
    <Grid columns={{ base: 1, "@2xl": 2 }} gap="r1">
      <Row label="Empty · loading · failed">
        <div className="grid min-w-0 gap-r4">
          <TreeView aria-label="Empty folder" data-sc="tree-empty" items={[]} className={FRAME} />
          <TreeView aria-label="Loading folder" data-sc="tree-loading" items={[]} loading className={FRAME} />
          <TreeView aria-label="Unreachable folder" data-sc="tree-error" items={[]} error="The file server did not answer. Try again in a minute." className={FRAME} />
        </div>
      </Row>

      <Row label="Composed with TreeView.Item, a disabled leaf">
        <TreeView aria-label="Composed tree" data-sc="tree-composed" defaultExpandedIds={["inbox"]} selectionMode="single" className={FRAME}>
          <TreeView.Item id="inbox" label="Inbox" icon={<Folder aria-hidden />}>
            <TreeView.Item id="today" label="Today" icon={<FileText aria-hidden />} />
            <TreeView.Item id="spam" label="Spam (blocked by policy)" icon={<FileText aria-hidden />} disabled />
          </TreeView.Item>
          <TreeView.Item id="sent" label="Sent" icon={<Folder aria-hidden />}>
            <TreeView.Item id="sent-1" label="Quarterly numbers" icon={<FileText aria-hidden />} />
          </TreeView.Item>
        </TreeView>
      </Row>

      <Row label="Right to left: Left opens and enters, Right closes and climbs; the chevron points to the inline end">
        <div dir="rtl" lang="ar" className="min-w-0">
          <TreeView aria-label="الملفات" data-sc="tree-rtl" items={ARABIC} selectionMode="single" className={FRAME} />
        </div>
      </Row>

      <Row label="Compact density: shorter rows, same indent rhythm">
        <div data-density="compact" className="min-w-0">
          <TreeView aria-label="Project files (compact)" data-sc="tree-compact" items={FILES} defaultExpandedIds={["src", "docs"]} className={FRAME} />
        </div>
      </Row>

      <Row label="2,550 rows, every folder open: windowed, rows exactly --ROW-H, labels truncate">
        <TreeView
          aria-label="Reports archive"
          data-sc="tree-many"
          items={many}
          defaultExpandedIds={ALL_OPEN}
          selectionMode="single"
          className={FRAME}
        />
      </Row>
    </Grid>
  );
}
