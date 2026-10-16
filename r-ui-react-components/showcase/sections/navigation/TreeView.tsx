import { Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Grid } from "../../../src/components/layout";
import { TreeView } from "../../../src/components/navigation";
import { IconButton } from "../../../src/components/primitives";
import { Row } from "./parts/demo";
import { DemoRouter } from "./parts/demo-router";
import { DOCS_NAV, FILES, makeLoader, PERMISSIONS, REGIONS } from "./parts/tree-data";

export const meta = {
  title: "TreeView",
  group: "navigation",
  order: 70,
  description:
    "A hierarchy with one tab stop: Up/Down move, Right opens then enters, Left closes then climbs (mirrored right to left), Home/End, * opens the siblings, typing jumps to a label. Single selection with row actions, tri-state checks for permissions, a docs nav of router links, and children loaded on demand with a loading row and a retry.",
};

const FRAME = "min-w-0 rounded-lg border bg-surface-1 p-r5";

export default function TreeViewSection() {
  const [selected, setSelected] = useState<string | null>("tree");
  const [checked, setChecked] = useState<readonly string[]>(["billing.invoices", "people.roles.assign"]);
  const [last, setLast] = useState("—");
  const loadChildren = useMemo(() => makeLoader(), []);

  return (
    <Grid columns={{ base: 1, "@2xl": 2 }} gap="r1">
      <Row label="File browser: single selection, icons, row actions (Tab from the row reaches them), a disabled folder that still opens, a long name that wraps">
        <div className="grid min-w-0 gap-r4">
          <TreeView
            aria-label="Project files"
            data-sc="tree-files"
            items={FILES}
            selectionMode="single"
            selectedId={selected}
            onSelectedIdChange={setSelected}
            defaultExpandedIds={["src", "components", "docs"]}
            onAction={(id) => setLast(`opened ${id}`)}
            renderActions={(node, { tabIndex }) =>
              node.disabled ? null : (
                <>
                  <IconButton label={`Rename ${String(node.label)}`} icon={<Pencil />} tabIndex={tabIndex} onClick={() => setLast(`rename ${node.id}`)} />
                  <IconButton
                    label={`Delete ${String(node.label)}`}
                    icon={<Trash2 />}
                    variant="danger"
                    tabIndex={tabIndex}
                    onClick={() => setLast(`delete ${node.id}`)}
                  />
                </>
              )
            }
            className={FRAME}
          />
          <output className="text-body-2 text-fg-secondary" data-sc="tree-files-out">
            Selected: {selected ?? "—"} · Last: {last}
          </output>
        </div>
      </Row>

      <Row label="Permissions: tri-state checks; a parent checks what is under it and shows mixed; the disabled owner-only permission keeps its state">
        <div className="grid min-w-0 gap-r4">
          <TreeView
            aria-label="Role permissions"
            data-sc="tree-perms"
            items={PERMISSIONS}
            selectionMode="multiple"
            checkedIds={checked}
            onCheckedIdsChange={setChecked}
            defaultExpandedIds={["billing", "people", "people.roles"]}
            className={FRAME}
          />
          <output className="break-words text-body-2 text-fg-secondary" data-sc="tree-perms-out">
            Granted: {checked.length > 0 ? checked.join(", ") : "nothing"}
          </output>
        </div>
      </Row>

      <Row label="Docs nav: items are the RouterProvider's links; the current page is marked and its branch opens on its own">
        <DemoRouter initial="/docs/theming/themes">
          {(location) => (
            <div className="grid min-w-0 gap-r4">
              <TreeView aria-label="Documentation" data-sc="tree-nav" items={DOCS_NAV} className={FRAME} />
              <output className="text-body-2 text-fg-secondary" data-sc="tree-nav-out">
                Location: {location.pathname}
              </output>
            </div>
          )}
        </DemoRouter>
      </Row>

      <Row label="Loaded on demand: a loading row while a region's offices arrive; Antarctica fails once (press its error row to retry); Atlantis has none">
        <TreeView aria-label="Offices by region" data-sc="tree-lazy" items={REGIONS} loadChildren={loadChildren} className={FRAME} />
      </Row>
    </Grid>
  );
}
