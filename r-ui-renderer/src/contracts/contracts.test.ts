// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as library from "@batthewz/r-ui-react-components";
import { describe, expect, it } from "vitest";

import { isExportedComponent } from "../registry/registry";
import { BUILTIN_CONTRACTS } from "../spec/builtins";
import { URL_PROPS as UNIVERSAL_URL_PROPS } from "../spec/policy";
import type { ComponentContract, PropPath } from "../spec/types";
import { nameRole } from "../spec/contract-facts";
import { ALWAYS_DROPPED, DROPPED_PROPS, ELEMENT_PROPS, HEADING_LEVEL_PROPS } from "./curated/sinks";
import { DOM_NAMES, FIELD_NAMES, OWN_NAMES } from "./curated/structure";
import { DATES_READ_AS_TEXT, DOCUMENT_PROPS } from "./curated/values";
import {
  bridgedPaths,
  contractFor,
  CURATED_FIELDS,
  DECLARED_PATHS,
  type DeclaredPaths,
  defaultContracts,
  droppedPropsFor,
  exclusionFor,
  extendContracts,
  isWithin,
  LIBRARY,
  LIBRARY_COMPONENTS,
  NOT_ADDRESSABLE,
} from "./index";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Every component and part the namespace exports at runtime, as a document spells it. */
function runtimeNames(namespace: { readonly [name: string]: unknown }): string[] {
  const names: string[] = [];
  for (const [name, value] of Object.entries(namespace)) {
    if (!isExportedComponent(name, value)) continue;
    names.push(name);
    for (const [part, member] of Object.entries(value as object)) {
      if (isExportedComponent(part, member)) names.push(`${name}.${part}`);
    }
  }
  return names.sort();
}

// ---------------------------------------------------------------------------
// The barrel gate

interface BarrelInput {
  readonly runtime: readonly string[];
  readonly generated: readonly string[];
  readonly addressable: readonly string[];
  readonly exclusions: readonly string[];
}

/** The barrel's components are exactly the addressable ones plus the excluded ones, and every exclusion names one. */
function barrelProblems({ runtime, generated, addressable, exclusions }: BarrelInput): string[] {
  const problems: string[] = [];
  const live = new Set(runtime);
  const excluded = new Set(exclusions);
  const coveredBy = (name: string) => (excluded.has(name) ? name : excluded.has(name.split(".")[0] as string) ? name.split(".")[0] : null);
  for (const name of runtime) if (!generated.includes(name)) problems.push(`${name}: exported at runtime, missing from the generated contracts (stale)`);
  for (const name of generated) if (!live.has(name)) problems.push(`${name}: in the generated contracts, no longer exported (stale)`);
  for (const name of runtime) {
    const isAddressable = addressable.includes(name);
    const exclusion = coveredBy(name);
    if (!isAddressable && exclusion === null) problems.push(`${name}: neither addressable nor excluded`);
    if (isAddressable && exclusion !== null) problems.push(`${name}: addressable and excluded (by ${exclusion})`);
  }
  for (const name of addressable) if (!live.has(name)) problems.push(`${name}: addressable but not exported`);
  for (const name of exclusions) {
    if (!live.has(name)) problems.push(`${name}: excluded but names nothing the barrel exports`);
    else if (name.includes(".") && excluded.has(name.split(".")[0] as string)) problems.push(`${name}: excluded twice (its root is)`);
  }
  return problems;
}

