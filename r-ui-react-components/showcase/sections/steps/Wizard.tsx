import { Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { DescriptionList } from "../../../src/components/data";
import {
  Field,
  Input,
  Select,
  SegmentedControl,
  Switch,
  Textarea,
  useFieldArray,
  useForm,
  useFormValue,
} from "../../../src/components/form";
import { Alert, Button, Card, IconButton } from "../../../src/components/primitives";
import { Wizard } from "../../../src/components/steps";
import { MISSING } from "../../../src/util/format";
import { Row, Stack } from "../form/parts/demo";
import {
  checkMembers,
  DEFAULT_INVITE,
  EMPTY_MEMBER,
  type InviteInput,
  inviteSchema,
  PLANS,
  ROLES,
} from "./parts/invite";

export const meta = {
  title: "Wizard",
  group: "steps",
  order: 20,
  description:
    "A multi-step flow over one useForm: each step names its fields, and Next checks only those (step 2 also asks the server whether anyone is already a member), focusing the first invalid field. Back keeps every value, Integrations can be skipped, and the last step submits the whole form. Every step change moves focus to the new step's heading. Try ada@example.com on step 2.",
};

function TeamStep() {
  return (
    <div className="@container">
      <div className="grid gap-r3 @xl:grid-cols-2">
        <Field name="team" required>
          <Field.Label>Team name</Field.Label>
          <Input autoComplete="organization" />
          <Field.Error />
        </Field>
        <Field name="slug" required>
          <Field.Label>Workspace URL</Field.Label>
          <Input autoComplete="off" spellCheck={false} start={<span className="text-body-2">r-ui.app/</span>} />
          <Field.Description>Lowercase letters, digits and hyphens.</Field.Description>
          <Field.Error />
        </Field>
        <Field name="plan">
          <Field.Label>Plan</Field.Label>
          <SegmentedControl>
            {PLANS.map((p) => (
              <SegmentedControl.Item key={p.value} value={p.value}>
                {p.label}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl>
        </Field>
      </div>
    </div>
  );
}

function MembersStep() {
  const { items, append, remove, error } = useFieldArray<{ email: string; role: string }>("members");
  const addRef = useRef<HTMLButtonElement>(null);
  return (
    <fieldset className="grid min-w-0 gap-r4">
      <legend className="mb-r4 text-body-2 text-fg-secondary">
        Everyone gets an email with a link to join. Admins can invite others later.
      </legend>
      {items.map((item) => {
        const n = item.index + 1;
        return (
          <div
            key={item.key}
            role="group"
            aria-label={`Person ${n}`}
            className="@container rounded-md border p-r3"
            data-row={item.key}
          >
            <div className="grid gap-r4 @md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_auto] @md:items-start">
              <Field name={`${item.name}.email`} required>
                <Field.Label>
                  Email<span className="sr-only"> (person {n})</span>
                </Field.Label>
                <Input type="email" autoComplete="off" spellCheck={false} />
                <Field.Error />
              </Field>
              <Field name={`${item.name}.role`}>
                <Field.Label>
                  Role<span className="sr-only"> (person {n})</span>
                </Field.Label>
                <Select>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="@md:mt-[calc(var(--BodyText-1-line-height)+var(--R-SIZE-5))]">
                <IconButton
                  label={`Remove person ${n}`}
                  icon={<Trash2 />}
                  disabled={items.length === 1}
                  onClick={() => {
                    remove(item.index);
                    addRef.current?.focus();
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
      {error && (
        <Alert tone="error" role="note" labels={{ tones: { error: "" } }}>
          {error}
        </Alert>
      )}
      <div>
        <Button ref={addRef} variant="secondary" iconStart={<Plus />} onClick={() => append({ ...EMPTY_MEMBER })}>
          Add another person
        </Button>
      </div>
    </fieldset>
  );
}

function IntegrationsStep() {
  const welcome = useFormValue<boolean>("welcome");
  return (
    <div className="grid gap-r3">
      <Field name="channel">
        <Field.Label>Slack channel</Field.Label>
        <Input placeholder="#team-alerts" autoComplete="off" spellCheck={false} />
        <Field.Description>Where we post when someone joins.</Field.Description>
        <Field.Error />
      </Field>
      <Field name="welcome">
        <Switch>Send a welcome message</Switch>
      </Field>
      {welcome && (
        <Field name="message">
          <Field.Label>Welcome message</Field.Label>
          <Textarea rows={3} placeholder="Say hello, link the onboarding doc…" />
        </Field>
      )}
    </div>
  );
}

function ReviewStep() {
  const team = useFormValue<string>("team");
  const slug = useFormValue<string>("slug");
  const plan = useFormValue<string>("plan");
  const members = useFormValue<InviteInput["members"]>("members");
  const channel = useFormValue<string>("channel");
  const welcome = useFormValue<boolean>("welcome");
  return (
    <div className="grid gap-r3">
      <p className="text-body-2 text-fg-secondary">
        Check the details, then send. Choose a completed step above to change it.
      </p>
      <DescriptionList variant="divided">
        <DescriptionList.Item term="Team">{team || MISSING}</DescriptionList.Item>
        <DescriptionList.Item term="Workspace">{slug ? `r-ui.app/${slug}` : MISSING}</DescriptionList.Item>
        <DescriptionList.Item term="Plan">{PLANS.find((p) => p.value === plan)?.label ?? MISSING}</DescriptionList.Item>
        <DescriptionList.Item term="People">
          {members.length ? (
            <ul className="grid gap-r6">
              {members.map((m, i) => (
                <li key={i} className="break-words">
                  {m.email || MISSING} · {ROLES.find((r) => r.value === m.role)?.label ?? MISSING}
                </li>
              ))}
            </ul>
          ) : (
            MISSING
          )}
        </DescriptionList.Item>
        <DescriptionList.Item term="Slack">{channel || MISSING}</DescriptionList.Item>
        <DescriptionList.Item term="Welcome message">{welcome ? "Yes" : "No"}</DescriptionList.Item>
      </DescriptionList>
    </div>
  );
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function InviteWizard({ sc }: { sc: string }) {
  const [step, setStep] = useState(0);
  const [sent, setSent] = useState<InviteInput | null>(null);
  const form = useForm({
    schema: inviteSchema,
    defaultValues: DEFAULT_INVITE,
    onSubmit: async (values) => {
      await pause(500);
      setSent(values);
    },
  });

  return (
    <Card data-sc={sc}>
      <Card.Header>
        <Card.Title>Invite your team</Card.Title>
        <Card.Description>Set up the workspace and send the invitations.</Card.Description>
      </Card.Header>
      <Card.Body>
        {sent ? (
          <Alert
            tone="success"
            title={`Invited ${sent.members.length} ${sent.members.length === 1 ? "person" : "people"} to ${sent.team}`}
            actions={
              <Button
                variant="secondary"
                onClick={() => {
                  form.reset();
                  setSent(null);
                  setStep(0);
                }}
              >
                Invite another team
              </Button>
            }
          >
            They will get an email with a link to r-ui.app/{sent.slug}.
          </Alert>
        ) : (
          <Wizard
            form={form}
            step={step}
            onStepChange={setStep}
            label="Invite progress"
            headingLevel={4}
            labels={{ finish: "Send invites" }}
          >
            <Wizard.Step label="Team" description="Name, URL and plan" fields={["team", "slug", "plan"]}>
              <TeamStep />
            </Wizard.Step>
            <Wizard.Step<InviteInput>
              label="People"
              description="Who to invite"
              fields={["members"]}
              validate={checkMembers}
            >
              <MembersStep />
            </Wizard.Step>
            <Wizard.Step
              label="Integrations"
              description="Slack and a welcome"
              optional
              fields={["channel", "welcome", "message"]}
            >
              <IntegrationsStep />
            </Wizard.Step>
            <Wizard.Step label="Review" description="Check and send">
              <ReviewStep />
            </Wizard.Step>
          </Wizard>
        )}
      </Card.Body>
    </Card>
  );
}

function PlainTour() {
  const [done, setDone] = useState(false);
  return done ? (
    <Alert
      tone="success"
      title="You're set up"
      actions={
        <Button variant="secondary" onClick={() => setDone(false)}>
          Replay
        </Button>
      }
    >
      The tour is in Help whenever you want it again.
    </Alert>
  ) : (
    <Wizard
      orientation="vertical"
      label="Tour"
      headingLevel={4}
      onComplete={() => setDone(true)}
      labels={{ finish: "Got it" }}
    >
      <Wizard.Step label="Dashboards" description="What you watch">
        <p className="text-body-1 text-fg-secondary">
          Pin the services you own; their health sits at the top of every page.
        </p>
      </Wizard.Step>
      <Wizard.Step label="Alerts" description="What wakes you">
        <p className="text-body-1 text-fg-secondary">
          Rules page on-call only for urgent problems; the rest wait for the digest.
        </p>
      </Wizard.Step>
      <Wizard.Step label="Incidents" description="What happened">
        <p className="text-body-1 text-fg-secondary">
          Every page opens an incident with its own timeline you can export.
        </p>
      </Wizard.Step>
    </Wizard>
  );
}

export default function WizardSection() {
  return (
    <Stack>
      <Row label="Invite your team · step 2 checks the server (try ada@example.com) · Integrations is optional">
        <InviteWizard sc="wizard-invite" />
      </Row>
      <Row label="Compact density">
        <div data-density="compact">
          <InviteWizard sc="wizard-compact" />
        </div>
      </Row>
      <Row label="Narrow container · the Stepper collapses to “Step n of m · name”">
        <div className="max-w-column-lg">
          <InviteWizard sc="wizard-narrow" />
        </div>
      </Row>
      <Row label="Plain steps, no form · vertical Stepper beside the step">
        <div className="max-w-page" data-sc="wizard-plain">
          <PlainTour />
        </div>
      </Row>
    </Stack>
  );
}
