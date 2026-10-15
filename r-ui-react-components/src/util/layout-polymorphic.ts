import type { ComponentPropsWithRef, ElementType } from "react";

/**
 * Props for a component that renders `C` (an intrinsic tag or a component, e.g. a
 * router's `Link`) and adds `Own` on top. `C`'s own props pass through; where a
 * name collides, `Own` wins.
 *
 * Shared by the layout and navigation groups: layout primitives take `as="ul"`,
 * navigation items take `as={RouterLink}` so the library never depends on a router.
 */
export type PolymorphicProps<C extends ElementType, Own = object> = Own & {
  /** The element or component to render. */
  as?: C;
} & Omit<ComponentPropsWithRef<C>, keyof Own | "as">;
