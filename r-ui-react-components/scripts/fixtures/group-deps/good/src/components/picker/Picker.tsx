// A comment is not an import: from "../picker"
import type { Menu } from "../menu";
import { Menu as MenuImpl } from "../menu/Menu";

export const Picker: typeof Menu = MenuImpl;
