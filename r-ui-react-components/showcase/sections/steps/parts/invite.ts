// The "Invite your team" wizard's model: a hand-written Standard Schema (the
// demo takes no validator dependency), the step-2 check against existing
// members, and a pretend invite service.

import type { StandardSchemaIssue, StandardSchemaV1, WizardStepErrors } from "../../../../src";

export const PLANS = [
  { value: "starter", label: "Starter" },
  { value: "team", label: "Team" },
  { value: "business", label: "Business" },
] as const;

export const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
] as const;

export interface MemberInput {
  email: string;
  role: string;
}

export interface InviteInput {
  team: string;
  slug: string;
  plan: string;
  members: MemberInput[];
  channel: string;
  welcome: boolean;
  message: string;
}

export const EMPTY_MEMBER: MemberInput = { email: "", role: "member" };

export const DEFAULT_INVITE: InviteInput = {
  team: "",
  slug: "",
  plan: "team",
  members: [{ ...EMPTY_MEMBER }],
  channel: "",
  welcome: true,
  message: "",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const inviteSchema: StandardSchemaV1<InviteInput> = {
  "~standard": {
    version: 1,
    vendor: "showcase",
    validate(input) {
      const v = input as InviteInput;
      const issues: StandardSchemaIssue[] = [];
      const at = (message: string, ...path: Array<string | number>) => issues.push({ message, path });
      if (!v.team.trim()) at("Name the team", "team");
      if (!v.slug.trim()) at("Choose a workspace URL", "slug");
      else if (!/^[a-z0-9-]+$/.test(v.slug)) at("Lowercase letters, digits and hyphens only", "slug");
      if (v.members.length === 0) at("Invite at least one person", "members");
      const seen = new Set<string>();
      v.members.forEach((m, i) => {
        const email = m.email.trim().toLowerCase();
        if (!email) at("Enter an email address", "members", i, "email");
        else if (!EMAIL.test(email)) at("Enter an email address like name@example.com", "members", i, "email");
        else if (seen.has(email)) at("This address is already on the list", "members", i, "email");
        seen.add(email);
        if (!m.role) at("Choose a role", "members", i, "role");
      });
      if (v.channel && !/^#[a-z0-9-]+$/.test(v.channel)) at("A channel looks like #team-alerts", "channel");
      return issues.length ? { issues } : { value: v };
    },
  },
};

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

const ALREADY_MEMBERS = new Set(["ada@example.com", "grace@example.com"]);

/** Step 2's own check, as a server would answer it: slowly, cancellable, errors by path. */
export async function checkMembers({
  values,
  signal,
}: {
  values: InviteInput;
  signal: AbortSignal;
}): Promise<WizardStepErrors> {
  await wait(600, signal);
  const errors: WizardStepErrors = {};
  values.members.forEach((m, i) => {
    if (ALREADY_MEMBERS.has(m.email.trim().toLowerCase()))
      errors[`members[${i}].email`] = `${m.email.trim()} is already in this workspace`;
  });
  return errors;
}
