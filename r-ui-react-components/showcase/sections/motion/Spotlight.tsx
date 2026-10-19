import { Button, Card } from "../../../src/components/primitives";
import { Spotlight } from "../../../src/components/motion";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "Spotlight",
  group: "motion",
  order: 70,
  description:
    "A soft wash that follows a mouse across a card, read once a frame. It is the card's own background image, under every child, at a strength that keeps muted text at 4.5:1 in every theme. Fine hovering pointers only: nothing on touch, a coarse input, reduced motion, forced colours or paper.",
};

const PLANS = [
  { title: "Starter", body: "For a team trying things out: three projects, community support.", note: "Free forever" },
  { title: "Team", body: "Unlimited projects, review apps and a shared component library.", note: "€12 per seat a month" },
  {
    title: "Enterprise with a deliberately long name that wraps",
    body: "Single sign-on, audit logs, a named contact and an uptime commitment in writing.",
    note: "Talk to us",
  },
];

function Grid({ plans = PLANS, cta = "Choose" }: { plans?: typeof PLANS; cta?: string }) {
  return (
    <div className="grid gap-r3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,var(--COLUMN-SM)),1fr))]">
      {plans.map((plan) => (
        <Spotlight key={plan.title} as={Card} data-sc="spotlight-card">
          <Card.Header>
            <Card.Title className="break-words">{plan.title}</Card.Title>
            <Card.Description>{plan.body}</Card.Description>
          </Card.Header>
          <Card.Body>
            <p className="text-body-2 text-fg-muted">{plan.note}</p>
          </Card.Body>
          <Card.Footer>
            <Button variant="secondary">{cta}</Button>
          </Card.Footer>
        </Spotlight>
      ))}
    </div>
  );
}

export default function SpotlightSection() {
  return (
    <Stack>
      <Row label="A card grid: move a mouse across it (a touch, a coarse input or reduced motion shows plain cards)">
        <Grid />
      </Row>
      <Row label="RTL and compact">
        <div dir="rtl" lang="ar" data-density="compact">
          <Grid
            cta="اختر"
            plans={[
              { title: "المبتدئ", body: "لفريق يجرّب: ثلاثة مشاريع ودعم المجتمع.", note: "مجاني دائمًا" },
              { title: "الفريق", body: "مشاريع غير محدودة ومكتبة مكونات مشتركة.", note: "12 يورو للمقعد شهريًا" },
            ]}
          />
        </div>
      </Row>
    </Stack>
  );
}
