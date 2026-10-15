import { collectSections } from "./shell/sections";

// Every demo section, each its own lazy chunk: only the Overview fetches them,
// so the other pages never pay for sixty demos. Later agents add files under
// `sections/<group>/` only.
const modules = import.meta.glob("./sections/*/*.tsx");

async function load() {
  const entries = await Promise.all(
    Object.entries(modules).map(async ([path, importer]) => {
      // A section whose chunk fails is listed as invalid, not a blank page.
      const mod = await importer().catch((error: unknown) => ({ loadError: String(error) }));
      return [path, mod] as const;
    }),
  );
  return collectSections(Object.fromEntries(entries));
}

let loading: ReturnType<typeof load> | undefined;

/** Every section, grouped and sorted; loaded once and shared. */
export const loadSections = () => (loading ??= load());
