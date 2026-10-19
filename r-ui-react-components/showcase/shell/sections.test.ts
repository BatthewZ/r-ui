import { describe, expect, it, vi } from "vitest";

import { collectSections, loadModules, sectionIdOf } from "./sections";

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

  it("refuses a section whose group is not its folder's, since the id is read from the path", () => {
    const { groups, invalid } = collectSections({ "./sections/form/Stray.tsx": mod({ title: "Stray", group: "data", order: 1 }) });
    expect(groups).toEqual([]);
    expect(invalid).toEqual([{ path: "./sections/form/Stray.tsx", reason: '`meta.group` must be its folder\'s name ("form")' }]);
  });
});

describe("sectionIdOf", () => {
  it("reads the id from the path alone", () => {
    expect(sectionIdOf("./sections/data/DataTable.tsx")).toBe("data-datatable");
    expect(sectionIdOf("./sections/form/OTPInput.tsx")).toBe("form-otpinput");
    expect(sectionIdOf("./sections/form/parts/demo.ts")).toBeNull();
  });
});

describe("loadModules", () => {
  const importers = () => ({
    "./sections/form/Input.tsx": vi.fn(async () => mod({ title: "Input", group: "form", order: 20 })),
    "./sections/form/Field.tsx": vi.fn(async () => mod({ title: "Field", group: "form", order: 1 })),
    "./sections/data/Table.tsx": vi.fn(async () => mod({ title: "Table", group: "data", order: 1 })),
  });

  it("imports every section when no ids are given", async () => {
    const all = importers();
    const { groups, missing } = await loadModules(all);
    expect(groups.flatMap((g) => g.sections.map((s) => s.id))).toEqual(["form-field", "form-input", "data-table"]);
    expect(missing).toEqual([]);
    for (const importer of Object.values(all)) expect(importer).toHaveBeenCalledTimes(1);
  });

  it("imports only the sections it is asked for, and names the ids no file answers", async () => {
    const some = importers();
    const { groups, missing } = await loadModules(some, ["data-table", "form-nothing"]);
    expect(groups.flatMap((g) => g.sections.map((s) => s.id))).toEqual(["data-table"]);
    expect(missing).toEqual(["form-nothing"]);
    expect(some["./sections/data/Table.tsx"]).toHaveBeenCalledTimes(1);
    expect(some["./sections/form/Input.tsx"]).not.toHaveBeenCalled();
    expect(some["./sections/form/Field.tsx"]).not.toHaveBeenCalled();
  });

  it("lists a section whose chunk fails as invalid", async () => {
    const failing = { "./sections/data/Table.tsx": vi.fn(async () => Promise.reject(new Error("offline"))) };
    const { groups, invalid } = await loadModules(failing, ["data-table"]);
    expect(groups).toEqual([]);
    expect(invalid).toEqual([{ path: "./sections/data/Table.tsx", reason: "failed to load: Error: offline" }]);
  });
});
