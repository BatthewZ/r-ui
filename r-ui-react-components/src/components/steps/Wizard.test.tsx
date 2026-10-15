import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Field, Input, useForm, type ValidationTrigger } from "../form";
import { defineSchema, deferred, issue } from "../form/form-state.test.schema";

import { Wizard, type WizardProps, type WizardStepErrors } from "./Wizard";

interface Invite {
  team: string;
  slug: string;
  email: string;
  role: string;
  note: string;
}

const EMPTY: Invite = { team: "", slug: "", email: "", role: "", note: "" };

const schema = defineSchema<Invite>((v) => [
  ...(v.team ? [] : [issue("Name the team", "team")]),
  ...(v.slug ? [] : [issue("Choose a URL", "slug")]),
  ...(v.email.includes("@") ? [] : [issue("Enter an email address", "email")]),
  ...(v.role ? [] : [issue("Choose a role", "role")]),
]);

interface Options {
  onSubmit?: (values: Invite) => void;
  validateOn?: ValidationTrigger;
  validateMembers?: (ctx: { values: Invite; signal: AbortSignal }) => WizardStepErrors | Promise<WizardStepErrors>;
  checkEmail?: (value: unknown, ctx: { signal: AbortSignal }) => string | undefined | Promise<string | undefined>;
  wizard?: Partial<WizardProps<Invite, Invite>>;
}

function InviteWizard({ onSubmit, validateOn, validateMembers, checkEmail, wizard }: Options) {
  const form = useForm({ schema, defaultValues: EMPTY, onSubmit, validateOn });
  return (
    <Wizard form={form} labels={{ finish: "Send invites" }} {...wizard}>
      <Wizard.Step label="Team" fields={["team", "slug"]}>
        <Field name="team">
          <Field.Label>Team name</Field.Label>
          <Input />
          <Field.Error />
        </Field>
        <Field name="slug">
          <Field.Label>URL</Field.Label>
          <Input />
          <Field.Error />
        </Field>
      </Wizard.Step>
      <Wizard.Step<Invite> label="Members" fields={["email", "role"]} validate={validateMembers}>
        <Field name="email" validate={checkEmail}>
          <Field.Label>Email</Field.Label>
          <Input />
          <Field.Error />
        </Field>
        <Field name="role">
          <Field.Label>Role</Field.Label>
          <Input />
          <Field.Error />
        </Field>
      </Wizard.Step>
      <Wizard.Step label="Note" optional fields={["note"]}>
        <Field name="note">
          <Field.Label>Welcome note</Field.Label>
          <Input />
        </Field>
      </Wizard.Step>
      <Wizard.Step label="Review">
        <p>Check and send.</p>
      </Wizard.Step>
    </Wizard>
  );
}

const next = () => screen.getByRole("button", { name: "Next" });
const heading = () => screen.getByRole("heading", { level: 2 });

async function fillTeam(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("textbox", { name: "Team name" }), "Platform");
  await user.type(screen.getByRole("textbox", { name: "URL" }), "platform");
}

