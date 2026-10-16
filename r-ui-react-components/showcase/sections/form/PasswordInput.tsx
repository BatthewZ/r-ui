import { useState } from "react";

import {
  ErrorSummary,
  Field,
  Form,
  FormActions,
  Input,
  PasswordInput,
  type PasswordStrength,
  useForm,
} from "../../../src/components/form";
import { StatusLabel } from "../../../src/components/primitives";
import { LocaleProvider, type LocaleLabels } from "../../../src/util/locale";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "PasswordInput",
  group: "form",
  order: 25,
  description:
    "A password field: the eye button shows the text (aria-pressed; focus and the caret stay where they were), Caps Lock is flagged while typing, autocomplete tells a password manager which password it is, and an optional strength meter (role meter, its score in words, with hints) follows the text. The estimator is pluggable; the built-in one has no dependency. A submit hides the password again.",
};

type Signup = { email: string; password: string; confirm: string };

/** A sign-up: new-password with the strength meter, a confirmation checked against it. */
function SignupForm() {
  const [created, setCreated] = useState<string | null>(null);
  const form = useForm<Signup>({
    defaultValues: { email: "", password: "", confirm: "" },
    validateOn: "blur",
    onSubmit: async ({ email }) => {
      await new Promise((done) => setTimeout(done, 400));
      setCreated(email);
    },
  });
  return (
    <Form form={form} className="grid max-w-column-lg content-start gap-r3" data-sc="password-signup">
      <ErrorSummary />
      <Field name="email" required validate={(value) => (String(value ?? "").includes("@") ? undefined : "Enter an email address.")}>
        <Field.Label>Email</Field.Label>
        <Input type="email" autoComplete="email" />
        <Field.Error />
      </Field>
      <Field
        name="password"
        required
        validate={(value) => (String(value ?? "").length >= 12 ? undefined : "Use at least 12 characters.")}
      >
        <Field.Label>Password</Field.Label>
        <PasswordInput autoComplete="new-password" strength minStrengthLength={12} />
        <Field.Description>12 characters or more. A few words together is easy to remember.</Field.Description>
        <Field.Error />
      </Field>
      <Field
        name="confirm"
        required
        validate={(value, { values }) =>
          value === (values as Signup).password ? undefined : "The two passwords are not the same."
        }
      >
        <Field.Label>Confirm password</Field.Label>
        <PasswordInput autoComplete="new-password" />
        <Field.Error />
      </Field>
      <FormActions>
        <FormActions.Submit>Create account</FormActions.Submit>
      </FormActions>
      <output data-sc="password-created">{created ? <StatusLabel tone="success">Account created for {created}.</StatusLabel> : null}</output>
    </Form>
  );
}

/** A policy check as a pluggable estimator: what a server's rules would say. */
const policy = (value: string): PasswordStrength => {
  const missing = [
    value.length >= 10 ? null : "10 characters or more.",
    /\d/.test(value) ? null : "A number.",
    /[^\p{L}\d]/u.test(value) ? null : "A symbol.",
  ].filter((hint): hint is string => hint !== null);
  const score = (4 - Math.min(4, missing.length + (value.length < 6 ? 1 : 0))) as PasswordStrength["score"];
  return { score, label: missing.length === 0 ? "Meets the policy" : `${missing.length} to go`, hints: missing };
};

/** Module scope: a provider's labels object must stay stable. */
const ARABIC: LocaleLabels = {
  PasswordInput: {
    show: "إظهار كلمة المرور",
    strength: "قوة كلمة المرور",
    capsLock: "مفتاح الأحرف الكبيرة مفعّل.",
    scores: ["ضعيفة جدًا", "ضعيفة", "متوسطة", "قوية", "قوية جدًا"],
    tooShort: (n) => `استخدم ${n} أحرف على الأقل.`,
    common: "تجنّب كلمات المرور والكلمات الشائعة.",
    patterns: "تجنّب الأحرف المكررة والتسلسلات.",
    mixCase: "اخلط الأحرف الكبيرة والصغيرة.",
    addDigitOrSymbol: "أضف رقمًا أو رمزًا.",
    longer: "بضعة أحرف أخرى تجعلها أقوى بكثير.",
  },
};

export default function PasswordInputSection() {
  return (
    <Stack>
      <Row label="Sign-up: new-password with the strength meter and hints · a confirmation compared by a field check · bound through Field name">
        <SignupForm />
      </Row>
      <Row label="Sign in (current-password, Caps Lock warning) · a pluggable estimator (a policy) · shown by default · invalid · disabled">
        <Grid>
          <Field data-sc="password-signin">
            <Field.Label>Password</Field.Label>
            <PasswordInput defaultValue="correct horse" />
            <Field.Description>Turn on Caps Lock and type: the field warns.</Field.Description>
          </Field>
          <Field>
            <Field.Label>New API secret</Field.Label>
            <PasswordInput autoComplete="new-password" strength={policy} defaultValue="hunter2" />
          </Field>
          <Field>
            <Field.Label>Wi-Fi password</Field.Label>
            <PasswordInput autoComplete="off" defaultVisible defaultValue="guest-network-2026" />
          </Field>
          <Field invalid>
            <Field.Label>Password</Field.Label>
            <PasswordInput defaultValue="wrong" />
            <Field.Error>That password is not right. 2 tries left.</Field.Error>
          </Field>
          <Field disabled>
            <Field.Label>Password</Field.Label>
            <PasswordInput defaultValue="locked" strength />
          </Field>
          <Field readOnly>
            <Field.Label>Generated password</Field.Label>
            <PasswordInput defaultValue="Ux7#pL2!qZ9@" strength />
          </Field>
        </Grid>
      </Row>
      <Row label="Long label and hints · compact subtree · RTL with translated labels">
        <Grid>
          <Field>
            <Field.Label>Choose a password for the shared operations vault used by every on-call engineer</Field.Label>
            <PasswordInput autoComplete="new-password" strength defaultValue="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" />
          </Field>
          <div data-density="compact">
            <Field>
              <Field.Label>Password</Field.Label>
              <PasswordInput autoComplete="new-password" strength defaultValue="Tr0ub4dor&3" />
            </Field>
          </div>
          <LocaleProvider
            dir="rtl"
            locale="ar"
            labels={ARABIC}
          >
            <Field>
              <Field.Label>كلمة المرور</Field.Label>
              <PasswordInput autoComplete="new-password" strength defaultValue="Xk9#mQ2$" />
            </Field>
          </LocaleProvider>
        </Grid>
      </Row>
    </Stack>
  );
}
