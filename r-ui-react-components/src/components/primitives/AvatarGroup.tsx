"use client";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { type LabelsProp, useLabels } from "../../util/locale";
import { cn, type SlotClassNames } from "../../util/style";

import { Avatar, type AvatarProps } from "./Avatar";

export interface AvatarGroupItem {
  /** Stable identity; defaults to the position and name. */
  key?: string;
  name: string;
  src?: string | null;
}

/** What `renderOverflow` gets to draw the surplus with (a Popover trigger, a link to the full list). */
export interface AvatarGroupOverflow {
  /** The people not shown, in order. */
  items: AvatarGroupItem[];
  /** The visible text: "+3". */
  text: string;
  /** The accessible name: "3 more: Grace Hopper, Alan Turing, Katherine Johnson". */
  label: string;
  /** The chip's look, to put on whatever element is rendered. */
  className: string;
  /** For the element holding `text`: sized to the chip, as an avatar's initials are. */
  textClassName: string;
}

/** Every string the group says, for localisation. */
export interface AvatarGroupLabels {
  /** The surplus chip's text. */
  more: (count: number) => string;
  /** The surplus chip's spoken text, with the names it stands for. */
  moreNames: (count: number, names: string[]) => string;
}

export const DEFAULT_AVATAR_GROUP_LABELS: AvatarGroupLabels = {
  more: (count) => `+${count}`,
  moreNames: (count, names) => `${count} more: ${names.join(", ")}`,
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    AvatarGroup: AvatarGroupLabels;
  }
}

export type AvatarGroupProps = {
  /** The people, in order; each face overlaps the one before it. */
  items: readonly AvatarGroupItem[];
  /** Names the list ("Team", "Assigned to"). Required: a row of faces says nothing on its own. */
  label: string;
  /**
   * Most circles drawn, the surplus chip included: 9 people with `max={5}`
   * show four faces and "+5". At least 2. All when omitted.
   */
  max?: number;
  /** An `Avatar` size: `control` (default) or `icon`. */
  size?: AvatarProps["size"];
  /**
   * Draws the surplus chip's content instead of the plain count, e.g. a button
   * that opens a Popover listing the rest. Put `overflow.className` on it and
   * `overflow.label` as its name.
   */
  renderOverflow?: (overflow: AvatarGroupOverflow) => ReactNode;
  labels?: LabelsProp<AvatarGroupLabels>;
  classNames?: SlotClassNames<"item" | "avatar" | "overflow">;
} & Omit<ComponentPropsWithRef<"ul">, "children">;

const CHIP =
  "r-primitives-avatar-chip relative inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 font-medium text-fg-secondary tabular-nums";

/**
 * Overlapping avatars for a team or the people on a record: a list named by
 * `label`, each face an image named by its person (and its `title`), each
 * overlapping the one before it. Past `max`, the last circle is a "+n"
 * chip whose spoken text names who it stands for; `renderOverflow` turns it
 * into a control of your own (this group renders no popup itself). Sizes are
 * the Avatar's, so the faces follow density and the input's hit floor.
 */
export function AvatarGroup({
  items,
  label,
  max,
  size = "control",
  renderOverflow,
  labels: labelsProp,
  className,
  classNames,
  ...props
}: AvatarGroupProps) {
  const labels = useLabels("AvatarGroup", DEFAULT_AVATAR_GROUP_LABELS, labelsProp);
  const limit = max === undefined ? Infinity : Math.max(2, Math.floor(max));
  const shown = items.length > limit ? items.slice(0, limit - 1) : items;
  const hidden = items.slice(shown.length);
  const sizeClass = size === "icon" ? "size-icon" : "size-control";
  const overflow: AvatarGroupOverflow = {
    items: hidden,
    text: labels.more(hidden.length),
    label: labels.moreNames(
      hidden.length,
      hidden.map((item) => item.name),
    ),
    className: cn(CHIP, sizeClass, classNames?.overflow),
    textClassName: "r-primitives-avatar-chip-text",
  };

  return (
    <ul
      // `list-style: none` drops list semantics in Safari unless the role is explicit.
      role="list"
      aria-label={label}
      data-size={size}
      className={cn("r-primitives-avatar-group flex min-w-0 flex-wrap items-center", className)}
      {...props}
    >
      {shown.map((item, index) => (
        <li key={item.key ?? `${index}:${item.name}`} title={item.name} className={cn("r-primitives-avatar-group-item flex", classNames?.item)}>
          <Avatar src={item.src} name={item.name} size={size} className={classNames?.avatar} />
        </li>
      ))}
      {hidden.length > 0 && (
        <li className={cn("r-primitives-avatar-group-item flex", classNames?.item)}>
          {renderOverflow ? (
            renderOverflow(overflow)
          ) : (
            <span className={overflow.className} title={overflow.label}>
              <span aria-hidden className={overflow.textClassName}>
                {overflow.text}
              </span>
              <span className="sr-only">{overflow.label}</span>
            </span>
          )}
        </li>
      )}
    </ul>
  );
}
