import { Avatar, Button, Card, Skeleton, Spinner } from "../../../src/components/primitives";
import { Row, Stack } from "./parts/demo";

export const meta = {
  title: "Spinner & Skeleton",
  group: "primitives",
  order: 50,
  components: ["Spinner", "Skeleton"],
  description:
    "Decoration by default; give one per region a label to make it the status. The skeleton pulse stops under reduced motion; the spinner keeps turning (it says 'still working').",
};

export default function LoadingSection() {
  return (
    <Stack>
      <Row label="Spinner: inherits colour and size-icon · resized · labelled · in a button">
        <div className="flex flex-wrap items-center gap-r3">
          <Spinner />
          <span className="text-fg-accent">
            <Spinner />
          </span>
          <Spinner className="size-control text-fg-muted" />
          <span className="inline-flex items-center gap-r5 text-body-2 text-fg-secondary">
            <Spinner label="Loading results" /> Loading results…
          </span>
          <Button loading>Save</Button>
          <span data-density="compact" className="inline-flex items-center gap-r5">
            <Spinner /> <span className="text-body-2">compact</span>
          </span>
        </div>
      </Row>

      <Row label="Skeleton: text lines (each one line box of its type) · block · circle · a card while loading">
        <div className="grid items-start gap-r3 @2xl:grid-cols-3">
          <div className="grid gap-r4">
            <Skeleton className="w-1/2 text-h4" />
            <Skeleton lines={3} className="text-body-2" />
          </div>
          <div className="flex items-center gap-r4">
            <Skeleton shape="circle" />
            <div className="grid flex-1 gap-r6">
              <Skeleton className="w-2/3" />
              <Skeleton className="w-1/3 text-body-3" />
            </div>
          </div>
          <Card>
            <Card.Header>
              <Skeleton className="w-1/2 text-h4" label="Loading revenue card" />
            </Card.Header>
            <Card.Body>
              <Skeleton shape="block" className="h-chart" />
            </Card.Body>
          </Card>
        </div>
      </Row>

      <Row label="Same row, loaded: the text takes exactly the skeleton's space">
        <div className="grid gap-r3 @xl:grid-cols-2">
          <div className="flex items-center gap-r4">
            <Skeleton shape="circle" />
            <div className="grid flex-1 gap-r6">
              <Skeleton className="w-2/3" />
              <Skeleton className="w-1/3 text-body-3" />
            </div>
          </div>
          <div className="flex items-center gap-r4">
            <Avatar name="Ada Lovelace" />
            <div className="grid flex-1 gap-r6">
              <span>Ada Lovelace</span>
              <span className="text-body-3 text-fg-muted">Analyst</span>
            </div>
          </div>
        </div>
      </Row>
    </Stack>
  );
}
