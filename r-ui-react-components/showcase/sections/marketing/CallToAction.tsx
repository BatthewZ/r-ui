import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { Button, CallToAction, EmailCapture } from "../../../src";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "CallToAction",
  group: "marketing",
  order: 140,
  description:
    "The closing band: display title, a line of prose, one or two actions or a sign-up form. A region named by its title and a size container (split decides by the BAND's width). Inside a padded shell the page root cancels the padding (the band pattern), so the band's fill and hairlines run edge to edge.",
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const Actions = () => (
  <>
    <Button iconEnd={<ArrowRight className="rtl:-scale-x-100" />}>Start free</Button>
    <Button variant="secondary">Book a demo</Button>
  </>
);

/**
 * A stand-in for an app shell's padded main region (`p-r2`), with a page root
 * inside that cancels exactly that padding: the band pattern.
 */
const Shell = ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
  <div className="overflow-hidden rounded-lg border border-border p-r2" {...props}>
    <div className="-m-r2">
      {children}
    </div>
  </div>
);

export default function CallToActionSection() {
  return (
    <Stack>
      <Row label="Inside a padded shell · the band runs edge to edge · an EmailCapture as its content">
        <Shell data-sc="cta-shell">
          <CallToAction
            headingLevel={4}
            title="Your next release is already merged."
            body="Get one short email a month with what shipped and why it matters. No spam, unsubscribe any time."
          >
            <EmailCapture onSubmit={() => wait(600)} hideLabel description="One email a month." />
          </CallToAction>
        </Shell>
      </Row>
      <Row label="Stacked with two actions">
        <Shell>
          <CallToAction
            headingLevel={4}
            title="Let it explain itself."
            body="Connect a repository and get your first draft in about a minute. Free for one repository."
            actions={<Actions />}
          />
        </Shell>
      </Row>
      <Row label="Split: text at the start, actions at the end when the band is wide (@4xl), stacked below">
        <Shell data-sc="cta-split">
          <CallToAction
            headingLevel={4}
            layout="split"
            title="Ready when your next release is."
            body="Free for one repository, no card needed."
            actions={<Actions />}
          />
        </Shell>
      </Row>
      <Row label="Plain (no band) · compact density keeps the display scale · a long unbroken word wraps">
        <Shell data-density="compact">
          <CallToAction
            headingLevel={4}
            variant="plain"
            title="Versionshinweise-ohne-Nacharbeit-für-alle-Teams"
            actions={<Button>Start free</Button>}
          />
        </Shell>
      </Row>
      <Row label="RTL · split">
        <Shell dir="rtl">
          <CallToAction headingLevel={4} layout="split" title="إصدارك القادم مدمج بالفعل." body="مجاني لمستودع واحد." actions={<Actions />} />
        </Shell>
      </Row>
    </Stack>
  );
}
