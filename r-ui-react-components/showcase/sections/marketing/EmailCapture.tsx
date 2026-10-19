import { useRef, useState } from "react";

import { Button, EmailCapture } from "../../../src";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "EmailCapture",
  group: "marketing",
  order: 150,
  description:
    "A newsletter form on Form, Field, Input, Checkbox and Button: the field and button on one row when the FORM is wide enough (@md), stacked below. An invalid address is the Field's error with focus on it; pending keeps the button busy; a rejection is the field's error and the next press retries; success replaces the form with a message that takes focus and is announced. Optional consent box and honeypot.",
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Fails its first attempt, then succeeds: the error and the retry. */
function useFlakySubmit() {
  const attempts = useRef(0);
  return async () => {
    attempts.current += 1;
    await wait(700);
    if (attempts.current === 1) throw new Error("The list is unreachable.");
  };
}

function Demos() {
  const flaky = useFlakySubmit();
  return (
    <>
      <Row label="Fails once, then works: submit empty or 'ada@' for the error, a valid address for pending → failure, then press again">
        <EmailCapture data-sc="email-flaky" onSubmit={flaky} description="One email a month. Unsubscribe any time." />
      </Row>
      <Row label="A narrow form (stacked) · required consent · a honeypot">
        <div className="max-w-column-md" data-sc="email-narrow">
          <EmailCapture
            onSubmit={() => wait(500)}
            consent="I agree to receive product news by email."
            honeypot
          />
        </div>
      </Row>
      <Row label="Pending (never answers, to look at) · a pre-filled address">
        <EmailCapture data-sc="email-pending" onSubmit={() => new Promise<void>(() => {})} defaultValue="grace@example.com" />
      </Row>
      <Row label="Disabled">
        <EmailCapture onSubmit={() => wait(0)} disabled consent="I agree to receive product news by email." />
      </Row>
      <Row label="Compact density · optional consent · the label hidden (still the field's name)">
        <div data-density="compact">
          <EmailCapture onSubmit={() => wait(500)} hideLabel consent="Also send me release tips." consentRequired={false} />
        </div>
      </Row>
      <Row label="RTL · translated labels · a long address in the success message wraps">
        <div dir="rtl">
          <EmailCapture
            onSubmit={() => wait(500)}
            defaultValue="a-very-long-mailbox-name-for-testing-wrapping@subdomain.example.org"
            labels={{
              email: "البريد الإلكتروني",
              submit: "اشترك",
              successTitle: "تم الاشتراك",
              successMessage: (email) => `أرسلنا رسالة تأكيد إلى ${email}.`,
            }}
          />
        </div>
      </Row>
    </>
  );
}

export default function EmailCaptureSection() {
  // Success replaces each form; a new key brings them all back.
  const [round, setRound] = useState(0);
  return (
    <Stack>
      <div>
        <Button variant="secondary" onClick={() => setRound((n) => n + 1)} data-sc="email-reset">
          Reset the demos
        </Button>
      </div>
      <Demos key={round} />
    </Stack>
  );
}
