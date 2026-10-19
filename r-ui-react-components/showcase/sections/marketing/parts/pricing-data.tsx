import { ArrowRight } from "lucide-react";

import { Button, type PricingPlan, type PricingTableGroup } from "../../../../src";

/** Demo plans in US dollars: free, the one to steer toward, and a bigger one. */
export const PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "One repository, for trying it on a side project.",
    price: { monthly: 0 },
    priceNote: "Free forever",
    features: ["1 repository", "10 releases a month", "Docs page and RSS", { label: "Review before publishing", included: false }],
    action: <Button variant="secondary">Start free</Button>,
  },
  {
    id: "team",
    name: "Team",
    description: "For a product team that ships every week.",
    price: { monthly: 12, annual: 120 },
    priceNote: "per editor",
    highlighted: true,
    features: ["Unlimited repositories", "Unlimited releases", "Review before publishing", "Email and in-app channels"],
    action: <Button iconEnd={<ArrowRight />}>Start a 14-day trial</Button>,
  },
  {
    id: "business",
    name: "Business",
    description: "Several teams, one voice, and the controls IT asks for.",
    price: { monthly: 25, annual: 240 },
    priceNote: "per editor",
    features: ["Everything in Team", "Single sign-on", "Audit log", "Priority support"],
    action: <Button variant="secondary">Start a trial</Button>,
  },
];

/** The comparison under the cards, grouped, with explanations on some feature names. */
export const GROUPS: PricingTableGroup[] = [
  {
    id: "publishing",
    label: "Publishing",
    features: [
      { id: "repos", label: "Repositories", values: { starter: "1", team: "No limit", business: "No limit" } },
      { id: "releases", label: "Releases", values: { starter: "10 a month", team: "No limit", business: "No limit" } },
      { id: "rss", label: "Docs page and RSS", values: { starter: true, team: true, business: true } },
      {
        id: "channels",
        label: "Channels",
        description: "Where a release note is published: your docs, the in-app panel, email and RSS.",
        values: { starter: "Docs and RSS", team: "All four", business: "All four" },
      },
    ],
  },
  {
    id: "review",
    label: "Review",
    features: [
      {
        id: "approval",
        label: "Review before publishing",
        description: "A note waits for an editor's approval before it goes out.",
        values: { starter: false, team: true, business: true },
      },
      { id: "style", label: "House style rules", values: { starter: false, team: true, business: true } },
    ],
  },
  {
    id: "security",
    label: "Security and support",
    features: [
      {
        id: "sso",
        label: "Single sign-on",
        description: "Editors sign in through your identity provider (SAML or OIDC).",
        values: { starter: false, team: false, business: true },
      },
      {
        id: "audit",
        label: "Audit log",
        description: "Every edit, approval and publish, with who did it and when, kept for a year.",
        values: { starter: false, team: false, business: true },
      },
      { id: "support", label: "Support", values: { starter: "Community", team: "Email", business: "Priority, 4h" } },
    ],
  },
];
