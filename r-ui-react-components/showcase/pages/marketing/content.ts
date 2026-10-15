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

export interface Post {
  slug: string;
  title: string;
  description: string;
  author: string;
  date: string;
  minutes: number;
  /** The kind of piece, shown as a badge; omitted for an ordinary essay. */
  kind?: string;
  /** The cover's file name under `art/`; without one the card shows its placeholder. */
  art?: "pages" | "readers" | "kiln" | "grid";
}

export const POSTS: Post[] = [
  {
    slug: "group-by-reader",
    title: "Group by reader: one release, three audiences",
    description: "Admins, developers and everyone else want different things from the same release. How to give each their own section without writing three notes.",
    author: "Maya Okafor",
    date: "2026-09-30",
    minutes: 6,
    kind: "Guide",
    art: "readers",
  },
  {
    slug: "release-day",
    title: "What we changed about release day",
    description: "We moved the release meeting to after the note was published. It got shorter.",
    author: "Joris van Dijk",
    date: "2026-09-12",
    minutes: 4,
    art: "kiln",
  },
  {
    slug: "permissions",
    title: "Writing about permissions without frightening anyone",
    description: "Security changes are the ones admins read most carefully. Say what changed, who it affects and whether anything needs doing, in that order.",
    author: "Ines Albrecht",
    date: "2026-08-28",
    minutes: 7,
    art: "grid",
  },
  {
    slug: "house-style",
    title: "A house style for release notes, in nine rules",
    description: "Tense, person, numbers, dates and the word “various”. The style sheet we give every new editor.",
    author: "Maya Okafor",
    date: "2026-08-14",
    minutes: 5,
    kind: "Template",
    art: "pages",
  },
];

export interface Quote {
  quote: string;
  name: string;
  role: string;
  company: string;
}

export const QUOTES: Quote[] = [
  {
    quote: "We used to skip release notes whenever we were busy, which was always. Now they ship with the release.",
    name: "Lena Hoffmann",
    role: "Product Lead",
    company: "Marrow & Fig",
  },
  {
    quote: "Our release notes used to be a list of ticket numbers. Now sales forwards them to customers without editing.",
    name: "Daniel Osei",
    role: "Engineering Manager",
    company: "Halden Labs",
  },
  {
    quote: "Approval before publishing was the feature that got legal to say yes.",
    name: "Sofia Marchetti",
    role: "Compliance Lead",
    company: "Corvid Health",
  },
  {
    quote: "We publish to the docs, the app and email from one draft. That used to be three people and an afternoon.",
    name: "Kenji Watanabe",
    role: "Developer Relations",
    company: "Tessellate",
  },
  {
    quote: "The editor learned our house style in about four releases. Now the first draft is usually the last one.",
    name: "Amara Nwosu",
    role: "Technical Writer",
    company: "Brightwater Freight",
  },
];