describe("Wizard", () => {
  it("renders the current step under a heading that says where it is, and only that step", () => {
    render(<InviteWizard />);
    expect(heading()).toHaveTextContent("Step 1 of 4: Team");
    expect(screen.getByRole("textbox", { name: "Team name" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Email" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    // Mounting moves no focus.
    expect(document.body).toHaveFocus();
  });

  it("blocks Next on an invalid step, shows only that step's errors and focuses the first invalid field", async () => {
    const user = userEvent.setup();
    render(<InviteWizard />);
    await user.type(screen.getByRole("textbox", { name: "URL" }), "platform");
    await user.click(next());
    const team = screen.getByRole("textbox", { name: "Team name" });
    await waitFor(() => expect(team).toHaveFocus());
    expect(team).toHaveAttribute("aria-invalid", "true");
    expect(team).toHaveAccessibleDescription("Name the team");
    expect(screen.getByRole("textbox", { name: "URL" })).not.toHaveAttribute("aria-invalid");
    expect(heading()).toHaveTextContent("Team");
    // The current step's marker says it needs attention.
    const list = within(screen.getByRole("navigation", { name: "Progress" })).getByRole("list");
    expect(within(list).getByText("Needs attention")).toBeInTheDocument();
    expect(within(list).getAllByRole("listitem")[0]).toHaveAttribute("data-status", "error");
  });

  it("reveals the step's errors whatever validateOn says", async () => {
    const user = userEvent.setup();
    render(<InviteWizard validateOn="submit" />);
    await user.click(next());
    const team = screen.getByRole("textbox", { name: "Team name" });
    await waitFor(() => expect(team).toHaveFocus());
    expect(team).toHaveAccessibleDescription("Name the team");
  });

  it("advances on a valid step (Enter in a field is Next), moving focus to the new heading", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<InviteWizard onSubmit={onSubmit} />);
    await fillTeam(user);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(heading()).toHaveTextContent("Step 2 of 4: Members"));
    expect(heading()).toHaveFocus();
    // Later steps' errors stay hidden; nothing was submitted.
    expect(screen.getByRole("textbox", { name: "Email" })).not.toHaveAttribute("aria-invalid");
    expect(onSubmit).toHaveBeenCalledTimes(0);
  });

  it("keeps focus in the field while an action is pressed, so a blur-time error cannot shift the row under the pointer", async () => {
    const user = userEvent.setup();
    render(<InviteWizard wizard={{ defaultStep: 2 }} />);
    const note = screen.getByRole("textbox", { name: "Welcome note" });
    await user.click(note);
    // `false`: the press's default (moving focus to the button) was prevented.
    for (const name of ["Back", "Skip", "Next"]) expect(fireEvent.mouseDown(screen.getByRole("button", { name }))).toBe(false);
    expect(note).toHaveFocus();
  });

  it("keeps values on Back, and makes only completed steps selectable", async () => {
    const user = userEvent.setup();
    render(<InviteWizard />);
    await fillTeam(user);
    await user.click(next());
    await waitFor(() => expect(heading()).toHaveTextContent("Members"));
    const nav = screen.getByRole("navigation", { name: "Progress" });
    expect(
      within(nav)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual([expect.stringContaining("Team")]);
    await user.type(screen.getByRole("textbox", { name: "Email" }), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(heading()).toHaveTextContent("Team");
    expect(heading()).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Team name" })).toHaveValue("Platform");
    await user.click(next());
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("ada@example.com"));
    // A completed step in the Stepper goes back there, without validating the current one.
    await user.clear(screen.getByRole("textbox", { name: "Email" }));
    await user.click(within(nav).getByRole("button", { name: "Team, Completed" }));
    expect(heading()).toHaveTextContent("Team");
  });

  it("waits for a field's async check within the step, busy, and blocks on its answer", async () => {
    const user = userEvent.setup();
    const answer = deferred<string | undefined>();
    const checkEmail = vi.fn(() => answer.promise);
    render(<InviteWizard checkEmail={checkEmail} />);
    await fillTeam(user);
    await user.click(next());
    await waitFor(() => expect(heading()).toHaveTextContent("Members"));
    await user.type(screen.getByRole("textbox", { name: "Email" }), "ada@example.com");
    await user.type(screen.getByRole("textbox", { name: "Role" }), "admin");
    await user.click(next());
    await waitFor(() => expect(next()).toHaveAttribute("aria-busy", "true"));
    await act(async () => answer.resolve("Ada is already a member"));
    const email = screen.getByRole("textbox", { name: "Email" });
    await waitFor(() => expect(email).toHaveFocus());
    expect(email).toHaveAccessibleDescription("Ada is already a member");
    expect(heading()).toHaveTextContent("Members");
    expect(next()).not.toHaveAttribute("aria-busy");
  });

  it("runs the step's own validate once its fields pass, and shows its errors by path", async () => {
    const user = userEvent.setup();
    const validateMembers = vi.fn(({ values }: { values: Invite }) =>
      Promise.resolve(values.role === "owner" ? { role: "Only one owner per team" } : {}),
    );
    render(<InviteWizard validateMembers={validateMembers} />);
    await fillTeam(user);
    await user.click(next());
    await waitFor(() => expect(heading()).toHaveTextContent("Members"));
    // Fields failing: the step check is not asked.
    await user.click(next());
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Email" })).toHaveFocus());
    expect(validateMembers).toHaveBeenCalledTimes(0);
    await user.type(screen.getByRole("textbox", { name: "Email" }), "ada@example.com");
    await user.type(screen.getByRole("textbox", { name: "Role" }), "owner");
    await user.click(next());
    const role = screen.getByRole("textbox", { name: "Role" });
    await waitFor(() => expect(role).toHaveFocus());
    expect(role).toHaveAccessibleDescription("Only one owner per team");
    expect(validateMembers).toHaveBeenCalledTimes(1);
    await user.clear(role);
    await user.type(role, "member");
    await user.click(next());
    await waitFor(() => expect(heading()).toHaveTextContent("Note"));
    expect(validateMembers).toHaveBeenCalledTimes(2);
  });

  it("aborts a pending step check when the user goes Back", async () => {
    const user = userEvent.setup();
    let signal: AbortSignal | undefined;
    const validateMembers = vi.fn((ctx: { signal: AbortSignal }) => {
      signal = ctx.signal;
      return new Promise<WizardStepErrors>(() => {});
    });
    render(<InviteWizard validateMembers={validateMembers} />);
    await fillTeam(user);
    await user.click(next());
    await waitFor(() => expect(heading()).toHaveTextContent("Members"));
    await user.type(screen.getByRole("textbox", { name: "Email" }), "ada@example.com");
    await user.type(screen.getByRole("textbox", { name: "Role" }), "admin");
    await user.click(next());
    await waitFor(() => expect(validateMembers).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(signal?.aborted).toBe(true);
    expect(heading()).toHaveTextContent("Team");
  });

  it("skips an optional step without validating it, and says so", async () => {
    const user = userEvent.setup();
    render(<InviteWizard wizard={{ defaultStep: 2 }} />);
    expect(heading()).toHaveTextContent("Note");
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(heading()).toHaveTextContent("Review");
    expect(screen.getByRole("button", { name: "Note Skipped · Optional" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
  });

  it("submits the whole form from the last step, once", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onComplete = vi.fn();
    render(<InviteWizard onSubmit={onSubmit} wizard={{ onComplete }} />);
    await fillTeam(user);
    await user.click(next());
    await waitFor(() => expect(heading()).toHaveTextContent("Members"));
    await user.type(screen.getByRole("textbox", { name: "Email" }), "ada@example.com");
    await user.type(screen.getByRole("textbox", { name: "Role" }), "admin");
    await user.click(next());
    await waitFor(() => expect(heading()).toHaveTextContent("Note"));
    await user.type(screen.getByRole("textbox", { name: "Welcome note" }), "Hi");
    await user.click(next());
    await waitFor(() => expect(heading()).toHaveTextContent("Review"));
    await user.click(screen.getByRole("button", { name: "Send invites" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      team: "Platform",
      slug: "platform",
      email: "ada@example.com",
      role: "admin",
      note: "Hi",
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("takes a failed final submit back to the first step with an error, focusing its field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<InviteWizard onSubmit={onSubmit} wizard={{ defaultStep: 3 }} />);
    await user.click(screen.getByRole("button", { name: "Send invites" }));
    const team = await screen.findByRole("textbox", { name: "Team name" });
    await waitFor(() => expect(team).toHaveFocus());
    expect(team).toHaveAccessibleDescription("Name the team");
    expect(onSubmit).toHaveBeenCalledTimes(0);
    // Both steps with errors say so.
    const list = within(screen.getByRole("navigation", { name: "Progress" })).getByRole("list");
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((li) => li.dataset.status),
    ).toEqual(["error", "error", undefined, undefined]);
  });

  it("follows a controlled step, asking the parent", async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    function Controlled() {
      const [step, setStep] = useState(1);
      return (
        <InviteWizard
          wizard={{
            step,
            onStepChange: (n) => {
              onStepChange(n);
              if (n !== 0) setStep(n); // refuses to go back to the start
            },
          }}
        />
      );
    }
    render(<Controlled />);
    expect(heading()).toHaveTextContent("Members");
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onStepChange).toHaveBeenCalledTimes(1);
    expect(onStepChange).toHaveBeenCalledWith(0);
    expect(heading()).toHaveTextContent("Members");
  });

  it("works with plain steps and no form", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(
      <Wizard onComplete={onComplete} headingLevel={3}>
        <Wizard.Step label="Welcome">Hello</Wizard.Step>
        <Wizard.Step label="Done">Bye</Wizard.Step>
      </Wizard>,
    );
    expect(document.querySelector("form")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Step 2 of 2: Done");
    expect(screen.getByRole("heading", { level: 3 })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("counts steps inside fragments, and speaks its labels (the Stepper's name included)", async () => {
    const user = userEvent.setup();
    render(
      <Wizard labels={{ progress: "Fortschritt", next: "Weiter", position: (n, total) => `Schritt ${n} von ${total}` }}>
        <>
          <Wizard.Step label="Willkommen">Hallo</Wizard.Step>
          <Wizard.Step label="Team">Wer</Wizard.Step>
        </>
        {false}
        <Wizard.Step label="Fertig">Tschüss</Wizard.Step>
      </Wizard>,
    );
    expect(screen.getByRole("navigation", { name: "Fortschritt" })).toBeInTheDocument();
    expect(screen.getByRole("heading")).toHaveTextContent("Schritt 1 von 3: Willkommen");
    await user.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByRole("heading")).toHaveTextContent("Schritt 2 von 3: Team");
    expect(screen.getByText("Wer")).toBeInTheDocument();
  });
});
