import {
  Archive,
  Bell,
  Copy,
  FolderGit2,
  LayoutDashboard,
  Palette as PaletteIcon,
  Settings,
  Share2,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button, Card, Kbd } from "../../../src/components/primitives";
import { CommandPalette, type CommandPaletteCommand } from "../../../src/components/commands";
import { useToast } from "../../../src/components/overlays";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "CommandPalette",
  group: "commands",
  order: 36,
  description:
    "A Dialog holding a combobox over a grouped listbox: type to rank (prefix, word start, keywords, scattered letters), arrows / Home / End move, Enter runs after the palette has closed and focus is home, Escape closes. “Change accent…” is a nested page (Backspace in the empty field goes back); “Open project…” loads its list once; “Find people…” searches after a pause. Recent commands are remembered in memory. Ctrl/Cmd+K opens the showcase's own palette from anywhere.",
};

const PEOPLE = ["Ada Lovelace", "Grace Hopper", "Katherine Johnson", "Margaret Hamilton", "Radia Perlman", "Frances Allen", "Barbara Liskov"];
const PROJECTS = ["checkout-api", "search-indexer", "billing-worker", "edge-cache", "auth-gateway", "notifications", "data-pipeline-with-a-very-long-name-that-truncates"];

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

function useDemoCommands(): CommandPaletteCommand[] {
  const { toast } = useToast();
  return useMemo(() => {
    const ran = (title: string) => () => toast({ title });
    return [
      { id: "demo-dashboard", label: "Go to dashboard", group: "Navigate", icon: <LayoutDashboard />, shortcut: ["G", "D"], onSelect: ran("Went to the dashboard") },
      { id: "demo-settings", label: "Open settings", group: "Navigate", icon: <Settings />, keywords: ["preferences", "account"], shortcut: ["⌘", ","], onSelect: ran("Opened settings") },
      {
        id: "demo-project",
        label: "Open project…",
        group: "Navigate",
        icon: <FolderGit2 />,
        page: {
          placeholder: "Filter projects…",
          // Loaded once, the first time the page opens; filtered here as you type.
          commands: async ({ signal }) => {
            await wait(700, signal);
            return PROJECTS.map((name) => ({ id: `demo-project-${name}`, label: name, onSelect: ran(`Opened ${name}`) }));
          },
        },
      },
      {
        id: "demo-people",
        label: "Find people…",
        group: "Navigate",
        icon: <Users />,
        page: {
          placeholder: "Search people by name…",
          // A server search: called after a pause, per query, results not filtered again.
          search: async (query, { signal }) => {
            await wait(400, signal);
            const q = query.toLowerCase();
            return PEOPLE.filter((name) => name.toLowerCase().includes(q)).map((name) => ({
              id: `demo-person-${name}`,
              label: name,
              group: "People",
              icon: <UserRound />,
              onSelect: ran(`Opened ${name}`),
            }));
          },
        },
      },
      { id: "demo-duplicate", label: "Duplicate dashboard", group: "Dashboard", icon: <Copy />, shortcut: ["⌘", "D"], onSelect: ran("Duplicated") },
      { id: "demo-share", label: "Share…", group: "Dashboard", icon: <Share2 />, keywords: ["invite", "link"], onSelect: ran("Shared") },
      { id: "demo-archive", label: "Archive dashboard (owners only)", group: "Dashboard", icon: <Archive />, disabled: true },
      { id: "demo-delete", label: "Delete dashboard", group: "Dashboard", icon: <Trash2 />, onSelect: ran("Deleted (not really)") },
      {
        id: "demo-accent",
        label: "Change accent…",
        group: "Preferences",
        icon: <PaletteIcon />,
        keywords: ["colour", "color", "theme"],
        page: {
          commands: ["Teal", "Indigo", "Amber", "Rose"].map((name) => ({
            id: `demo-accent-${name}`,
            label: name,
            onSelect: ran(`Accent: ${name}`),
          })),
        },
      },
      { id: "demo-notify", label: "Mute notifications for an hour", group: "Preferences", icon: <Bell />, onSelect: ran("Muted for an hour") },
    ];
  }, [toast]);
}

function PaletteDemo({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const commands = useDemoCommands();
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} data-testid="cp-open">
        {label}
      </Button>
      <CommandPalette open={open} onOpenChange={setOpen} commands={commands} />
    </>
  );
}

export default function CommandPaletteSection() {
  return (
    <Stack>
      <Row label="Groups, icons, shortcuts, a disabled command · nested pages: static, loaded once, searched">
        <div className="flex flex-wrap items-center gap-r4">
          <PaletteDemo label="Open command palette" />
          <span className="flex items-center gap-r6 text-body-3 text-fg-muted">
            or anywhere in the showcase: <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd> / <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </div>
      </Row>
      <Row label="Opened from a compact card: the palette is written there, so its rows are the card's --ROW-H">
        <Card data-density="compact" className="flex items-center gap-r4 overflow-hidden px-r2 py-r3" data-testid="cp-compact-card">
          <span className="text-body-1 text-fg-primary">Compact</span>
          <PaletteDemo label="Open compact palette" />
        </Card>
      </Row>
      <Row label="RTL">
        <div dir="rtl">
          <PaletteDemo label="افتح لوحة الأوامر" />
        </div>
      </Row>
    </Stack>
  );
}
