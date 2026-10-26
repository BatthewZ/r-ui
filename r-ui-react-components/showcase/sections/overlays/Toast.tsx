import { Button } from "../../../src/components/primitives";
import { useToast } from "../../../src/components/overlays";
import { Row, Stack } from "./parts/demo";

export const meta = {
  title: "Toast",
  group: "overlays",
  order: 60,
  components: ["ToastProvider"],
  description:
    "useToast() from the app root's ToastProvider. Neutral cards, status as icon + word; errors and serious toasts announce assertively and stay. Hover or focus the stack to pause the clock; dismissing a toast from its own button hands focus to the next toast, else back where it was.",
};

function Triggers() {
  const { toast, dismissAll } = useToast();
  return (
    <div className="flex flex-wrap items-center gap-r4">
      <Button variant="secondary" onClick={() => toast({ title: "Dashboard saved" })}>
        Neutral
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast({ title: "Report exported", description: "checkout-latency.csv · 1.2 MB", tone: "success" })}
      >
        Success
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast({ title: "Ingestion is 4 minutes behind", description: "Charts may lag until it catches up.", tone: "warning" })}
      >
        Warning
      </Button>
      <Button variant="secondary" onClick={() => toast({ title: "Maintenance window at 02:00 UTC", tone: "info" })}>
        Info
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast({
            title: "Export failed",
            description: "The warehouse rejected the query after 30 s. Nothing was charged.",
            tone: "error",
          })
        }
      >
        Error (stays)
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast({ title: "Checkout latency over budget", description: "p95 is 1.8 s against a 1.2 s target.", tone: "serious" })}
      >
        Serious (stays)
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast({ title: "Figures are 2 hours old", description: "The last refresh did not finish.", tone: "stale" })}
      >
        Stale
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast({ title: "3 dashboards archived", action: { label: "Undo", onClick: () => toast({ title: "Restored" }) } })
        }
      >
        With action
      </Button>
      <Button variant="ghost" onClick={dismissAll}>
        Dismiss all
      </Button>
    </div>
  );
}

export default function ToastSection() {
  return (
    <Stack>
      <Row label="Raise one of each (bottom end of the viewport)">
        <Triggers />
      </Row>
    </Stack>
  );
}
