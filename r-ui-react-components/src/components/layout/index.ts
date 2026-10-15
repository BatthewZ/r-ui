// Layout: Stack, Inline, Grid, Container, Section, Prose. Thin and token-driven:
// gap and padding props take scale names only, so a consumer never writes raw spacing.
// Owned by the "layout" group: add one export line per component. No other
// group, and no shared file, needs to change when a component lands here.
export { Container, type ContainerProps, type ContainerWidth } from "./Container";
export {
  Grid,
  type GridColumnMap,
  type GridColumns,
  type GridContainerSize,
  type GridMinColumn,
  type GridProps,
} from "./Grid";
export { Inline, type InlineProps } from "./Inline";
export { Prose, type ProseProps } from "./Prose";
export { Section, type SectionProps, type SectionSpace, type SectionVariant } from "./Section";
export { type Align as LayoutAlign, type Justify as LayoutJustify, type Space } from "./space";
export { Stack, type StackProps } from "./Stack";
