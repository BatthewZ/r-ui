"use client";
import { Ellipsis } from "lucide-react";
import {
  type ComponentPropsWithRef,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useRovingFocusWithin } from "../../hooks/use-roving-focus";
import { elementChildren } from "../../util/children";
import { type LabelsProp, useLabels } from "../../util/locale";
import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import { DropdownMenu } from "../overlays";
import { IconButton } from "../primitives";

import { planOverflow, tidySeparators, type UnitKind } from "./overflow-plan";
import { ToggleGroup } from "./ToggleGroup";
import {
  MenuFormContext,
  type SharedValues,
  SharedValuesContext,
  ToolbarContext,
  type ToolbarOrientation,
  UnitKeyContext,
} from "./toolbar-context";
import { SPACED_CLASSES } from "./toolbar-styles";

export interface ToolbarLabels {
  /** The overflow menu's trigger, which holds the items the toolbar's width cannot. */
  more: string;
}

export const DEFAULT_TOOLBAR_LABELS: ToolbarLabels = { more: "More" };

declare module "../../util/locale" {
  interface LabelsRegistry {
    Toolbar: ToolbarLabels;
  }
}

/** A toolbar must be named: by `aria-label`, or by a visible heading's id in `aria-labelledby`. */
type ToolbarName = { "aria-label": string; "aria-labelledby"?: string } | { "aria-labelledby": string; "aria-label"?: string };

export type ToolbarProps = Omit<ComponentPropsWithRef<"div">, "role" | "aria-label" | "aria-labelledby" | "aria-orientation"> &
  ToolbarName & {
    /** @default "horizontal" */
    orientation?: ToolbarOrientation;
    /**
     * Horizontal only: when the toolbar's own width cannot hold every item, the
     * trailing ones that have a menu form move, in order, into a "More" menu at
     * the end. The toolbar then takes its container's width (`w-full min-w-0`).
     * @default true
     */
    overflow?: boolean;
    labels?: LabelsProp<ToolbarLabels>;
    /** `more`: the "More" trigger; `menu`: its menu panel. */
    classNames?: SlotClassNames<"more" | "menu">;
  };

const sameList = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * A row (or column) of controls with one tab stop (WAI-ARIA APG toolbar).
 *
 * - **Keyboard**: Tab enters on the control that last had focus (the first, at
 *   first); arrows move between controls (mirrored right to left in a
 *   horizontal toolbar; Up and Down in a vertical one), Home and End go to the
 *   ends, natively disabled controls are passed over. Keys a control needs stay
 *   with it: a text input keeps its caret (arrows leave it only from the edge
 *   they point past) and Home/End, a select keeps Up/Down, a menu button opens
 *   on ArrowDown.
 * - **Children** are Buttons, IconButtons, `ToggleGroup`s, Selects, Inputs, a
 *   `DropdownMenu`, `Toolbar.Group` and `Toolbar.Separator`. Each child is one
 *   unit of layout and of overflow.
 * - **Overflow** (horizontal): when the toolbar is too narrow, units leave from
 *   the end into a "More" menu, keeping their order there. A ToggleGroup lists
 *   its toggles as checkbox or radio items; a `Toolbar.Item` lists its `menu`;
 *   a `Toolbar.Group` lists its children when all of them can. Anything else
 *   (a Select, a plain Button) has no menu form and always stays in the bar.
 * - **Touch spacing**: the gap between controls grows with `--HIT-MIN` so that
 *   on a coarse pointer no two neighbours' hit areas overlap, and each icon
 *   control keeps its whole hit area.
 *
 * Interactive only: it does not print.
 */
