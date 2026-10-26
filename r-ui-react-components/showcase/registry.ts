import { indexComponents } from "./shell/components";
import { categorise, indexSections, loadModules } from "./shell/sections";

// Every demo section, each its own lazy chunk: a group's page fetches only its
// group's, a solo route only the ones it names, and the hidden all-sections
// route (for the sweeps) every one. Later agents add files under `sections/<group>/` only.
const modules = import.meta.glob("./sections/*/*.tsx");

let loading: ReturnType<typeof loadModules> | undefined;
const some = new Map<string, ReturnType<typeof loadModules>>();

/** Every group and its section ids, read from the file paths: nothing is loaded. */
export const sectionIndex = indexSections(Object.keys(modules));

/**
 * The component groups' barrels as source text (a few kilobytes, no component
 * code): what the command palette reads the component names from.
 */
const barrels = import.meta.glob<string>("../src/components/*/index.ts", { query: "?raw", import: "default", eager: true });

/** Every component the library's groups export, with its own section where it has one. */
export const componentIndex = indexComponents(barrels, indexSections(Object.keys(modules)));

/** The same groups under their categories, as the sidebar, the Components menu and the Overview show them. */
export const categoryIndex = categorise(sectionIndex);

/** Every section, grouped and sorted; loaded once and shared. */
export const loadSections = () => (loading ??= loadModules(modules));

/** Only the sections `ids` names (and the ids no file answers); loaded once per list. */
export function loadSomeSections(ids: readonly string[]) {
  const key = ids.join(",");
  let promise = some.get(key);
  if (!promise) some.set(key, (promise = loadModules(modules, ids)));
  return promise;
}

/** One group's sections, and no other group's chunks. */
export const loadGroupSections = (group: string) =>
  loadSomeSections(sectionIndex.find((g) => g.group === group)?.ids ?? []);
