// Motion: ScrollReveal, Stagger, view transitions. Entrances that explain where
// content came from; every duration and distance is a contract motion token, so
// reduced motion collapses them. Owned by the "motion" group: one export line
// per component.
export { REVEAL_ANIMATION_CLASSES, type RevealAnimation, ScrollReveal, type ScrollRevealProps } from "./ScrollReveal";
export { Stagger, STAGGER_MAX_INDEX, type StaggerProps } from "./Stagger";
export { type RevealOptions, type RevealState } from "./use-reveal";
export { startViewTransition, useViewTransition } from "./view-transition";
