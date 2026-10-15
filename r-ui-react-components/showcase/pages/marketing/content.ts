/**
 * Copy for the Marketing page's fictional product, Kiln. Kept apart from the
 * layout so the sections read as structure. String literals here are scanned by
 * `verify:no-raw-tailwind` like any class string, so no hex-like "#123" tokens.
 */

export const PRODUCT = "Kiln";

export const NAV = [
  { anchor: "features", label: "Product" },
  { anchor: "journal", label: "Journal" },
  { anchor: "pricing", label: "Pricing" },
  { anchor: "faq", label: "FAQ" },
] as const;

export const CUSTOMERS = ["Halden Labs", "Northpine", "Corvid Health", "Tessellate", "Brightwater Freight", "Marrow & Fig"];

export interface Feature {
  icon: "merge" | "audience" | "edit" | "publish" | "review" | "read";
  title: string;
  body: string;
}

export const FEATURES: Feature[] = [
  {
    icon: "merge",
    title: "Drafts from merged work",
    body: "Kiln reads the titles, descriptions and labels of merged pull requests and writes a first draft in plain language. Internal refactors stay out.",
  },
  {
    icon: "audience",
    title: "Sorted by who it affects",
    body: "Admins, developers and everyday users each see the changes that matter to them, under headings they recognise.",
  },
  {
    icon: "edit",
    title: "An editor, not a generator",
    body: "Every sentence is yours to change. Kiln keeps your edits and learns your house style, one release at a time.",
  },
  {
    icon: "publish",
    title: "Publish everywhere at once",
    body: "One release goes to your docs, an in-app panel, an RSS feed and an email digest, each formatted for where it lands.",
  },
  {
    icon: "review",
    title: "Reviewed before it ships",
    body: "Drafts wait for an approver. Nothing reaches a customer until someone on your team says so.",
  },
  {
    icon: "read",
    title: "Know what was read",
    body: "See which notes were opened and which links were followed, without tracking pixels in anyone's inbox.",
  },
];

export const SAMPLE_REPOS = [
  { value: "kiln", label: "Kiln's own repository" },
  { value: "rails", label: "A sample Rails app" },
  { value: "ios", label: "A sample iOS app" },
  { value: "cli", label: "A sample command-line tool" },
] as const;

/** A plan's price per editor per month, in US dollars; 0 is free. */
export interface Plan {
  id: "starter" | "team" | "business";
  name: string;
  price: number;
  note: string;
  recommended?: boolean;
}

export const PLANS: Plan[] = [
  { id: "starter", name: "Starter", price: 0, note: "One repository" },
  { id: "team", name: "Team", price: 12, note: "per editor / month", recommended: true },
  { id: "business", name: "Business", price: 24, note: "per editor / month" },
];

/** `true` = included, `false` = not included, a string = included with that limit. */
export type PlanValue = boolean | string;

export const PLAN_ROWS: { feature: string; values: Record<Plan["id"], PlanValue> }[] = [
  { feature: "Repositories", values: { starter: "1", team: "No limit", business: "No limit" } },
  { feature: "Releases", values: { starter: "10 a month", team: "No limit", business: "No limit" } },
  { feature: "Docs page and RSS", values: { starter: true, team: true, business: true } },
  { feature: "In-app panel and email", values: { starter: false, team: true, business: true } },
  { feature: "Approval before publishing", values: { starter: false, team: true, business: true } },
  { feature: "Reader segments", values: { starter: false, team: "3", business: "No limit" } },
  { feature: "SSO and SCIM", values: { starter: false, team: false, business: true } },
  { feature: "Audit log", values: { starter: false, team: false, business: true } },
  { feature: "Support", values: { starter: "Forum", team: "Email", business: "Named contact" } },
];

export interface Question {
  q: string;
  a: string;
}

export const FAQ: { id: string; label: string; questions: Question[] }[] = [
  {
    id: "setup",
    label: "Setup",
    questions: [
      {
        q: "Which code hosts do you support?",
        a: "GitHub and GitLab, cloud or self-managed. Bitbucket support is planned for early next year.",
      },
      {
        q: "Do we have to change how we write pull requests?",
        a: "No. Kiln works from titles alone. Labels and a one-line summary make the drafts better, and the journal essay above shows how.",
      },
      {
        q: "How long does setup take?",
        a: "Most teams connect a repository and publish their first release in under fifteen minutes.",
      },
      {
        q: "Can we bring our old changelog?",
        a: "Yes. Paste its address or upload Markdown, and Kiln keeps your history and your existing links.",
      },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    questions: [
      {
        q: "Who counts as an editor?",
        a: "Anyone who can write, edit or approve a release. Readers, including the rest of your company, are free.",
      },
      {
        q: "Is there a contract?",
        a: "Pay monthly or yearly. Yearly plans get two months free, and you can switch at any renewal.",
      },
      {
        q: "What happens if we cancel?",
        a: "Your published notes stay online for 90 days, and you can export everything as Markdown at any time.",
      },
    ],
  },
  {
    id: "security",
    label: "Security",
    questions: [
      {
        q: "Does Kiln read our source code?",
        a: "No. It reads pull request metadata: titles, descriptions, labels and the paths of changed files. It never clones a repository.",
      },
      {
        q: "Where is our data stored?",
        a: "In the EU or the US, chosen when you create a workspace. Data is encrypted at rest and in transit.",
      },
      {
        q: "Do you have a SOC 2 report?",
        a: "Yes, SOC 2 Type II. Business customers can request it, along with our latest penetration test summary.",
      },
    ],
  },
];

export const FOOTER = [
  { title: "Product", links: ["Features", "Pricing", "Changelog", "Integrations"] },
  { title: "Resources", links: ["Documentation", "Journal", "Field guide", "Status"] },
  { title: "Company", links: ["About", "Careers", "Security", "Contact"] },
];

export const LEGAL = ["Privacy", "Terms", "Cookie settings"];
