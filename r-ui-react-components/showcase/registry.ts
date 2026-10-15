import { collectSections } from "./shell/sections";

// Every demo section. Later agents add files under `sections/<group>/` only.
export const sections = collectSections(import.meta.glob("./sections/*/*.tsx", { eager: true }));
