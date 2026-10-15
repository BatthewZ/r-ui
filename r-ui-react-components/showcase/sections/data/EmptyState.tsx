import { CloudOff, Inbox, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { Button, EmptyState } from "../../../src";

export const meta = {
  title: "EmptyState",
  group: "data",
  order: 80,
  description: "Icon, title, one line of explanation, and the way out. `tone=\"error\"` for a failure.",
};

export default function EmptyStateSection() {
  return (
    <div className="grid grid-cols-1 gap-r2 @2xl:grid-cols-3">
      <Demo title="Empty, with actions">
        <EmptyState
          icon={<Inbox />}
          title="No deploys yet"
          description="Deploys to production appear here as soon as the first one starts."
          actions={
            <>
              <Button iconStart={<Plus aria-hidden className="size-icon" />}>New deploy</Button>
              <Button variant="ghost">Read the guide</Button>
            </>
          }
        />
      </Demo>
      <Demo title="Error">
        <EmptyState
          tone="error"
          icon={<CloudOff />}
          title="Couldn't reach the metrics API"
          description="The last request timed out after 30 seconds. Data on this page may be out of date."
          actions={<Button variant="secondary">Try again</Button>}
        />
      </Demo>
      <Demo title="Minimal">
        <EmptyState title="Nothing matches" />
      </Demo>
    </div>
  );
}

function Demo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-r4">
      <p className="text-body-3 font-medium text-fg-muted">{title}</p>
      {children}
    </div>
  );
}