function ToolbarRoot({
  orientation = "horizontal",
  overflow = true,
  labels: labelsProp,
  classNames,
  className,
  children,
  onKeyDown,
  ref,
  ...props
}: ToolbarProps) {
  const labels = useLabels("Toolbar", DEFAULT_TOOLBAR_LABELS, labelsProp);
  const rootRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const units = elementChildren(children);
  const kinds = units.map(unitKind);
  const canOverflow = overflow && orientation === "horizontal";

  const [hidden, setHidden] = useState<readonly number[]>([]);
  const hiddenRef = useRef(hidden);
  const rescueFocus = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sharedValues, setSharedValues] = useState<Record<string, unknown>>({});
  const shared = useMemo<SharedValues>(
    () => ({ values: sharedValues, set: (key, value) => setSharedValues((all) => ({ ...all, [key]: value })) }),
    [sharedValues],
  );
  const roving = useRovingFocusWithin(rootRef, { orientation });

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    let plan: number[] = [];
    const unitElements = [...root.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el.hasAttribute("data-toolbar-unit"),
    );
    if (canOverflow) {
      const more = [...root.children].find((el) => el.hasAttribute("data-toolbar-more"));
      const style = getComputedStyle(root);
      const px = (value: string) => Number.parseFloat(value) || 0;
      plan = planOverflow({
        widths: unitElements.map((el) => el.getBoundingClientRect().width),
        kinds: unitElements.map((el) => (el.dataset.kind as UnitKind | undefined) ?? "pinned"),
        available: root.clientWidth - px(style.paddingInlineStart) - px(style.paddingInlineEnd),
        gap: px(style.columnGap),
        moreWidth: more?.getBoundingClientRect().width ?? 0,
      });
    }
    const previous = hiddenRef.current;
    if (sameList(previous, plan)) return;
    // A focused control about to leave the bar would drop focus to <body>: it goes to "More" instead.
    const active = document.activeElement;
    if (unitElements.some((el, i) => plan.includes(i) && !previous.includes(i) && el.contains(active))) rescueFocus.current = true;
    hiddenRef.current = plan;
    setHidden(plan);
  }, [canOverflow]);

  // Every render: the children may have changed what fits.
  useLayoutEffect(() => {
    measure();
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !canOverflow || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(root);
    for (const el of root.children) observer.observe(el);
    return () => observer.disconnect();
  }, [canOverflow, measure, units.length]);

  const overflowed = canOverflow ? hidden.filter((i) => i < units.length) : [];
  const showMore = overflowed.some((i) => kinds[i] !== "separator");

  useLayoutEffect(() => {
    if (!rescueFocus.current) return;
    rescueFocus.current = false;
    moreRef.current?.focus();
  }, [hidden]);

  useEffect(() => {
    if (!showMore) setMenuOpen(false);
  }, [showMore]);

  const menuKinds = overflowed.map((i) => kinds[i] ?? "pinned");
  const inMenu = tidySeparators(
    overflowed.map(() => true),
    menuKinds,
  );

  return (
    <ToolbarContext value={{ orientation }}>
      <SharedValuesContext value={shared}>
        <div
          data-print="hide"
          {...props}
          ref={mergeRefs(ref, rootRef)}
          role="toolbar"
          aria-orientation={orientation}
          data-orientation={orientation}
          className={cn(
            "r-toolbar-root",
            SPACED_CLASSES,
            orientation === "vertical" ? "inline-flex flex-col" : "flex",
            canOverflow && "w-full min-w-0",
            className,
          )}
          onKeyDown={composeEventHandlers(onKeyDown, roving.onKeyDown)}
        >
          {units.map((unit, i) => {
            const out = overflowed.includes(i);
            return (
              <div
                key={unit.key ?? i}
                className="r-toolbar-unit"
                data-toolbar-unit=""
                data-kind={kinds[i]}
                data-overflowed={out ? "" : undefined}
                inert={out}
              >
                <UnitKeyContext value={String(unit.key ?? i)}>{unit}</UnitKeyContext>
              </div>
            );
          })}
          {canOverflow && (
            <div className="r-toolbar-unit" data-toolbar-more="" data-overflowed={showMore ? undefined : ""} inert={!showMore}>
              <DropdownMenu open={menuOpen && showMore} onOpenChange={setMenuOpen} placement="bottom-end">
                <DropdownMenu.Trigger asChild>
                  <IconButton ref={moreRef} label={labels.more} icon={<Ellipsis />} className={classNames?.more} />
                </DropdownMenu.Trigger>
                <DropdownMenu.Content className={classNames?.menu}>
                  <MenuFormContext value>
                    {overflowed.map((index, position) => {
                      if (!inMenu[position]) return null;
                      if (kinds[index] === "separator") return <DropdownMenu.Separator key={`separator-${index}`} />;
                      const unit = units[index]!;
                      return (
                        <UnitKeyContext key={unit.key ?? index} value={String(unit.key ?? index)}>
                          {unit}
                        </UnitKeyContext>
                      );
                    })}
                  </MenuFormContext>
                </DropdownMenu.Content>
              </DropdownMenu>
            </div>
          )}
        </div>
      </SharedValuesContext>
    </ToolbarContext>
  );
}

