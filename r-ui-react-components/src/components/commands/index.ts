// The command palette: a searchable list of actions over a Dialog. Builds on
// overlays (Dialog) and form (Input); nothing else in the library imports it.
export {
  CommandPalette,
  type CommandPaletteCommand,
  type CommandPaletteCommands,
  type CommandPaletteLabels,
  type CommandPalettePage,
  type CommandPaletteProps,
  type CommandPaletteSearch,
  DEFAULT_COMMAND_PALETTE_LABELS,
} from "./CommandPalette";
export {
  type CommandPaletteShortcut,
  useCommandPaletteShortcut,
  type UseCommandPaletteShortcutOptions,
} from "./command-shortcut";
