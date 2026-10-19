import { BellOff, FileDown, Link2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { DropdownMenu } from "../../../src/components/overlays";
import { IconButton } from "../../../src/components/primitives";
import { ToggleGroup, Toolbar } from "../../../src/components/toolbar";
import type { Env } from "./data";

interface Action {
  id: string;
  label: string;
  icon: ReactNode;
  run: () => void;
}

export interface HeaderActionsProps {
  env: Env;
  onEnvChange: (env: Env) => void;
  onRefresh: () => void;
  onCopyLink: () => void;
  onExport: () => void;
  onMute: () => void;
}

/**
 * The header's toolbar: which environment the board shows, then its actions.
 * One tab stop, arrows between the controls; on a coarse pointer the gap grows
 * so no two hit areas overlap. It takes the header's room after the title (and
 * never less than one control, for "More"); when that runs out (a phone) the
 * actions, then the environment, move into "More" in their order, each as its
 * menu item.
 */
export function HeaderActions({ env, onEnvChange, onRefresh, onCopyLink, onExport, onMute }: HeaderActionsProps) {
  const actions: Action[] = [
    { id: "refresh", label: "Refresh now", icon: <RefreshCw />, run: onRefresh },
    { id: "link", label: "Copy link to this view", icon: <Link2 />, run: onCopyLink },
    { id: "export", label: "Export services as CSV", icon: <FileDown />, run: onExport },
    { id: "mute", label: "Mute alerts for 1 hour", icon: <BellOff />, run: onMute },
  ];
  return (
    <Toolbar aria-label="Dashboard actions" className="grow basis-control justify-end" data-dashboard-actions="">
      <ToggleGroup type="single" aria-label="Environment" value={env} onValueChange={(v) => onEnvChange(v as Env)}>
        <ToggleGroup.Item value="production">Production</ToggleGroup.Item>
        <ToggleGroup.Item value="staging">Staging</ToggleGroup.Item>
      </ToggleGroup>
      <Toolbar.Separator />
      {actions.map((a) => (
        <Toolbar.Item
          key={a.id}
          menu={
            <DropdownMenu.Item icon={a.icon} onSelect={a.run}>
              {a.label}
            </DropdownMenu.Item>
          }
        >
          <IconButton variant="ghost" label={a.label} icon={a.icon} onClick={a.run} />
        </Toolbar.Item>
      ))}
    </Toolbar>
  );
}
