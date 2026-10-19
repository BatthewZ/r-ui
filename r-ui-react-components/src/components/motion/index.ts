// Motion: ScrollReveal, Stagger, view transitions, and the decorative extras
// (Parallax, CountUp, ReadingProgress, Spotlight). Entrances that explain where
// content came from and decoration on decorative layers only; every duration and
// distance is a contract motion token, so reduced motion collapses them. Owned by
// the "motion" group: one export line per component.
export { CountUp, type CountUpProps } from "./CountUp";
export { Parallax, type ParallaxProps, type ParallaxStrength } from "./Parallax";
export { ReadingProgress, type ReadingProgressProps } from "./ReadingProgress";
export { REVEAL_ANIMATION_CLASSES, type RevealAnimation, ScrollReveal, type ScrollRevealProps } from "./ScrollReveal";
export { Spotlight, type SpotlightProps } from "./Spotlight";
export { Stagger, STAGGER_MAX_INDEX, type StaggerProps } from "./Stagger";
export { type RevealOptions, type RevealState } from "./use-reveal";
export { startViewTransition, useViewTransition } from "./view-transition";
