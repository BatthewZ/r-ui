import type { ElementType } from "react";

import type { PolymorphicProps } from "../../util/layout-polymorphic";
import { cn, type SlotClassNames } from "../../util/style";
import { GAP, ROW_GAP, type Space } from "./space";

export type GridColumns = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Tailwind's container sizes, measured on the Grid's OWN width (never the
 * viewport): `@sm` 24rem, `@md` 28rem, `@lg` 32rem, `@xl` 36rem, `@2xl` 42rem,
 * `@3xl` 48rem, `@4xl` 56rem, `@5xl` 64rem.
 */
export type GridContainerSize = "@sm" | "@md" | "@lg" | "@xl" | "@2xl" | "@3xl" | "@4xl" | "@5xl";

/** Explicit column counts: a base count plus overrides from a container size up. */
export type GridColumnMap = { base?: GridColumns } & Partial<Record<GridContainerSize, GridColumns>>;

/**
 * The smallest a column may get before auto-fit drops one: the contract's
 * column floors `--COLUMN-SM`, `--COLUMN-MD`, `--COLUMN-LG`.
 */
export type GridMinColumn = "sm" | "md" | "lg";

export type GridProps<C extends ElementType = "div"> = PolymorphicProps<
  C,
  {
    /** Space between cells, from the UI scale. Default `r3`. */
    gap?: Space;
    /** Space between rows when it should differ from `gap`. */
    rowGap?: Space;
    /**
     * Fixed column counts by container size. Without it the grid auto-fits as many
     * columns as fit at `minColumn` each.
     */
    columns?: GridColumns | GridColumnMap;
    /** The auto-fit column floor. Ignored when `columns` is set. Default `md`. */
    minColumn?: GridMinColumn;
    classNames?: SlotClassNames<"container">;
  }
>;

// Literal class names, so Tailwind's scanner sees every utility.
const COLUMNS: Record<"base" | GridContainerSize, Record<GridColumns, string>> = {
  base: {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
    6: "grid-cols-6",
  },
  "@sm": {
    1: "@sm:grid-cols-1",
    2: "@sm:grid-cols-2",
    3: "@sm:grid-cols-3",
    4: "@sm:grid-cols-4",
    5: "@sm:grid-cols-5",
    6: "@sm:grid-cols-6",
  },
  "@md": {
    1: "@md:grid-cols-1",
    2: "@md:grid-cols-2",
    3: "@md:grid-cols-3",
    4: "@md:grid-cols-4",
    5: "@md:grid-cols-5",
    6: "@md:grid-cols-6",
  },
  "@lg": {
    1: "@lg:grid-cols-1",
    2: "@lg:grid-cols-2",
    3: "@lg:grid-cols-3",
    4: "@lg:grid-cols-4",
    5: "@lg:grid-cols-5",
    6: "@lg:grid-cols-6",
  },
  "@xl": {
    1: "@xl:grid-cols-1",
    2: "@xl:grid-cols-2",
    3: "@xl:grid-cols-3",
    4: "@xl:grid-cols-4",
    5: "@xl:grid-cols-5",
    6: "@xl:grid-cols-6",
  },
  "@2xl": {
    1: "@2xl:grid-cols-1",
    2: "@2xl:grid-cols-2",
    3: "@2xl:grid-cols-3",
    4: "@2xl:grid-cols-4",
    5: "@2xl:grid-cols-5",
    6: "@2xl:grid-cols-6",
  },
  "@3xl": {
    1: "@3xl:grid-cols-1",
    2: "@3xl:grid-cols-2",
    3: "@3xl:grid-cols-3",
    4: "@3xl:grid-cols-4",
    5: "@3xl:grid-cols-5",
    6: "@3xl:grid-cols-6",
  },
  "@4xl": {
    1: "@4xl:grid-cols-1",
    2: "@4xl:grid-cols-2",
    3: "@4xl:grid-cols-3",
    4: "@4xl:grid-cols-4",
    5: "@4xl:grid-cols-5",
    6: "@4xl:grid-cols-6",
  },
  "@5xl": {
    1: "@5xl:grid-cols-1",
    2: "@5xl:grid-cols-2",
    3: "@5xl:grid-cols-3",
    4: "@5xl:grid-cols-4",
    5: "@5xl:grid-cols-5",
    6: "@5xl:grid-cols-6",
  },
};

const MIN_COLUMN: Record<GridMinColumn, string> = {
  sm: "r-layout-grid-fit-sm",
  md: "r-layout-grid-fit-md",
  lg: "r-layout-grid-fit-lg",
};

function columnClasses(columns: GridColumns | GridColumnMap): string[] {
  if (typeof columns === "number") return [COLUMNS.base[columns]];
  return (Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]).flatMap((key) => {
    const count = columns[key];
    return count === undefined ? [] : [COLUMNS[key][count]];
  });
}

/**
 * A grid that adapts to the width it is given, not to the screen. It sits inside
 * a size container of its own (`classNames.container`), which fills its parent's
 * inline size and never sizes to its content: give it a width in a flex row.
 * `as`, `className` and every other prop belong to the grid element itself, so
 * `<Grid as="ul">` holds its `<li>` children directly.
 */
export function Grid<C extends ElementType = "div">({
  as,
  gap = "r3",
  rowGap,
  columns,
  minColumn = "md",
  className,
  classNames,
  children,
  ...props
}: GridProps<C>) {
  const Component: ElementType = as ?? "div";
  return (
    <div className={cn("@container min-w-0", classNames?.container)}>
      <Component
        className={cn(
          "grid",
          GAP[gap],
          rowGap && ROW_GAP[rowGap],
          columns === undefined ? MIN_COLUMN[minColumn] : columnClasses(columns),
          className,
        )}
        {...props}
      >
        {children}
      </Component>
    </div>
  );
}
