import { Check, Hash, MousePointer2, Rows3, Search, SunMoon } from "lucide-react";
import { type ComponentType, useMemo, useState } from "react";

import { CommandPalette, type CommandPaletteCommand, useCommandPaletteShortcut } from "../../src/components/commands";
import { Button, Kbd } from "../../src/components/primitives";
import { useDensity, useInputMode, useTheme } from "../../src/hooks/use-preferences";
import { DENSITIES, INPUT_MODES } from "../../src/util/preferences";
import { loadSections } from "../registry";
import { href } from "./router";
import { PREFERENCES, THEMES } from "./view";

const RECENT_KEY = "r-ui-showcase:recent-commands";

function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeRecent(ids: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
  } catch {
    /* storage blocked: recent stays in memory */
  }
}

const go = (target: string) => () => {
  window.location.hash = target;
};

const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** Module scope: one identity, so the palette loads the section list once however often the commands re-render. */
async function sectionCommands(): Promise<CommandPaletteCommand[]> {
  const { groups } = await loadSections();
  return groups.flatMap(({ group, sections }) =>
    sections.map((section) => ({
      id: `section-${section.id}`,
      label: section.meta.title,
      group: capitalise(group),
      keywords: [group],
      onSelect: go(href("overview", section.id)),
    })),
  );
}

/** The current choice carries a check, so a sub-page also reads as "what is set now". */
const current = (on: boolean) => (on ? <Check /> : <span className="size-icon" />);

/**
 * The showcase's global palette, as a consumer app would wire it: Ctrl/Cmd+K
 * (or the header button) opens it; it goes to pages and Overview sections and
 * switches theme, density and input on nested pages. The sections page loads
 * the Overview's section list the first time it opens. Recent commands persist
 * in localStorage.
 */
export function CommandMenu({ pages }: { pages: { page: string; label: string; Icon: ComponentType<{ className?: string }> }[] }) {
  const [open, setOpen] = useState(false);
  // While open, focus is in the palette's own field: let the chord close it from there.
  const shortcut = useCommandPaletteShortcut(() => setOpen((was) => !was), { allowInEditable: open });
  const { theme, setTheme } = useTheme(PREFERENCES);
  const { density, setDensity } = useDensity(PREFERENCES);
  const { input, setInput } = useInputMode(PREFERENCES);
  const [defaultRecent] = useState(readRecent);

  const commands = useMemo<CommandPaletteCommand[]>(
    () => [
      ...pages.map(({ page, label, Icon }) => ({
        id: `page-${page}`,
        label: `Go to ${label}`,
        group: "Pages",
        icon: <Icon />,
        onSelect: go(href(page)),
      })),
      {
        id: "sections",
        label: "Go to section…",
        group: "Pages",
        icon: <Hash />,
        keywords: ["component", "overview", "demo"],
        page: {
          placeholder: "Find a component…",
          commands: sectionCommands,
        },
      },
      {
        id: "theme",
        label: "Change theme…",
        group: "View",
        icon: <SunMoon />,
        keywords: ["colour", "color", "dark", "light", "appearance"],
        page: {
          commands: THEMES.map((t) => ({
            id: `theme-${t.value}`,
            label: t.label,
            icon: current(theme === t.value),
            onSelect: () => setTheme(t.value),
          })),
        },
      },
      {
        id: "density",
        label: "Change density…",
        group: "View",
        icon: <Rows3 />,
        keywords: ["compact", "comfortable", "spacing"],
        page: {
          commands: DENSITIES.map((d) => ({
            id: `density-${d}`,
            label: capitalise(d),
            icon: current(density === d),
            onSelect: () => setDensity(d),
          })),
        },
      },
      {
        id: "input",
        label: "Change input…",
        group: "View",
        icon: <MousePointer2 />,
        keywords: ["touch", "pointer", "coarse", "fine", "hit"],
        page: {
          commands: INPUT_MODES.map((mode) => ({
            id: `input-${mode}`,
            label: capitalise(mode),
            icon: current(input === mode),
            onSelect: () => setInput(mode),
          })),
        },
      },
    ],
    [pages, theme, setTheme, density, setDensity, input, setInput],
  );

  return (
    <>
      <Button
        variant="ghost"
        iconStart={<Search aria-hidden className="size-icon" />}
        aria-keyshortcuts={shortcut.ariaKeyShortcuts}
        onClick={() => setOpen(true)}
        data-showcase-palette-button=""
        classNames={{ label: "flex items-center gap-r4" }}
      >
        <span className="max-md:sr-only">Search</span>
        <kbd className="flex gap-r6 max-md:hidden">
          {shortcut.keys.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </kbd>
      </Button>
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        commands={commands}
        defaultRecent={defaultRecent}
        onRecentChange={writeRecent}
        data-showcase-palette=""
      />
    </>
  );
}
