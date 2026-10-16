import { useState } from "react";

import { Field, Form, OTPInput, useForm } from "../../../src/components/form";
import { Button, Card, StatusLabel } from "../../../src/components/primitives";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "OTPInput",
  group: "form",
  order: 170,
  description:
    "A one-time code as one field: one input and one name (“Verification code, 6 digits”) under the boxes, so autofill, paste and screen readers see a single text field. Typing advances, Backspace goes back, arrows move, a paste of “123-456” fills every box. The sign-in step submits on completion; the right code is 246810.",
};

const RIGHT_CODE = "246810";

function VerifyStep() {
  const [verified, setVerified] = useState(false);
  const [resent, setResent] = useState(0);
  const [attempts, setAttempts] = useState(5);
  const form = useForm({
    defaultValues: { code: "" },
    onSubmit: async ({ code }, { setErrors }) => {
      await new Promise((done) => setTimeout(done, 500));
      if (code === RIGHT_CODE) {
        setVerified(true);
        return;
      }
      const left = Math.max(0, attempts - 1);
      setAttempts(left);
      setErrors({ code: `That code is not right. ${left} ${left === 1 ? "attempt" : "attempts"} left.` });
    },
  });
  const { submitting } = form.state;

  return (
    <Card className="max-w-column-lg py-r2" data-testid="otp-verify">
      <Card.Header>
        <Card.Title>Check your email</Card.Title>
        <Card.Description>We sent a 6-digit code to a••••@example.com. It expires in 10 minutes.</Card.Description>
      </Card.Header>
      <Card.Body className="mt-r3">
        {verified ? (
          <StatusLabel tone="success">Verified. Signing you in…</StatusLabel>
        ) : (
          <Form form={form} className="grid gap-r3">
            <Field name="code" required>
              <Field.Label>Verification code</Field.Label>
              <OTPInput
                groups={[3, 3]}
                readOnly={submitting}
                onComplete={() => {
                  void form.submit();
                }}
              />
              <Field.Error />
            </Field>
            <div className="flex flex-wrap items-center gap-r4">
              <Button type="submit" loading={submitting}>
                Verify
              </Button>
              <Button type="button" variant="ghost" onClick={() => setResent((n) => n + 1)}>
                Send a new code
              </Button>
              <span role="status" className="text-body-2 text-fg-muted">
                {resent > 0 ? `New code sent (${resent}).` : ""}
              </span>
            </div>
          </Form>
        )}
      </Card.Body>
    </Card>
  );
}

export default function OTPInputSection() {
  return (
    <Stack>
      <Row label="Sign-in verification · bound to useForm · submits when complete · server error by path">
        <VerifyStep />
      </Row>
      <Row label="Variants: PIN (masked, 4) · recovery code (letters and digits, 4 + 4) · invalid · disabled">
        <Grid>
          <Field data-testid="otp-pin">
            <Field.Label>Card PIN</Field.Label>
            <OTPInput length={4} mask />
          </Field>
          <Field data-testid="otp-recovery">
            <Field.Label>Recovery code</Field.Label>
            <OTPInput length={8} mode="alphanumeric" groups={[4, 4]} defaultValue="K7QD" />
            <Field.Description>From the list you saved when you turned on two-step sign-in.</Field.Description>
          </Field>
          <Field>
            <Field.Label>Verification code</Field.Label>
            <OTPInput defaultValue="135790" />
            <Field.Error>That code has expired. We sent you a new one.</Field.Error>
          </Field>
          <Field disabled>
            <Field.Label>Verification code</Field.Label>
            <OTPInput defaultValue="12" />
          </Field>
        </Grid>
      </Row>
      <Row label="Compact subtree · RTL page (the digits stay left to right)">
        <Grid>
          <div data-density="compact">
            <Field>
              <Field.Label>Verification code</Field.Label>
              <OTPInput groups={[3, 3]} defaultValue="4821" />
            </Field>
          </div>
          <div dir="rtl">
            <Field>
              <Field.Label>رمز التحقق</Field.Label>
              <OTPInput defaultValue="1234" labels={{ length: (n) => `، ${n} أرقام` }} />
            </Field>
          </div>
        </Grid>
      </Row>
    </Stack>
  );
}