describe("the barrel gate", () => {
  const runtime = runtimeNames(library);
  const builtins = Object.keys(BUILTIN_CONTRACTS);
  const addressable = Object.keys(defaultContracts).filter((name) => !builtins.includes(name));

  it("goes red on a stale generation, an unclassified export, a double classification and an exclusion naming nothing", () => {
    const problems = barrelProblems({
      runtime: ["Card", "Card.Header", "Kanban", "Fresh"],
      generated: ["Card", "Card.Header", "Kanban", "Gone"],
      addressable: ["Card", "Card.Header", "Kanban"],
      exclusions: ["Kanban", "Card.Header", "Nothing", "Kanban.Part"],
    });
    expect(problems).toEqual([
      "Fresh: exported at runtime, missing from the generated contracts (stale)",
      "Gone: in the generated contracts, no longer exported (stale)",
      "Card.Header: addressable and excluded (by Card.Header)",
      "Kanban: addressable and excluded (by Kanban)",
      "Fresh: neither addressable nor excluded",
      "Nothing: excluded but names nothing the barrel exports",
      "Kanban.Part: excluded but names nothing the barrel exports",
    ]);
  });

  it("holds for the installed library: its components are the contracts' names plus NOT_ADDRESSABLE", () => {
    expect(runtime.length).toBeGreaterThan(150);
    expect(addressable.length).toBeGreaterThan(150);
    expect(barrelProblems({ runtime, generated: Object.keys(LIBRARY_COMPONENTS), addressable, exclusions: Object.keys(NOT_ADDRESSABLE) })).toEqual([]);
  });

  it("keeps the built-ins clear of library names", () => {
    expect(builtins.filter((name) => runtime.includes(name))).toEqual([]);
  });

  it("lists exactly the addressable names in the registry", async () => {
    const { defaultRegistry, listRegistryNames, lookupComponent } = await import("../registry/registry");
    const { listComponentNames } = await import("../registry/names");
    expect(listRegistryNames(defaultRegistry)).toEqual(listComponentNames(defaultContracts));
    expect(lookupComponent(defaultRegistry, "Card.Header")).toBe(library.Card.Header);
    expect(lookupComponent(defaultRegistry, "TreeView.Item")).toBeUndefined();
    expect(lookupComponent(defaultRegistry, "Kanban")).toBeUndefined();
    expect(lookupComponent(defaultRegistry, "toString")).toBeUndefined();
    expect(lookupComponent(defaultRegistry, "Card.constructor")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Drift: every curated entry names a component and a path the library declares

/** Every path a curated table names, per component. Derived from the same map the fold reads. */
function curatedPaths(): { readonly table: string; readonly name: string; readonly path: PropPath }[] {
  const out: { table: string; name: string; path: PropPath }[] = [];
  const keyed = (table: string, name: string, value: object) => {
    for (const path of Object.keys(value)) out.push({ table, name, path });
  };
  const listed = (table: string, name: string, value: readonly string[]) => {
    for (const path of value) out.push({ table, name, path });
  };
  for (const [field, table] of Object.entries(CURATED_FIELDS)) {
    for (const [name, value] of Object.entries(table as Record<string, unknown>)) {
      if (Array.isArray(value)) listed(field, name, value as string[]);
      else if (typeof value === "object" && value !== null) keyed(field, name, value);
    }
  }
  for (const [name, value] of Object.entries(DROPPED_PROPS)) listed("droppedProps", name, value);
  for (const [name, value] of Object.entries(DATES_READ_AS_TEXT)) listed("DATES_READ_AS_TEXT", name, value);
  for (const [name, coercions] of Object.entries(CURATED_FIELDS.coercions)) {
    for (const coercion of Object.values(coercions)) if (coercion.kind === "accessor") out.push({ table: "coercions.to", name, path: coercion.to });
  }
  return out;
}

/** Fields whose entries are document props rather than library paths. */
const DOCUMENT_SIDE = new Set(["coercions"]);

function declares(paths: DeclaredPaths | undefined, name: string, path: PropPath): boolean {
  if (paths?.paths.includes(path)) return true;
  return (DOCUMENT_PROPS[name] ?? []).some((prop) => prop.name === path);
}

describe("curated tables against the library's declarations", () => {
  const entries = curatedPaths();

  it("name only addressable components", () => {
    const names = new Set<string>();
    for (const table of Object.values(CURATED_FIELDS)) for (const name of Object.keys(table)) names.add(name);
    for (const name of Object.keys(DROPPED_PROPS)) names.add(name);
    for (const name of Object.keys(DOCUMENT_PROPS)) names.add(name);
    expect(names.size).toBeGreaterThan(60);
    const wrong = [...names].filter((name) => !Object.hasOwn(LIBRARY_COMPONENTS, name) || exclusionFor(name));
    expect(wrong).toEqual([]);
  });

  it("name only paths the declarations allow (drift)", () => {
    expect(entries.length).toBeGreaterThan(150);
    const drift = entries
      .filter(({ table, name, path }) => !(DOCUMENT_SIDE.has(table) && declares(undefined, name, path)))
      .filter(({ name, path }) => !declares(DECLARED_PATHS[name], name, path))
      .map(({ table, name, path }) => `${table}: ${name}.${path}`);
    expect(drift).toEqual([]);
  });

  it("goes red on a renamed prop", () => {
    expect(declares(DECLARED_PATHS.Testimonial, "Testimonial", "sourceUrl")).toBe(true);
    expect(declares(DECLARED_PATHS.Testimonial, "Testimonial", "sourceURL")).toBe(false);
    expect(declares(DECLARED_PATHS.TreeView, "TreeView", "items[].hrefs")).toBe(false);
  });

  it("bound heading levels and element tags within what the library's own type allows", () => {
    const outside: string[] = [];
    const check = (name: string, prop: string, values: readonly (string | number)[]) => {
      const declared = LIBRARY_COMPONENTS[name]?.propEnums?.[prop];
      if (!declared) return;
      for (const value of values) if (!declared.includes(value)) outside.push(`${name}.${prop}: ${value}`);
    };
    for (const [name, props] of Object.entries(HEADING_LEVEL_PROPS)) for (const [prop, levels] of Object.entries(props)) check(name, prop, levels);
    for (const [name, props] of Object.entries(ELEMENT_PROPS)) for (const [prop, tags] of Object.entries(props)) check(name, prop, tags);
    expect(outside).toEqual([]);
    expect(LIBRARY_COMPONENTS.Wizard?.propEnums?.headingLevel).toEqual([2, 3, 4, 5, 6]);
  });
});

// ---------------------------------------------------------------------------
// What `name` means: every library component that declares its own is decided

/** Problems with the classification of the components whose own props include `name`. */
function nameProblems(declaring: readonly string[], tables: { readonly [table: string]: readonly string[] }): string[] {
  const problems: string[] = [];
  for (const name of declaring) {
    const in_ = Object.keys(tables).filter((table) => tables[table]?.includes(name));
    if (in_.length === 0) problems.push(`${name}: declares \`name\`, classified nowhere`);
    if (in_.length > 1) problems.push(`${name}: classified in ${in_.join(" and ")}`);
  }
  for (const [table, names] of Object.entries(tables)) {
    for (const name of names) if (!declaring.includes(name)) problems.push(`${table}: ${name} declares no own \`name\``);
  }
  return problems;
}

describe("what `name` means", () => {
  it("goes red on an unclassified, a doubly classified and a stale entry", () => {
    expect(nameProblems(["Gauge", "Dial", "Avatar"], { dom: ["Dial", "Avatar"], own: ["Avatar", "Knob"] })).toEqual([
      "Gauge: declares `name`, classified nowhere",
      "Avatar: classified in dom and own",
      "own: Knob declares no own `name`",
    ]);
  });

  it("is decided for every library component that declares its own `name`", () => {
    const declaring = Object.entries(LIBRARY_COMPONENTS)
      .filter(([name, generated]) => !exclusionFor(name) && generated.props.some((prop) => prop.name === "name"))
      .map(([name]) => name);
    expect(declaring.length).toBeGreaterThan(10);
    const tables = { DOM_NAMES: Object.keys(DOM_NAMES), FIELD_NAMES: Object.keys(FIELD_NAMES), OWN_NAMES: Object.keys(OWN_NAMES) };
    expect(nameProblems(declaring, tables)).toEqual([]);
  });

  it("reads a native DOM name off the declarations, and defaults to the component's own meaning", () => {
    for (const name of ["Input", "Textarea", "Select", "Checkbox", "Switch", "Button", "Form"]) {
      expect(nameRole(defaultContracts[name]), name).toBe("dom");
    }
    expect(nameRole(defaultContracts.Slider)).toBe("dom");
    expect(nameRole(defaultContracts.Field)).toBe("field");
    expect(nameRole(defaultContracts.Avatar)).toBe("own");
    expect(nameRole(defaultContracts.Icon)).toBe("own");
    expect(nameRole(defaultContracts.Card)).toBe("own");
    expect(nameRole(undefined)).toBe("own");
  });
});

// ---------------------------------------------------------------------------
// Omission: what the declarations type as un-JSON-able must be decided somewhere

/** `path` is covered by an entry of `list`, itself or an ancestor. */
const coveredBy = (path: PropPath, list: readonly PropPath[]) => list.some((entry) => isWithin(path, entry));

function omissions(name: string, declared: DeclaredPaths, contract: ComponentContract): string[] {
  const problems: string[] = [];
  const dropped = contract.droppedProps ?? [];
  const bridged = bridgedPaths(name);
  const handled = (path: PropPath) => coveredBy(path, dropped) || coveredBy(path, bridged);
  for (const path of declared.dates ?? []) {
    const decided = [...Object.keys(contract.dateProps ?? {}), ...(DATES_READ_AS_TEXT[name] ?? [])];
    if (!coveredBy(path, decided) && !handled(path)) problems.push(`${name}.${path}: takes a Date; no dateProps entry`);
  }
  for (const path of declared.sets ?? []) {
    if (!(contract.setProps ?? []).includes(path) && !handled(path)) problems.push(`${name}.${path}: takes a Set; no setProps entry`);
  }
  for (const path of declared.regexps ?? []) {
    if (!Object.hasOwn(contract.coercions ?? {}, path) && !handled(path)) problems.push(`${name}.${path}: takes a RegExp; no coercion`);
  }
  for (const path of declared.functions ?? []) {
    if (/(^|\.)on[A-Z][^.[]*$/.test(path) || handled(path)) continue;
    problems.push(`${name}.${path}: takes only a function; neither bridged nor dropped`);
  }
  const events = contract.eventValue ?? {};
  for (const path of declared.dateCallbacks ?? []) {
    if (handled(path)) continue;
    if (!["date", "datetime", "dateRange"].includes(events[path] ?? "")) problems.push(`${name}.${path}: reports a Date; no eventValue entry`);
  }
  for (const path of declared.setCallbacks ?? []) {
    if (handled(path)) continue;
    if (events[path] !== "set") problems.push(`${name}.${path}: reports a Set; no eventValue entry`);
  }
  for (const path of contract.nodeProps ?? []) {
    if (!path.includes(".") && !path.includes("[") && /^icon/i.test(path) && !(contract.iconProps ?? []).includes(path)) {
      problems.push(`${name}.${path}: an icon slot without an iconProps entry`);
    }
  }
  return problems;
}

describe("omission: every un-JSON-able prop the declarations show is decided", () => {
  it("goes red on an undecided Date, Set, RegExp, function, callback and icon slot", () => {
    const declared: DeclaredPaths = {
      paths: [],
      dates: ["when"],
      sets: ["picked"],
      regexps: ["split"],
      functions: ["render", "onChange", "labels.count"],
      dateCallbacks: ["onPick"],
      setCallbacks: ["onSelect"],
    };
    expect(omissions("Aurora", declared, { category: "x", nodeProps: ["icon", "items[].icon"] })).toEqual([
      "Aurora.when: takes a Date; no dateProps entry",
      "Aurora.picked: takes a Set; no setProps entry",
      "Aurora.split: takes a RegExp; no coercion",
      "Aurora.render: takes only a function; neither bridged nor dropped",
      "Aurora.labels.count: takes only a function; neither bridged nor dropped",
      "Aurora.onPick: reports a Date; no eventValue entry",
      "Aurora.onSelect: reports a Set; no eventValue entry",
      "Aurora.icon: an icon slot without an iconProps entry",
    ]);
  });

  it("holds for every addressable component", () => {
    let checked = 0;
    const problems: string[] = [];
    for (const [name, contract] of Object.entries(defaultContracts)) {
      const declared = DECLARED_PATHS[name];
      if (!declared) continue;
      checked += (declared.dates?.length ?? 0) + (declared.sets?.length ?? 0) + (declared.functions?.length ?? 0);
      problems.push(...omissions(name, declared, contract));
    }
    expect(checked).toBeGreaterThan(100);
    expect(problems).toEqual([]);
  });

  it("drops what no document may set wherever the library declares it", () => {
    for (const [name, paths] of Object.entries(DECLARED_PATHS)) {
      if (exclusionFor(name)) continue;
      for (const prop of ALWAYS_DROPPED) {
        if (paths.paths.includes(prop)) expect(droppedPropsFor(name), `${name}.${prop}`).toContain(prop);
      }
    }
    expect(droppedPropsFor("Dialog.Trigger")).toContain("asChild");
    expect(droppedPropsFor("Calendar")).toContain("locale");
  });
});

// ---------------------------------------------------------------------------
// The fold: the assembled view carries every curated and generated entry

describe("the assembled contracts", () => {
  it("carry every curated table entry, field by field (fold gate)", () => {
    let folded = 0;
    for (const [field, table] of Object.entries(CURATED_FIELDS)) {
      const entries = Object.entries(table as Record<string, unknown>);
      expect(entries.length, field).toBeGreaterThan(0);
      for (const [name, value] of entries) {
        expect(contractFor(defaultContracts, name)?.[field as keyof ComponentContract], `${name}.${field}`).toBe(value);
        folded += 1;
      }
    }
    expect(folded).toBeGreaterThan(100);
  });

  it("carry the curated drops, the document props and every generated prop that is not dropped", () => {
    for (const [name, dropped] of Object.entries(DROPPED_PROPS)) {
      expect(defaultContracts[name]?.droppedProps, name).toEqual(expect.arrayContaining([...dropped]));
    }
    for (const [name, extra] of Object.entries(DOCUMENT_PROPS)) {
      for (const prop of extra) expect(defaultContracts[name]?.props, name).toContainEqual(prop);
    }
    for (const [name, generated] of Object.entries(LIBRARY_COMPONENTS)) {
      if (exclusionFor(name)) {
        expect(contractFor(defaultContracts, name), name).toBeUndefined();
        continue;
      }
      const contract = defaultContracts[name] as ComponentContract;
      const dropped = contract.droppedProps ?? [];
      const replaced = (DOCUMENT_PROPS[name] ?? []).map((p) => p.name);
      for (const prop of generated.props) {
        if (dropped.includes(prop.name) || replaced.includes(prop.name)) continue;
        expect(contract.props, `${name}.${prop.name}`).toContainEqual(prop);
      }
      expect(contract.category).toBe(generated.category);
      expect(contract.slots).toBe(generated.slots);
      expect(Boolean(contract.nativeAttributes)).toBe(Boolean(generated.nativeAttributes));
      expect(Boolean(contract.domName), `${name}.domName`).toBe(Boolean(generated.domName) || Object.hasOwn(DOM_NAMES, name));
      for (const [prop, values] of Object.entries(generated.propEnums ?? {})) {
        if (!dropped.includes(prop)) expect(contract.propEnums?.[prop], `${name}.${prop}`).toBe(values);
      }
      for (const path of generated.nodeProps ?? []) {
        if (!coveredBy(path, dropped)) expect(contract.nodeProps, `${name}.${path}`).toContain(path);
      }
    }
  });

  it("carry the built-ins as ordinary records", () => {
    for (const [name, contract] of Object.entries(BUILTIN_CONTRACTS)) expect(defaultContracts[name]).toBe(contract);
  });

  it("never list a dropped prop as settable", () => {
    for (const [name, contract] of Object.entries(defaultContracts)) {
      const settable = new Set((contract.props ?? []).map((p) => p.name));
      for (const path of contract.droppedProps ?? []) expect(settable.has(path), `${name}.${path}`).toBe(false);
    }
  });

  it("route every curated URL through a URL rule, judged case-insensitively", () => {
    const universal = new Set<string>(UNIVERSAL_URL_PROPS);
    for (const [name, contract] of Object.entries(defaultContracts)) {
      for (const path of [...(contract.urlProps ?? []), ...(contract.imageProps ?? [])]) {
        expect(universal.has(path.toLowerCase()), `${name}.${path} restates a universal URL prop`).toBe(false);
      }
    }
  });
});

describe("contract lookups", () => {
  it("have a null prototype and read own properties only", () => {
    expect(Object.getPrototypeOf(defaultContracts)).toBeNull();
    const plain: { readonly [name: string]: ComponentContract } = { Card: { category: "primitives" } };
    expect(contractFor(plain, "toString")).toBeUndefined();
    expect(contractFor(plain, "constructor")).toBeUndefined();
    expect(contractFor(plain, "Card")).toEqual({ category: "primitives" });
  });

  it("extend per field, never mutating, with a null-prototype result", () => {
    const before = defaultContracts.Banner;
    const extra = JSON.parse('{"Banner": {"note": "Aurora banners only."}, "Gauge": {"props": []}, "__proto__": {"category": "x"}}');
    const next = extendContracts(defaultContracts, extra);
    expect(next.Banner?.note).toBe("Aurora banners only.");
    expect(next.Banner?.droppedProps).toBe(before?.droppedProps);
    expect(next.Gauge?.category).toBe("custom");
    expect(defaultContracts.Banner).toBe(before);
    expect(defaultContracts.Gauge).toBeUndefined();
    expect(Object.getPrototypeOf(next)).toBeNull();
    expect(Object.hasOwn(next, "__proto__")).toBe(true);
    expect(({} as { category?: string }).category).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// The installed library is the one the peer range claims

/** Whether `version` satisfies `range`: `^x.y.z`, or comparators (`>=a <b`). Anything else throws. */
function satisfies(version: string, range: string): boolean {
  const parse = (v: string) => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
    if (!match) throw new Error(`not a plain version: "${v}"`);
    return match.slice(1).map(Number) as [number, number, number];
  };
  const compare = (a: readonly number[], b: readonly number[]) => {
    for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return (a[i] as number) - (b[i] as number);
    return 0;
  };
  const v = parse(version);
  const caret = /^\^(.+)$/.exec(range.trim());
  if (caret) {
    const low = parse(caret[1] as string);
    const high = low[0] > 0 ? [low[0] + 1, 0, 0] : low[1] > 0 ? [0, low[1] + 1, 0] : [0, 0, low[2] + 1];
    return compare(v, low) >= 0 && compare(v, high) < 0;
  }
  return range
    .trim()
    .split(/\s+/)
    .every((comparator) => {
      const match = /^(>=|<=|>|<)(.+)$/.exec(comparator);
      if (!match) throw new Error(`unsupported range "${range}"`);
      const order = compare(v, parse(match[2] as string));
      return match[1] === ">=" ? order >= 0 : match[1] === ">" ? order > 0 : match[1] === "<=" ? order <= 0 : order < 0;
    });
}

describe("the installed peer", () => {
  it("reads ranges the way the package manager does", () => {
    expect(satisfies("0.1.0", "^0.1.0")).toBe(true);
    expect(satisfies("0.1.7", "^0.1.0")).toBe(true);
    expect(satisfies("0.2.0", "^0.1.0")).toBe(false);
    expect(satisfies("0.0.9", "^0.1.0")).toBe(false);
    expect(satisfies("1.4.0", "^1.2.0")).toBe(true);
    expect(satisfies("2.0.0", "^1.2.0")).toBe(false);
    expect(satisfies("0.564.0", ">=0.500.0 <2.0.0")).toBe(true);
    expect(satisfies("0.499.0", ">=0.500.0 <2.0.0")).toBe(false);
    expect(() => satisfies("0.1.0", "~0.1.0")).toThrow(/unsupported range/);
  });

  it("is the library version the peer range claims, and the one the contracts were generated from", () => {
    const pkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));
    const require = createRequire(join(PKG, "package.json"));
    const installedDir = dirname(dirname(require.resolve("@batthewz/r-ui-react-components/styles")));
    const installed = JSON.parse(readFileSync(join(installedDir, "package.json"), "utf8"));
    expect(installed.name).toBe("@batthewz/r-ui-react-components");
    expect(satisfies(installed.version, pkg.peerDependencies["@batthewz/r-ui-react-components"])).toBe(true);
    expect(LIBRARY).toEqual({ name: installed.name, version: installed.version });
  });
});

describe("isWithin", () => {
  it("relates paths the way the tables write them", () => {
    expect(isWithin("filters[].presets[].range", "filters[].presets")).toBe(true);
    expect(isWithin("image.src", "image")).toBe(true);
    expect(isWithin("value.*", "value")).toBe(true);
    expect(isWithin("filtersX", "filters")).toBe(false);
  });
});
