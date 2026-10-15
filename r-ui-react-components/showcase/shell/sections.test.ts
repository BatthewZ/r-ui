import { describe, expect, it } from "vitest";

import { collectSections } from "./sections";

const Demo = () => null;
const mod = (meta: unknown, component: unknown = Demo) => ({ meta, default: component });

describe("collectSections", () => {
  it("groups by meta.group in the known group order, then sorts by order and title", () => {
    const { groups, invalid } = collectSections({
      "./sections/form/Input.tsx": mod({ title: "Input", group: "form", order: 20 }),
      "./sections/primitives/Button.tsx": mod({ title: "Button", group: "primitives", order: 10 }),
      "./sections/form/Checkbox.tsx": mod({ title: "Checkbox", group: "form", order: 20 }),
      "./sections/form/Field.tsx": mod({ title: "Field", group: "form", order: 1 }),
      "./sections/zeta/Thing.tsx": mod({ title: "Thing", group: "zeta", order: 0 }),
      "./sections/alpha/Other.tsx": mod({ title: "Other", group: "alpha", order: 0 }),
    });
    expect(invalid).toEqual([]);
    expect(groups.map((g) => g.group)).toEqual(["primitives", "form", "alpha", "zeta"]);
    expect(groups[1]?.sections.map((s) => s.meta.title)).toEqual(["Field", "Checkbox", "Input"]);
  });

  it("derives a stable, unique anchor id from the group and the file name", () => {
    const { groups } = collectSections({
      "./sections/data/DataTable.tsx": mod({ title: "Data table", group: "data", order: 0 }),
    });
    expect(groups[0]?.sections[0]?.id).toBe("data-datatable");
  });

  it("reports a malformed section instead of dropping it silently", () => {
    const { groups, invalid } = collectSections({
      "./sections/form/NoMeta.tsx": { default: Demo },
      "./sections/form/NoOrder.tsx": mod({ title: "X", group: "form" }),
      "./sections/form/NoComponent.tsx": { meta: { title: "Y", group: "form", order: 1 } },
    });
    expect(groups).toEqual([]);
    expect(invalid).toEqual([
      { path: "./sections/form/NoComponent.tsx", reason: "no default-exported component" },
      { path: "./sections/form/NoMeta.tsx", reason: "no `meta` export" },
      { path: "./sections/form/NoOrder.tsx", reason: "`meta.order` must be a number" },
    ]);
  });
});
