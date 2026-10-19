import { loadModules } from "./shell/sections";

// Every demo section, each its own lazy chunk: only the Overview fetches them
// all, and a solo route only the ones it names, so the other pages never pay for
// a hundred demos. Later agents add files under `sections/<group>/` only.
const modules = import.meta.glob("./sections/*/*.tsx");

let loading: ReturnType<typeof loadModules> | undefined;
const some = new Map<string, ReturnType<typeof loadModules>>();

/** Every section, grouped and sorted; loaded once and shared. */
export const loadSections = () => (loading ??= loadModules(modules));

/** Only the sections `ids` names (and the ids no file answers); loaded once per list. */
export function loadSomeSections(ids: readonly string[]) {
  const key = ids.join(",");
  let promise = some.get(key);
  if (!promise) some.set(key, (promise = loadModules(modules, ids)));
  return promise;
}
