/**
 * Copy for the Marketing page's fictional product, Kiln. Kept apart from the
 * layout so the sections read as structure. String literals here are scanned by
 * `verify:no-raw-tailwind` like any class string, so no hex-like "#123" tokens.
 */

export const PRODUCT = "Kiln";

/** The three things the product does, each a row with its illustration (a file under `art/`, decorative). */
export const ROWS: { eyebrow: string; title: string; body: string; art: "pages" | "readers" | "grid" }[] = [
  {
    eyebrow: "Draft",
    title: "A first draft from the work you already merged.",
    body: "Kiln reads the titles, descriptions and labels of merged pull requests and writes the note in plain language. Internal refactors stay out, and every line links back to the change behind it.",
    art: "pages",
  },
  {
    eyebrow: "Sort",
    title: "Every change, under the heading of the people it affects.",
    body: "Admins read about billing, permissions and security. Developers get API changes with the old and new shapes side by side. Everyone else learns what is easier today than yesterday.",
    art: "readers",
  },
  {
    eyebrow: "Review",
    title: "Nothing reaches a customer until your team says so.",
    body: "Drafts wait for an approver. Comments sit on the line they are about, and the approval is kept with the release for anyone who asks later.",
    art: "grid",
  },
];

/** Getting started, in the order it happens. */
export const STEPS: { title: string; body: string }[] = [
  {
    title: "Connect a repository",
    body: "GitHub or GitLab, cloud or self-managed. Kiln asks for read access to pull requests and nothing else.",
  },
  {
    title: "Merge as you always do",
    body: "Add an audience label when you remember. Titles alone are enough for a useful draft.",
  },
  {
    title: "Approve and publish",
    body: "Edit a sentence or two, approve, and the note goes to your docs, your app and your readers' inboxes.",
  },
];

export interface Detail {
  icon: "publish" | "read" | "edit" | "style" | "sso" | "import";
  title: string;
  body: string;
}

/** The smaller things, one line each. */
export const DETAILS: Detail[] = [
  { icon: "publish", title: "Publish everywhere at once", body: "Docs, an in-app panel, RSS and an email digest, each formatted for where it lands." },
  { icon: "read", title: "Know what was read", body: "Opens and followed links per audience, without tracking pixels in anyone's inbox." },
  { icon: "edit", title: "An editor, not a generator", body: "Every sentence is yours to change, and Kiln keeps your edits for the next draft." },
  { icon: "style", title: "Your house style", body: "Tense, person, dates and numbers, applied to every draft the same way." },
  { icon: "sso", title: "Single sign-on and audit log", body: "SAML or OIDC for editors, and a year of who changed what." },
  { icon: "import", title: "Bring your old changelog", body: "Paste its address or upload Markdown. Your history and its links stay." },
];

/** Figures for the customers section. `percent` values are ratios. */
export const STATS: { id: string; value: number; percent?: boolean; label: string }[] = [
  { id: "teams", value: 1400, label: "product teams publish with Kiln" },
  { id: "notes", value: 38200, label: "release notes published this year" },
  { id: "tickets", value: 0.33, percent: true, label: "fewer support tickets in the week after a release" },
];

/** The regions the footer's switcher offers: each sets the page's locale (numbers, prices, dates). */
export const REGIONS = [
  { locale: "en-US", name: "United States" },
  { locale: "en-GB", name: "United Kingdom" },
  { locale: "de-DE", name: "Deutschland" },
  { locale: "fr-FR", name: "France" },
  { locale: "ja-JP", name: "日本" },
] as const;

export type Region = (typeof REGIONS)[number]["locale"];

/** A link with an `anchor` goes to that section of this page; the rest go to its top. */
export const FOOTER_COLUMNS: { title: string; links: { label: string; anchor?: string }[] }[] = [
  {
    title: "Product",
    links: [{ label: "Features", anchor: "features" }, { label: "Pricing", anchor: "pricing" }, { label: "Changelog" }, { label: "Integrations" }],
  },
  {
    title: "Resources",
    links: [{ label: "Documentation" }, { label: "Journal", anchor: "journal" }, { label: "Questions", anchor: "faq" }, { label: "Status" }],
  },
  { title: "Company", links: [{ label: "About" }, { label: "Careers" }, { label: "Security" }, { label: "Contact" }] },
];

export const LEGAL = ["Privacy", "Terms", "Cookie settings"];

export const SAMPLE_REPOS = [
  { value: "kiln", label: "Kiln's own repository" },
  { value: "rails", label: "A sample Rails app" },
  { value: "ios", label: "A sample iOS app" },
  { value: "cli", label: "A sample command-line tool" },
] as const;

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
        a: "Pay monthly or yearly. Paying yearly costs less, and you can switch at any renewal.",
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
