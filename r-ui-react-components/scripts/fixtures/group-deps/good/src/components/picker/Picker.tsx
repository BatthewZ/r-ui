// A comment is not an import: from "../picker"; nor is a class named in one: r-picker-x in r-menu-list
import type { Menu } from "../menu";
import { Menu as MenuImpl } from "../menu/Menu";

export const Picker: typeof Menu = MenuImpl;
// Base's look borrowed by class name: a one-way edge picker → base.
export const PICKER_FRAME = "r-base-frame";