/** Whether a toolbar child can move into the overflow menu, stays, or divides. */
function unitKind(unit: ReactElement): UnitKind {
  if (unit.type === ToolbarSeparator) return "separator";
  return hasMenuForm(unit) ? "item" : "pinned";
}

function hasMenuForm(unit: ReactElement): boolean {
  if (unit.type === ToggleGroup) return true;
  if (unit.type === ToolbarItem) return (unit.props as ToolbarItemProps).menu != null;
  if (unit.type === ToolbarGroup) {
    const parts = elementChildren((unit.props as ToolbarGroupProps).children).filter((part) => part.type !== ToolbarSeparator);
    return parts.length > 0 && parts.every(hasMenuForm);
  }
  return false;
}

export interface ToolbarItemProps {
  /** The control in the bar. */
  children: ReactNode;
  /**
   * What it becomes in the overflow menu: a `DropdownMenu.Item` (or
   * `CheckboxItem`, `RadioGroup`…) doing the same thing. Without one, the
   * control has no menu form and stays in the bar.
   */
  menu?: ReactNode;
}

/** A control with its overflow-menu form. Renders no element of its own. */
function ToolbarItem({ children, menu }: ToolbarItemProps) {
  return <>{useContext(MenuFormContext) ? menu : children}</>;
}

export type ToolbarGroupProps = ComponentPropsWithRef<"div">;

/**
 * Related controls as one `role="group"` (name it with `aria-label`). It moves
 * into the overflow menu as a whole, under its label, when every child has a
 * menu form.
 */
function ToolbarGroup({ className, children, ...props }: ToolbarGroupProps) {
  const inMenu = useContext(MenuFormContext);
  const toolbar = useContext(ToolbarContext);
  const parentKey = useContext(UnitKeyContext) ?? "";
  const labelId = useId();
  const parts = elementChildren(children).map((part, i) => (
    <UnitKeyContext key={part.key ?? i} value={`${parentKey}/${String(part.key ?? i)}`}>
      {part}
    </UnitKeyContext>
  ));
  if (inMenu) {
    const label = props["aria-label"];
    return (
      <>
        {label && <DropdownMenu.Label id={labelId}>{label}</DropdownMenu.Label>}
        <div role="group" aria-labelledby={label ? labelId : props["aria-labelledby"]} className="flex flex-col">
          {parts}
        </div>
      </>
    );
  }
  return (
    <div
      role="group"
      className={cn("flex items-center", SPACED_CLASSES, toolbar?.orientation === "vertical" && "flex-col", className)}
      {...props}
    >
      {parts}
    </div>
  );
}

export type ToolbarSeparatorProps = Omit<ComponentPropsWithRef<"div">, "children">;

/**
 * A hairline between groups of controls, across the toolbar's axis, drawn as a
 * border so it survives forced colours. A divider in the overflow menu.
 */
function ToolbarSeparator({ className, ...props }: ToolbarSeparatorProps) {
  const inMenu = useContext(MenuFormContext);
  const vertical = useContext(ToolbarContext)?.orientation === "vertical";
  if (inMenu) return <DropdownMenu.Separator />;
  return (
    <div
      role="separator"
      aria-orientation={vertical ? "horizontal" : "vertical"}
      className={cn("shrink-0 self-stretch border-border", vertical ? "w-full border-t" : "border-s", className)}
      {...props}
    />
  );
}

export const Toolbar = Object.assign(ToolbarRoot, {
  Item: ToolbarItem,
  Group: ToolbarGroup,
  Separator: ToolbarSeparator,
});
